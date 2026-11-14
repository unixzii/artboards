// Everything that touches CanvasKit: fonts, per-artboard pictures, the WebGL
// surface, and the viewport transform. Runs every frame while panning, so it
// stays out of React; the DOM overlay follows through three CSS variables.

import type { Canvas, CanvasKit, Paint, SkPicture, Surface } from "canvaskit-wasm";
import type { FontFace } from "../lib/shared/protocol.ts";
import { paintNode } from "../lib/shared/paint.ts";
import { BASE_FAMILY, releaseParagraphs, type TextEngine } from "../lib/shared/text.ts";
import { bounds, EMPTY_MODEL, hitTest, type Model, type Point, type ViewNode } from "./model.ts";

export interface RendererElements {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  overlay: HTMLElement;
}

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 64;

export class Renderer {
  private ck: CanvasKit;
  private els: RendererElements;
  private engine: TextEngine;
  private paints: { white: Paint; select: Paint; hover: Paint; error: Paint };
  private surface: Surface | null = null;
  private fontLoads = new Map<string, Promise<void>>();
  private pictures = new Map<string, SkPicture>();
  private model: Model = EMPTY_MODEL;
  private selected: ViewNode | null = null;
  private hovered: ViewNode | null = null;
  private view = { s: 1, tx: 0, ty: 0 };
  private drawQueued = false;
  private observer: ResizeObserver;
  private scheme = matchMedia("(prefers-color-scheme: dark)");
  private onZoom: (scale: number) => void;

  constructor(ck: CanvasKit, els: RendererElements, onZoom: (scale: number) => void) {
    this.ck = ck;
    this.els = els;
    this.onZoom = onZoom;
    this.engine = {
      ck,
      fonts: {
        provider: ck.TypefaceFontProvider.Make(),
        // Nodes arrive with their families already resolved by the server.
        resolve: () => ({ families: [BASE_FAMILY], missing: [] }),
      },
    };
    const stroke = (r: number, g: number, b: number, a = 1) => {
      const p = new ck.Paint();
      p.setAntiAlias(true);
      p.setStyle(ck.PaintStyle.Stroke);
      p.setColor(ck.Color(r, g, b, a));
      return p;
    };
    const white = new ck.Paint();
    white.setColor(ck.WHITE);
    this.paints = { white, select: stroke(37, 99, 235), hover: stroke(37, 99, 235, 0.55), error: stroke(220, 38, 38) };

    this.resize();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(els.stage);
    this.scheme.addEventListener("change", this.requestDraw);
  }

  dispose() {
    this.observer.disconnect();
    this.scheme.removeEventListener("change", this.requestDraw);
    this.setModel(EMPTY_MODEL);
    this.surface?.delete();
    this.surface = null;
  }

  // ------------------------------------------------------------------ content

  /** Fetches and registers font files not seen before. Await before setModel. */
  loadFonts(faces: FontFace[]): Promise<unknown> {
    return Promise.all(
      faces.map((face) => {
        let load = this.fontLoads.get(face.path);
        if (!load) {
          load = fetch(`/fonts/${face.path}`)
            .then((r) => r.arrayBuffer())
            .then((bytes) => this.engine.fonts.provider.registerFont(bytes, face.family));
          this.fontLoads.set(face.path, load);
        }
        return load;
      }),
    );
  }

  /** Replaces the scene: each artboard is recorded once into a picture and replayed per frame. */
  setModel(model: Model) {
    for (const picture of this.pictures.values()) picture.delete();
    this.pictures.clear();
    for (const f of this.model.frames) if (f.root) releaseParagraphs(f.root);
    this.model = model;
    this.selected = this.hovered = null;
    for (const f of model.frames) {
      if (!f.root) continue;
      const recorder = new this.ck.PictureRecorder();
      paintNode(this.engine, recorder.beginRecording(this.ck.LTRBRect(0, 0, f.w, f.h)), f.root);
      this.pictures.set(f.name, recorder.finishRecordingAsPicture());
      recorder.delete();
    }
    this.requestDraw();
  }

  setHighlight(selected: ViewNode | null, hovered: ViewNode | null) {
    if (this.selected === selected && this.hovered === hovered) return;
    this.selected = selected;
    this.hovered = hovered;
    this.requestDraw();
  }

  // ----------------------------------------------------------------- viewport

  get size() {
    return { width: this.els.stage.clientWidth, height: this.els.stage.clientHeight };
  }

  toWorld(screen: Point): Point {
    return { x: (screen.x - this.view.tx) / this.view.s, y: (screen.y - this.view.ty) / this.view.s };
  }

