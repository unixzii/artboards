// Stage renderer: manages the CanvasKit surface, viewport transform, and
// pointer hit-testing. Offscreen SkPicture recording, budgeted tile
// rasterization, and cache management are delegated to `./tiles.ts` so this
// file stays focused on compositing and viewport state.
//
// The canvas is as large as the screen and pinned to the window's top-left
// corner; the stage is a window onto it. Resizing the stage (dragging a side
// panel, resizing the window) therefore only changes which part of the canvas
// shows: the surface is not reallocated and the design stays where it is on
// screen. Points passed in and out of this class are relative to the stage.

import type { Canvas, CanvasKit, Paint, Surface } from "canvaskit-wasm";
import type { RenderEngine } from "../../shared/engine.ts";
import { paintNode } from "../../shared/paint.ts";
import { measure } from "../core/measure.ts";
import { bounds, canvasBox, EMPTY_MODEL, hitTest, type Model, type Point, type ViewFrame, type ViewNode } from "../core/model.ts";
import type { StageBackend, StageElements } from "../core/viewer.ts";
import { REPAINT_MS, TileCache } from "./tiles.ts";

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 64;
const SETTLE_MS = 200;

/** Tracks an active pan or zoom gesture, clearing automatically after `SETTLE_MS`. */
class MotionTracker {
  active = false;
  private lastAt = -Infinity;
  private timer: ReturnType<typeof setTimeout> | undefined;

  step(hasCache: boolean, onSettle: () => void) {
    const now = performance.now();
    if (now - this.lastAt < SETTLE_MS || hasCache) this.active = true;
    this.lastAt = now;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (!this.active) return;
      this.active = false;
      onSettle();
    }, SETTLE_MS);
  }

  clear() {
    clearTimeout(this.timer);
    this.active = false;
  }
}

export class Renderer implements StageBackend {
  private ck: CanvasKit;
  private els: StageElements;
  private engine: RenderEngine;
  private cache: TileCache;
  private paints: { white: Paint; select: Paint; hover: Paint; compSelect: Paint; compHover: Paint; error: Paint; measure: Paint };
  private surface: Surface | null = null;
  private maskSample: Surface | null = null;
  private reportedZoom = -1;
  private repaintTimer: ReturnType<typeof setTimeout> | undefined;
  private zoom = new MotionTracker();
  private pan = new MotionTracker();
  private model: Model = EMPTY_MODEL;
  private selected: ViewNode | null = null;
  private hovered: ViewNode | null = null;
  private measuring = false;
  /** World-to-canvas transform. */
  private view = { s: 1, tx: 0, ty: 0 };
  /** The stage's box in canvas coordinates: the part of the canvas that shows. */
  private viewport = { x: 0, y: 0, width: 1, height: 1 };
  /** The viewport the last draw culled against; artboards outside it may be missing. */
  private drawn = { x: 0, y: 0, width: 0, height: 0 };
  private dpr = 1;
  private frame = 0;
  private observer: ResizeObserver;
  private scheme = matchMedia("(prefers-color-scheme: dark)");
  private onZoom: (scale: number) => void;

  constructor(ck: CanvasKit, engine: RenderEngine, els: StageElements, onZoom: (scale: number) => void) {
    this.ck = ck;
    this.engine = engine;
    this.cache = new TileCache(engine);
    this.els = els;
    this.onZoom = onZoom;
    const stroke = (r: number, g: number, b: number, a = 1) => {
      const p = new ck.Paint();
      p.setAntiAlias(true);
      p.setStyle(ck.PaintStyle.Stroke);
      p.setColor(ck.Color(r, g, b, a));
      return p;
    };
    const white = new ck.Paint();
    white.setColor(ck.WHITE);
    this.paints = {
      white,
      select: stroke(37, 99, 235),
      hover: stroke(37, 99, 235, 0.55),
      compSelect: stroke(124, 58, 237),
      compHover: stroke(124, 58, 237, 0.55),
      error: stroke(220, 38, 38),
      // Measuring lines and the target outline; the stage overlay's .measure-label matches it.
      measure: stroke(242, 72, 34),
    };

    this.layout();
    this.observer = new ResizeObserver(this.layout);
    this.observer.observe(els.stage);
    // Also catches a move to a screen with another size or pixel ratio.
    window.addEventListener("resize", this.layout);
    this.scheme.addEventListener("change", this.requestDraw);
  }

