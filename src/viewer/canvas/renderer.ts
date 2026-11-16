// Stage renderer: records per-artboard SkPictures onto the WebGL/SW CanvasKit
// surface and manages the viewport transform. Runs every frame while panning,
// so it stays out of React; the DOM overlay follows through CSS variables.
//
// The canvas is as large as the screen and pinned to the window's top-left
// corner; the stage is a window onto it. Resizing the stage (dragging a side
// panel, resizing the window) therefore only changes which part of the canvas
// shows: the surface is not reallocated and the design stays where it is on
// screen. Points passed in and out of this class are relative to the stage.
//
// Artboards are recorded into pictures, and mostly drawn from textures ("tiles")
// rendered from those:
//
// - An artboard small enough on screen keeps a tile of the whole of it at the
//   current scale, placed on whole device pixels. Panning, hovering and
//   selecting then cost a textured quad per artboard instead of a replay.
// - One too large for that (zoomed in, when little of it shows) is replayed
//   every frame; its picture skips what falls outside the viewport.
// - Replaying at a scale not drawn before is slow, as every glyph is rasterised
//   again, and a pinch changes the scale on every frame. While one is under way
//   every artboard is drawn from a tile rendered a moment earlier and merely
//   stretched; things are drawn sharp again once the zoom settles.
//
// Text too small on screen to read is drawn as bars rather than glyphs. Which
// text that is depends on the zoom, so an artboard has a picture per level of
// detail, recorded the first time it is needed.

import type { Canvas, CanvasKit, Image, Paint, SkPicture, Surface } from "canvaskit-wasm";
import type { RenderEngine } from "../../shared/engine.ts";
import { paintNode } from "../../shared/paint.ts";
import type { PaintableNode } from "../../shared/scene.ts";
import { textSizeOf } from "../../shared/text.ts";
import { measure } from "../core/measure.ts";
import { bounds, canvasBox, EMPTY_MODEL, hitTest, type Model, type Point, type ViewFrame, type ViewNode } from "../core/model.ts";
import type { StageBackend, StageElements } from "../core/viewer.ts";

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 64;

/** Text smaller than this on screen, in CSS pixels, is drawn as bars. */
const MIN_TEXT_PX = 3;

/** A zoom step this soon after the last one is part of a gesture. */
const SETTLE_MS = 150;
/** Tiles only a gesture could use outlive it by this long, so one that pauses and resumes reuses them. */
const TILE_TTL_MS = 2000;
/** An artboard repainted this recently (a scroll in Play mode, a rebuild) is replayed rather than given a tile that would not last. */
const REPAINT_MS = 250;
/** All tiles together may hold this many times the canvas's pixels. */
const TILE_BUDGET = 2;
/** How far past the viewport a tile reaches, as a fraction of the viewport's size. */
const TILE_MARGIN = 0.25;
/** A tile is redrawn once it is stretched or shrunk past these factors. */
const TILE_MAX_STRETCH = 1.5;
const TILE_MIN_STRETCH = 0.5;
const TILE_MAX_SIDE = 8192;

/** An artboard's pictures, one per level of detail. */
interface Recording {
  /** The distinct font sizes in the artboard, ascending. */
  sizes: number[];
  /** By how many of `sizes` are drawn as bars; 0 is the artboard in full. */
  levels: Map<number, SkPicture>;
}

function collectTextSizes(node: PaintableNode, into: Set<number>) {
  if (node.type === "Text") into.add(textSizeOf(node));
  else for (const child of node.children) collectTextSizes(child, into);
}

/** Part of an artboard rendered to a texture, in the artboard's coordinates. */
interface Tile {
  image: Image;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Device pixels per artboard unit the tile was rendered for. */
  scale: number;
  /** Whether it holds the whole artboard at exactly `scale`: the kind that is kept once the zoom settles. */
  resident: boolean;
  pixels: number;
  /** The draw that last used it. */
  used: number;
}