  hitTest(screen: Point): ViewNode | null {
    return hitTest(this.model, this.toWorld(screen));
  }

  panBy(dx: number, dy: number) {
    this.view.tx += dx;
    this.view.ty += dy;
    this.requestDraw();
  }

  /** Multiplies zoom by `factor`, keeping the given screen point fixed (default: centre). */
  zoomBy(factor: number, at: Point = { x: this.size.width / 2, y: this.size.height / 2 }) {
    const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.view.s * factor));
    this.view.tx = at.x - ((at.x - this.view.tx) * s) / this.view.s;
    this.view.ty = at.y - ((at.y - this.view.ty) * s) / this.view.s;
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
    this.view.tx = (width - (x1 - x0) * this.view.s) / 2 - x0 * this.view.s;
    this.view.ty = (height - (y1 - y0) * this.view.s) / 2 - y0 * this.view.s + 12;
    this.requestDraw();
  }

  /** Pans so the node is on screen, without changing zoom. */
  reveal(node: ViewNode) {
    const { s, tx, ty } = this.view;
    const { width, height } = this.size;
    const x = (node.frame.x + node.abs.x) * s + tx;
    const y = (node.frame.y + node.abs.y) * s + ty;
    const w = node.layout.width * s;
    const h = node.layout.height * s;
    const dx = x + w < 40 || x > width - 40 ? width / 2 - (x + w / 2) : 0;
    const dy = y + h < 40 || y > height - 40 ? height / 2 - (y + h / 2) : 0;
    if (dx || dy) this.panBy(dx, dy);
  }

  // ------------------------------------------------------------------ drawing

  private requestDraw = () => {
    if (this.drawQueued) return;
    this.drawQueued = true;
    requestAnimationFrame(() => {
      this.drawQueued = false;
      this.draw();
    });
  };

  private resize() {
    const { canvas } = this.els;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(this.size.width * dpr));
    const h = Math.max(1, Math.round(this.size.height * dpr));
    if (this.surface && canvas.width === w && canvas.height === h) return;
    this.surface?.delete();
    canvas.width = w;
    canvas.height = h;
    this.surface = this.ck.MakeWebGLCanvasSurface(canvas) ?? this.ck.MakeSWCanvasSurface(canvas);
    // Keep the selection visible when a panel opens over part of the canvas.
    if (this.selected) this.reveal(this.selected);
    this.requestDraw();
  }

  private outline(canvas: Canvas, node: ViewNode, paint: Paint, width: number) {
    paint.setStrokeWidth(width / this.view.s);
    const x = node.frame.x + node.abs.x;
    const y = node.frame.y + node.abs.y;
    canvas.drawRect(this.ck.LTRBRect(x, y, x + node.layout.width, y + node.layout.height), paint);
  }

  private draw() {
    const { ck, surface, view, paints } = this;
    if (!surface) return;
    const dpr = window.devicePixelRatio || 1;
    const canvas = surface.getCanvas();
    canvas.clear(this.scheme.matches ? ck.Color(30, 30, 33) : ck.Color(236, 236, 239));
    canvas.save();
    canvas.scale(dpr, dpr);
    canvas.translate(view.tx, view.ty);
    canvas.scale(view.s, view.s);

    // Only artboards that intersect the viewport are replayed.
    const min = this.toWorld({ x: 0, y: 0 });
    const max = this.toWorld({ x: this.size.width, y: this.size.height });
    for (const f of this.model.frames) {
      if (f.x > max.x || f.y > max.y || f.x + f.w < min.x || f.y + f.h < min.y) continue;
      const rect = ck.LTRBRect(f.x, f.y, f.x + f.w, f.y + f.h);
      const picture = this.pictures.get(f.name);
      if (picture) {
        canvas.drawRect(rect, paints.white);
        canvas.save();
        canvas.translate(f.x, f.y);
        canvas.drawPicture(picture);
        canvas.restore();
      } else {
        paints.error.setStrokeWidth(1.5 / view.s);
        canvas.drawRect(rect, paints.error);
      }
    }
    if (this.hovered && this.hovered !== this.selected) this.outline(canvas, this.hovered, paints.hover, 1.5);
    if (this.selected) this.outline(canvas, this.selected, paints.select, 2);
    canvas.restore();
    surface.flush();

    // Overlay elements position themselves from these (see .anchored in style.css).
    const style = this.els.overlay.style;
    style.setProperty("--s", String(view.s));
    style.setProperty("--tx", String(view.tx));
    style.setProperty("--ty", String(view.ty));
    this.onZoom(view.s);
  }
}