  dispose() {
    this.observer.disconnect();
    window.removeEventListener("resize", this.layout);
    this.scheme.removeEventListener("change", this.requestDraw);
    cancelAnimationFrame(this.frame);
    this.zoom.clear();
    this.pan.clear();
    clearTimeout(this.repaintTimer);
    this.model = EMPTY_MODEL;
    this.cache.clear();
    for (const p of Object.values(this.paints)) p.delete();
    this.surface?.delete();
    this.surface = null;
    this.maskSample?.delete();
    this.maskSample = null;
  }

  // ------------------------------------------------------------------ content

  /** Updates the scene incrementally, preserving pictures and textures of unchanged artboards. */
  setModel(model: Model) {
    const dirty = this.cache.syncModel(this.model.frames, model.frames);
    this.model = model;
    this.selected = this.hovered = null;
    this.requestDraw();
    if (dirty) this.drawAfterRepaints();
  }

  refreshFrame(frame: ViewFrame) {
    this.cache.invalidate(frame);
    this.requestDraw();
    this.drawAfterRepaints();
  }

  private drawAfterRepaints() {
    clearTimeout(this.repaintTimer);
    this.repaintTimer = setTimeout(this.requestDraw, REPAINT_MS);
  }

  setHighlight(selected: ViewNode | null, hovered: ViewNode | null, measuring: boolean) {
    if (this.selected === selected && this.hovered === hovered && this.measuring === measuring) return;
    this.selected = selected;
    this.hovered = hovered;
    this.measuring = measuring;
    this.requestDraw();
  }

  // ----------------------------------------------------------------- viewport

  get size() {
    return { width: this.viewport.width, height: this.viewport.height };
  }

  toWorld(screen: Point): Point {
    const { view, viewport } = this;
    return { x: (screen.x + viewport.x - view.tx) / view.s, y: (screen.y + viewport.y - view.ty) / view.s };
  }

  hitTest(screen: Point): ViewNode | null {
    return hitTest(this.model, this.toWorld(screen), this.maskCovers);
  }

  private maskCovers = (mask: ViewNode, x: number, y: number): boolean => {
    const ck = this.ck;
    const sample = (this.maskSample ??= ck.MakeSurface(1, 1));
    if (!sample) return true;
    const scale = this.view.s * this.dpr;
    const canvas = sample.getCanvas();
    canvas.clear(ck.TRANSPARENT);
    canvas.save();
    canvas.translate(0.5, 0.5);
    canvas.scale(scale, scale);
    canvas.translate(-x, -y);
    paintNode(this.engine, canvas, mask);
    canvas.restore();
    const pixel = canvas.readPixels(0, 0, {
      width: 1,
      height: 1,
      alphaType: ck.AlphaType.Premul,
      colorType: ck.ColorType.RGBA_8888,
      colorSpace: ck.ColorSpace.SRGB,
    });
    return !pixel || pixel[3] > 0;
  };

  panBy(dx: number, dy: number) {
    if (dx === 0 && dy === 0) return;
    this.view.tx += dx;
    this.view.ty += dy;
    this.pan.step(this.cache.hasTextures, this.requestDraw);
    this.requestDraw();
  }