export class Renderer implements StageBackend {
  private ck: CanvasKit;
  private els: StageElements;
  private engine: RenderEngine;
  private paints: { white: Paint; select: Paint; hover: Paint; compSelect: Paint; compHover: Paint; error: Paint; measure: Paint };
  private surface: Surface | null = null;
  private maskSample: Surface | null = null;
  private recordings = new Map<string, Recording>();
  private tiles = new Map<string, Tile>();
  private tilePixels = 0;
  /** Counts draws. */
  private serial = 0;
  /** When each artboard was last repainted, and when the scene was last replaced. */
  private repainted = new Map<string, number>();
  private replacedAt = -Infinity;
  private repaintTimer: ReturnType<typeof setTimeout> | undefined;
  /** Whether a zoom gesture is under way, i.e. artboards are drawn from tiles. */
  private zooming = false;
  private zoomedAt = -Infinity;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  private tileTimer: ReturnType<typeof setTimeout> | undefined;
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
    clearTimeout(this.settleTimer);
    clearTimeout(this.tileTimer);
    this.setModel(EMPTY_MODEL);
    clearTimeout(this.repaintTimer);
    this.surface?.delete();
    this.surface = null;
    this.maskSample?.delete();
    this.maskSample = null;
  }

  // ------------------------------------------------------------------ content

  /** Replaces the scene: each artboard is recorded once into a picture and replayed per frame. */
  setModel(model: Model) {
    for (const name of [...this.recordings.keys()]) this.forget(name);
    this.dropTiles();
    this.repainted.clear();
    this.replacedAt = performance.now();
    this.model = model;
    this.selected = this.hovered = null;
    this.requestDraw();
    this.drawAfterRepaints();
  }

  refreshFrame(frame: ViewFrame) {
    this.forget(frame.name);
    this.dropTile(frame.name);
    this.repainted.set(frame.name, performance.now());
    this.requestDraw();
    this.drawAfterRepaints();
  }

  /** Draws once repaints have stopped coming, which is when the artboards get their tiles back. */
  private drawAfterRepaints() {
    clearTimeout(this.repaintTimer);
    this.repaintTimer = setTimeout(this.requestDraw, REPAINT_MS);
  }

  private forget(name: string) {
    for (const picture of this.recordings.get(name)?.levels.values() ?? []) picture.delete();
    this.recordings.delete(name);
  }

  /**
   * The picture to replay an artboard from at the current zoom, recorded on
   * first use; null for an artboard that failed to render.
   */
  private pictureFor(f: ViewFrame): SkPicture | null {
    if (!f.root) return null;
    let recording = this.recordings.get(f.name);
    if (!recording) {
      const sizes = new Set<number>();
      collectTextSizes(f.root, sizes);
      recording = { sizes: [...sizes].sort((a, b) => a - b), levels: new Map() };
      this.recordings.set(f.name, recording);
    }
    const greekBelow = MIN_TEXT_PX / this.view.s;
    const level = recording.sizes.findLastIndex((size) => size < greekBelow) + 1;
    let picture = recording.levels.get(level);
    if (!picture) {
      const recorder = new this.ck.PictureRecorder();
      // Any threshold between two neighbouring sizes records the same picture.
      // Recording bounds lets a replay skip what lies outside the clip.
      paintNode(this.engine, recorder.beginRecording(this.ck.LTRBRect(0, 0, f.w, f.h), true), f.root, level ? greekBelow : 0);
      picture = recorder.finishRecordingAsPicture();
      recorder.delete();
      recording.levels.set(level, picture);
    }
    return picture;
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
    this.view.tx += dx;
    this.view.ty += dy;
    this.requestDraw();
  }

  /** Multiplies zoom by `factor`, keeping the given screen point fixed (default: centre). */
  zoomBy(factor: number, at: Point = { x: this.size.width / 2, y: this.size.height / 2 }) {
    const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.view.s * factor));
    const x = at.x + this.viewport.x;
    const y = at.y + this.viewport.y;
    this.view.tx = x - ((x - this.view.tx) * s) / this.view.s;
    this.view.ty = y - ((y - this.view.ty) * s) / this.view.s;
    if (s !== this.view.s) this.zoomStep();
    this.view.s = s;
    this.requestDraw();
  }

  /**
   * Notes a change of scale. A lone step (a toolbar button, one wheel notch) is
   * drawn sharp straight away; a second one close behind starts a gesture.
   */
  private zoomStep() {
    const now = performance.now();
    if (now - this.zoomedAt < SETTLE_MS || this.tiles.size > 0) this.zooming = true;
    this.zoomedAt = now;
    clearTimeout(this.settleTimer);
    clearTimeout(this.tileTimer);
    this.settleTimer = setTimeout(() => {
      if (!this.zooming) return;
      this.zooming = false;
      this.requestDraw();
    }, SETTLE_MS);
    this.tileTimer = setTimeout(() => {
      const scale = this.view.s * this.dpr;
      for (const [name, tile] of this.tiles) if (!tile.resident || tile.scale !== scale) this.dropTile(name);
    }, TILE_TTL_MS);
  }

  private dropTile(name: string) {
    const tile = this.tiles.get(name);
    if (!tile) return;
    tile.image.delete();
    this.tilePixels -= tile.pixels;
    this.tiles.delete(name);
  }

  private dropTiles() {
    for (const name of [...this.tiles.keys()]) this.dropTile(name);
  }

  /** Renders part of an artboard (in its coordinates) to a tile, replacing the one it has. */
  private renderTile(f: ViewFrame, picture: SkPicture, x: number, y: number, w: number, h: number): Tile | null {
    const scale = this.view.s * this.dpr;
    const texels = Math.min(scale, TILE_MAX_SIDE / w, TILE_MAX_SIDE / h);
    const width = Math.max(1, Math.ceil(w * texels));
    const height = Math.max(1, Math.ceil(h * texels));
    const target = this.surface!.makeSurface({ ...this.surface!.imageInfo(), width, height });
    if (!target) return null;
    const canvas = target.getCanvas();
    canvas.clear(this.ck.WHITE);
    canvas.scale(texels, texels);
    canvas.translate(-x, -y);
    canvas.drawPicture(picture);
    const image = target.makeImageSnapshot();
    target.delete();

    this.dropTile(f.name);
    const resident = texels === scale && x === 0 && y === 0 && w === f.w && h === f.h;
    const tile: Tile = { image, x, y, w: width / texels, h: height / texels, scale, resident, pixels: width * height, used: this.serial };
    this.tiles.set(f.name, tile);
    this.tilePixels += tile.pixels;
    return tile;
  }

  /**
   * The tile of a whole artboard at the current scale, rendered if it has none.
   * Null when the artboard is too large on screen for one, or the tiles drawn
   * this frame already fill the budget; it is then replayed instead.
   */
  private residentTile(f: ViewFrame, picture: SkPicture): Tile | null {
    const scale = this.view.s * this.dpr;
    const old = this.tiles.get(f.name);
    if (old?.resident && old.scale === scale) return old;

    const width = Math.ceil(f.w * scale);
    const height = Math.ceil(f.h * scale);
    const canvasPixels = this.els.canvas.width * this.els.canvas.height;
    if (width > TILE_MAX_SIDE || height > TILE_MAX_SIDE || width * height > canvasPixels) return null;
    // Make room by giving up the tiles that have gone longest without being drawn.
    const idle = [...this.tiles].filter(([name, tile]) => tile.used < this.serial && name !== f.name).sort((a, b) => a[1].used - b[1].used);
    const held = () => this.tilePixels - (old?.pixels ?? 0);
    while (held() + width * height > canvasPixels * TILE_BUDGET && idle.length) this.dropTile(idle.shift()![0]);
    if (held() + width * height > canvasPixels * TILE_BUDGET) return null;
    return this.renderTile(f, picture, 0, 0, f.w, f.h);
  }

  /**
   * The tile to draw an artboard from during a zoom gesture, rendering it first
   * if there is none, it no longer covers what shows of the artboard (`x0..y1`,
   * in the artboard's coordinates), or it has gone soft. Tiles that still cover
   * are sharpened one per frame, so a gesture never pays for all of them at once.
   */
  private gestureTile(f: ViewFrame, picture: SkPicture, x0: number, y0: number, x1: number, y1: number, budget: { sharpened: boolean }): Tile | null {
    const scale = this.view.s * this.dpr;
    const old = this.tiles.get(f.name);
    if (old) {
      const slack = 0.5 / scale;
      const covers = old.x <= x0 + slack && old.y <= y0 + slack && old.x + old.w >= x1 - slack && old.y + old.h >= y1 - slack;
      const stretch = scale / old.scale;
      const sharp = stretch <= TILE_MAX_STRETCH && stretch >= TILE_MIN_STRETCH;
      if (covers && (sharp || budget.sharpened)) return old;
      if (covers) budget.sharpened = true;
    }

    // What shows plus a margin, so the tile survives some panning and zooming out.
    const mx = (this.viewport.width / this.view.s) * TILE_MARGIN;
    const my = (this.viewport.height / this.view.s) * TILE_MARGIN;
    const x = Math.max(0, x0 - mx);
    const y = Math.max(0, y0 - my);
    return this.renderTile(f, picture, x, y, Math.min(f.w, x1 + mx) - x, Math.min(f.h, y1 + my) - y) ?? old ?? null;
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
    // is only replaced when the pixel ratio changes or the window outgrows it
    // (another screen, a window spanning two, browser zoom).
    const dpr = window.devicePixelRatio || 1;
    const w = Math.ceil(Math.max(screen.width, window.innerWidth) * dpr);
    const h = Math.ceil(Math.max(screen.height, window.innerHeight) * dpr);
    const stale = !this.surface || dpr !== this.dpr || w > canvas.width || h > canvas.height;
    if (stale) {
      this.dropTiles(); // they belong to the surface's context
      this.surface?.delete();
      this.dpr = dpr;
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${w / dpr}px`;
      canvas.style.height = `${h / dpr}px`;
      this.surface = this.ck.MakeWebGLCanvasSurface(canvas) ?? this.ck.MakeSWCanvasSurface(canvas);
    }
    // Pins the canvas to the window's corner, whatever the stage's position.
    canvas.style.transform = `translate(${-rect.left}px, ${-rect.top}px)`;

    // Keep the selection visible when a panel opens over part of the canvas.
    if (this.selected) this.reveal(this.selected);

    // Shrinking or moving within what is already drawn needs no repaint. Drawing
    // here rather than next frame keeps a new surface from showing blank.
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
    const canvas = surface.getCanvas();
    canvas.clear(this.scheme.matches ? ck.Color(30, 30, 33) : ck.Color(236, 236, 239));
    canvas.save();
    canvas.scale(dpr, dpr);
    canvas.translate(view.tx, view.ty);
    canvas.scale(view.s, view.s);

    // Only artboards that intersect the visible part of the canvas are replayed.
    const min = this.toWorld({ x: 0, y: 0 });
    const max = this.toWorld({ x: this.size.width, y: this.size.height });
    const budget = { sharpened: false };
    const now = performance.now();
    const scale = view.s * dpr;
    this.serial++;
    for (const f of this.model.frames) {
      if (f.x > max.x || f.y > max.y || f.x + f.w < min.x || f.y + f.h < min.y) continue;
      const rect = ck.LTRBRect(0, 0, f.w, f.h);
      const picture = this.pictureFor(f);
      canvas.save();
      if (!picture) {
        canvas.translate(f.x, f.y);
        paints.error.setStrokeWidth(1.5 / view.s);
        canvas.drawRect(rect, paints.error);
        canvas.restore();
        continue;
      }

      let tile: Tile | null = null;
      if (this.zooming) {
        tile = this.gestureTile(f, picture, Math.max(0, min.x - f.x), Math.max(0, min.y - f.y), Math.min(f.w, max.x - f.x), Math.min(f.h, max.y - f.y), budget);
      } else if (now - Math.max(this.replacedAt, this.repainted.get(f.name) ?? -Infinity) >= REPAINT_MS) {
        tile = this.residentTile(f, picture);
      }
      if (tile) tile.used = this.serial;

      // A settled tile goes on whole device pixels, where its texels are copied
      // as they are; anywhere else they would be blended with their neighbours.
      let { x, y } = f;
      if (tile && !this.zooming) {
        const px = (view.tx + f.x * view.s) * dpr;
        const py = (view.ty + f.y * view.s) * dpr;
        x += (Math.round(px) - px) / scale;
        y += (Math.round(py) - py) / scale;
      }
      canvas.translate(x, y);
      canvas.drawRect(rect, paints.white);
      canvas.clipRect(rect, ck.ClipOp.Intersect, true);
      if (tile) {
        const src = ck.XYWHRect(0, 0, tile.image.width(), tile.image.height());
        canvas.drawImageRectOptions(tile.image, src, ck.XYWHRect(tile.x, tile.y, tile.w, tile.h), ck.FilterMode.Linear, ck.MipmapMode.None, null);
      } else {
        canvas.drawPicture(picture);
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
    this.onZoom(view.s);
  }
}