  /** Multiplies zoom by `factor`, keeping the given screen point fixed (default: centre). */
  zoomBy(factor: number, at: Point = { x: this.size.width / 2, y: this.size.height / 2 }) {
    const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.view.s * factor));
    const x = at.x + this.viewport.x;
    const y = at.y + this.viewport.y;
    this.view.tx = x - ((x - this.view.tx) * s) / this.view.s;
    this.view.ty = y - ((y - this.view.ty) * s) / this.view.s;
    if (s !== this.view.s) this.zoom.step(this.cache.hasTextures, this.requestDraw);
    this.view.s = s;
    this.requestDraw();
  }

  resetZoom() {
    this.zoomBy(1 / this.view.s);
  }

  /** Shows every artboard, never magnifying past 100%. */
  fit() {
    if (!this.model.frames.length) return;
    const { x0, y0, x1, y1 } = bounds(this.model.frames);
    const { width, height } = this.size;
    const pad = width < 600 ? 24 : 64;
    const s = Math.min(1, (width - pad * 2) / (x1 - x0), (height - pad * 2 - 24) / (y1 - y0));
    this.view.s = Math.max(MIN_ZOOM, s);
    this.view.tx = this.viewport.x + (width - (x1 - x0) * this.view.s) / 2 - x0 * this.view.s;
    this.view.ty = this.viewport.y + (height - (y1 - y0) * this.view.s) / 2 - y0 * this.view.s + 12;
    this.requestDraw();
  }

  /** Pans so the node is on screen, without changing zoom. */
  reveal(node: ViewNode) {
    const { s, tx, ty } = this.view;
    const { width, height } = this.size;
    const x = (node.frame.x + node.abs.x) * s + tx - this.viewport.x;
    const y = (node.frame.y + node.abs.y) * s + ty - this.viewport.y;
    const w = node.layout.width * s;
    const h = node.layout.height * s;
    const dx = x + w < 40 || x > width - 40 ? width / 2 - (x + w / 2) : 0;
    const dy = y + h < 40 || y > height - 40 ? height / 2 - (y + h / 2) : 0;
    if (dx || dy) this.panBy(dx, dy);
  }

  // ------------------------------------------------------------------ drawing

  private requestDraw = () => {
    this.frame ||= requestAnimationFrame(() => this.draw());
  };

  /**
   * Follows the stage's box. Runs from a ResizeObserver, i.e. after layout and
   * before paint, so whatever it changes lands in the same frame as the resize.
   */
  private layout = () => {
    const { stage, canvas } = this.els;
    const rect = stage.getBoundingClientRect();
    this.viewport = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };

    // The surface covers the screen, so it survives any resize of the stage. It
    // is only replaced when the pixel ratio changes or the window outgrows it.
    const dpr = window.devicePixelRatio || 1;
    const w = Math.ceil(Math.max(screen.width, window.innerWidth) * dpr);
    const h = Math.ceil(Math.max(screen.height, window.innerHeight) * dpr);
    const stale = !this.surface || dpr !== this.dpr || w > canvas.width || h > canvas.height;
    if (stale) {
      // Textures belong to the previous surface's GPU context.
      this.cache.dropTextures();
      this.surface?.delete();
      this.dpr = dpr;
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${w / dpr}px`;
      canvas.style.height = `${h / dpr}px`;
      this.surface = this.ck.MakeWebGLCanvasSurface(canvas) ?? this.ck.MakeSWCanvasSurface(canvas);
      if (this.surface) this.cache.warmUp(this.surface);
    }
    canvas.style.transform = `translate(${-rect.left}px, ${-rect.top}px)`;

    if (this.selected) this.reveal(this.selected);

    const { viewport, drawn } = this;
    const covered =
      viewport.x >= drawn.x &&
      viewport.y >= drawn.y &&
      viewport.x + viewport.width <= drawn.x + drawn.width &&
      viewport.y + viewport.height <= drawn.y + drawn.height;
    if (stale || this.frame || !covered) this.draw();
    else this.syncOverlay();
  };

  /** Overlay elements position themselves from these (see .anchored in style.css). */
  private syncOverlay() {
    const style = this.els.overlay.style;
    style.setProperty("--s", String(this.view.s));
    style.setProperty("--tx", String(this.view.tx - this.viewport.x));
    style.setProperty("--ty", String(this.view.ty - this.viewport.y));
  }

  private outline(canvas: Canvas, node: ViewNode, paint: Paint, width: number) {
    paint.setStrokeWidth(width / this.view.s);
    const [a, b, c, d, e, f] = node.matrix;
    canvas.save();
    canvas.translate(node.frame.x, node.frame.y);
    canvas.concat([a, c, e, b, d, f, 0, 0, 1]);
    canvas.drawRect(this.ck.LTRBRect(0, 0, node.layout.width, node.layout.height), paint);
    canvas.restore();
  }

  /** The target outlined in red, solid lines for each distance, dashed guides where a line passes beside the target. */
  private drawMeasurement(canvas: Canvas, from: ViewNode, to: ViewNode) {
    const { ck, paints, view } = this;
    const paint = paints.measure;
    this.outline(canvas, to, paint, 1);
    const { gaps, guides } = measure(canvasBox(from), canvasBox(to));
    paint.setStrokeWidth(1 / view.s);
    for (const g of gaps) canvas.drawLine(g.from.x, g.from.y, g.to.x, g.to.y, paint);
    if (guides.length) {
      const dash = ck.PathEffect.MakeDash([4 / view.s, 3 / view.s], 0);
      paint.setPathEffect(dash);
      for (const g of guides) canvas.drawLine(g.from.x, g.from.y, g.to.x, g.to.y, paint);
      paint.setPathEffect(null);
      dash?.delete();
    }
  }

  private draw() {
    const { ck, surface, view, paints, dpr } = this;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (!surface) return;
    this.drawn = this.viewport;

    const min = this.toWorld({ x: 0, y: 0 });
    const max = this.toWorld({ x: this.size.width, y: this.size.height });
    const visible: ViewFrame[] = [];
    for (const f of this.model.frames) {
      if (!(f.x > max.x || f.y > max.y || f.x + f.w < min.x || f.y + f.h < min.y)) visible.push(f);
    }

    // Prepare and flush offscreen tiles before recording main-surface draws.
    const { tiles, deferred } = this.cache.prepare(visible, {
      surface,
      dpr,
      viewScale: view.s,
      viewport: this.viewport,
      canvasPixels: this.els.canvas.width * this.els.canvas.height,
      min,
      max,
      zooming: this.zoom.active,
      panning: this.pan.active,
    });

    const canvas = surface.getCanvas();
    canvas.clear(this.scheme.matches ? ck.Color(30, 30, 33) : ck.Color(236, 236, 239));
    canvas.save();
    canvas.scale(dpr, dpr);
    canvas.translate(view.tx, view.ty);
    canvas.scale(view.s, view.s);

    const scale = view.s * dpr;
    for (const f of visible) {
      const rect = ck.LTRBRect(0, 0, f.w, f.h);
      const layers = tiles.get(f) ?? null;
      canvas.save();
      if (!layers) {
        canvas.translate(f.x, f.y);
        paints.error.setStrokeWidth(1.5 / view.s);
        canvas.drawRect(rect, paints.error);
        canvas.restore();
        continue;
      }

      // Snap exact non-zooming tiles to whole device pixels so 1:1 texels stay crisp.
      let { x, y } = f;
      const top = layers[layers.length - 1];
      if (!this.zoom.active && top?.exact && top.scale === scale) {
        const px = (view.tx + f.x * view.s) * dpr;
        const py = (view.ty + f.y * view.s) * dpr;
        x += (Math.round(px) - px) / scale;
        y += (Math.round(py) - py) / scale;
      }
      canvas.translate(x, y);
      canvas.drawRect(rect, paints.white);
      if (layers.length > 0) {
        canvas.clipRect(rect, ck.ClipOp.Intersect, true);
        for (const t of layers) {
          const src = ck.XYWHRect(0, 0, t.image.width(), t.image.height());
          canvas.drawImageRectOptions(t.image, src, ck.XYWHRect(t.x, t.y, t.w, t.h), ck.FilterMode.Linear, ck.MipmapMode.None, null);
        }
      }
      canvas.restore();
    }

    if (this.measuring && this.selected && this.hovered && this.hovered !== this.selected) {
      this.drawMeasurement(canvas, this.selected, this.hovered);
    } else if (this.hovered && this.hovered !== this.selected) {
      this.outline(canvas, this.hovered, this.hovered.component ? paints.compHover : paints.hover, 1.5);
    }
    if (this.selected) {
      this.outline(canvas, this.selected, this.selected.component ? paints.compSelect : paints.select, 2);
    }
    canvas.restore();
    surface.flush();

    this.syncOverlay();
    const pct = Math.round(view.s * 100);
    if (pct !== this.reportedZoom) {
      this.reportedZoom = pct;
      this.onZoom(view.s);
    }
    if (deferred) this.requestDraw();
  }
}
