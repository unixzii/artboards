// Offscreen tile cache and budgeted rasterizer for the stage renderer.
// Keeps two LRU pools — a lightweight `overview` pool for full-artboard
// fallbacks and a larger `detail` pool for crisp/cropped tiles — all built and
// drawn through one unified `Tile` path.

import type { CanvasKit, Image, SkPicture, Surface } from "canvaskit-wasm";
import type { RenderEngine } from "../../shared/engine.ts";
import { paintNode } from "../../shared/paint.ts";
import type { Point, ViewFrame } from "../core/model.ts";

/** Window after a content mutation (Play-mode scroll, HMR) where an artboard has top priority. */
export const REPAINT_MS = 200;

/** Text smaller than this on screen, in CSS pixels, is drawn as bars. */
const MIN_TEXT_PX = 3;
/** Detail pool capacity as a multiple of canvas pixels. */
const DETAIL_BUDGET = 4;
/** Pixel cap for the low-res overview pool (~33.5M px; retains >1,000 192px tiles). */
const OVERVIEW_BUDGET_PIXELS = 32 * 1024 * 1024;
/** Max device-pixel side of each artboard's overview tile. */
const OVERVIEW_MAX_SIDE = 192;
/** Hard CPU + GPU-flush budget (ms) per settled frame for offscreen work. */
const SETTLED_BUDGET_MS = 4.0;
/** Tighter hard budget (ms) while actively panning or zooming. */
const MOTION_BUDGET_MS = 2.0;
/** How far past the viewport a cropped tile reaches, as a fraction of the viewport's size. */
const TILE_MARGIN = 0.25;
/** During zoom gestures, a covered tile is sharpened once stretched past these factors. */
const TILE_MAX_STRETCH = 1.6;
const TILE_MIN_STRETCH = 0.45;
const TILE_MAX_SIDE = 8192;

interface WorkBudget {
  spentMs: number;
  ops: number;
  sharpened: boolean;
  deferred: boolean;
}

const canSpend = (b: WorkBudget, limitMs: number) => b.ops === 0 || b.spentMs < limitMs;

export interface Tile {
  image: Image;
  x: number;
  y: number;
  w: number;
  h: number;
  frameW: number;
  frameH: number;
  /** Device pixels per artboard unit requested when rendered. */
  scale: number;
  /** True when rendered at exact 1:1 `scale`. */
  exact: boolean;
  /** True when `exact` and covering the whole `(0, 0, f.w, f.h)` artboard. */
  resident: boolean;
  stale: boolean;
  pixels: number;
  used: number;
}

export interface FrameContext {
  surface: Surface;
  dpr: number;
  viewScale: number;
  viewport: { width: number; height: number };
  canvasPixels: number;
  min: Point;
  max: Point;
  zooming: boolean;
  panning: boolean;
}

interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Quantizes text greeking into 4 coarse LOD tiers so zooming does not re-record per font size. */
function quantizeLod(viewScale: number): { level: number; greekBelow: number } {
  const raw = MIN_TEXT_PX / viewScale;
  if (raw < 12) return { level: 0, greekBelow: 0 };
  if (raw < 22) return { level: 1, greekBelow: 14 };
  if (raw < 40) return { level: 2, greekBelow: 24 };
  return { level: 3, greekBelow: Infinity };
}

function croppedBox(
  f: ViewFrame,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  ctx: FrameContext,
  marginFraction: number,
  snapToDevice: boolean,
): CropBox {
  const scale = ctx.viewScale * ctx.dpr;
  const mx = (ctx.viewport.width / ctx.viewScale) * marginFraction;
  const my = (ctx.viewport.height / ctx.viewScale) * marginFraction;
  const gx = Math.max(0, x0 - mx);
  const gy = Math.max(0, y0 - my);
  const gx1 = Math.min(f.w, x1 + mx);
  const gy1 = Math.min(f.h, y1 + my);
  const x = snapToDevice && gx > 0 ? Math.floor(gx * scale) / scale : gx;
  const y = snapToDevice && gy > 0 ? Math.floor(gy * scale) / scale : gy;
  return { x, y, w: Math.min(f.w - x, gx1 - x), h: Math.min(f.h - y, gy1 - y) };
}

function tileMetrics(box: CropBox, targetScale: number) {
  const texels = Math.min(targetScale, TILE_MAX_SIDE / Math.max(1e-6, box.w), TILE_MAX_SIDE / Math.max(1e-6, box.h));
  const width = Math.max(1, Math.ceil(box.w * texels));
  const height = Math.max(1, Math.ceil(box.h * texels));
  return { texels, width, height, pixels: width * height };
}

/** Insertion-ordered O(1) LRU tile pool bounded by total pixels. */
class TilePool {
  private map = new Map<string, Tile>();
  private totalPixels = 0;

  get size() {
    return this.map.size;
  }

  peek(name: string): Tile | null {
    return this.map.get(name) ?? null;
  }

  get(name: string, serial: number): Tile | null {
    const tile = this.map.get(name);
    if (!tile) return null;
    tile.used = serial;
    this.map.delete(name);
    this.map.set(name, tile);
    return tile;
  }

  put(name: string, tile: Tile): Tile {
    this.drop(name);
    this.map.set(name, tile);
    this.totalPixels += tile.pixels;
    return tile;
  }

  invalidate(name: string, w: number, h: number) {
    const tile = this.map.get(name);
    if (!tile) return;
    if (tile.frameW !== w || tile.frameH !== h) this.drop(name);
    else tile.stale = true;
  }

  evictFor(neededPixels: number, limit: number, exclude: string, serial: number): boolean {
    const replacing = this.map.get(exclude)?.pixels ?? 0;
    for (const [name, tile] of this.map) {
      if (this.totalPixels - replacing + neededPixels <= limit) return true;
      if (name === exclude) continue;
      if (tile.used >= serial) break;
      this.drop(name);
    }
    return this.totalPixels - replacing + neededPixels <= limit;
  }

  drop(name: string) {
    const tile = this.map.get(name);
    if (!tile) return;
    tile.image.delete();
    this.totalPixels -= tile.pixels;
    this.map.delete(name);
  }

  prune(keep: ReadonlySet<string>) {
    for (const name of [...this.map.keys()]) {
      if (!keep.has(name)) this.drop(name);
    }
  }

  clear() {
    for (const name of [...this.map.keys()]) this.drop(name);
  }
}

export class TileCache {
  private engine: RenderEngine;
  private recordings = new Map<string, Map<number, SkPicture>>();
  private overview = new TilePool();
  private detail = new TilePool();
  private repainted = new Map<string, number>();
  private serial = 0;

  constructor(engine: RenderEngine) {
    this.engine = engine;
  }

  get hasTextures(): boolean {
    return this.detail.size > 0 || this.overview.size > 0;
  }

  dropTextures() {
    this.detail.clear();
    this.overview.clear();
  }

  warmUp(surface: Surface) {
    if (surface.reportBackendTypeIsGPU()) warmUpShaders(this.engine.ck, surface);
  }

  clear() {
    for (const name of [...this.recordings.keys()]) this.forget(name);
    this.dropTextures();
    this.repainted.clear();
  }

  /** Reconciles caches with a new frame list, retaining unchanged artboards' pictures and tiles. */
  syncModel(prevFrames: readonly ViewFrame[], nextFrames: readonly ViewFrame[]): boolean {
    if (prevFrames.length === 0 || nextFrames.length === 0) {
      this.clear();
      return false;
    }
    const prev = new Map(prevFrames.map((f) => [f.name, f.source]));
    const keep = new Set(nextFrames.map((f) => f.name));
    for (const name of [...this.recordings.keys()]) if (!keep.has(name)) this.forget(name);
    for (const name of [...this.repainted.keys()]) if (!keep.has(name)) this.repainted.delete(name);
    this.detail.prune(keep);
    this.overview.prune(keep);

    const now = performance.now();
    let dirty = false;
    for (const f of nextFrames) {
      if (!f.source || prev.get(f.name) !== f.source) {
        this.invalidate(f, now);
        dirty = true;
      }
    }
    return dirty;
  }

  /** Marks an artboard dirty while keeping existing tiles as a stale fallback until upgraded. */
  invalidate(f: ViewFrame, now = performance.now()) {
    this.forget(f.name);
    this.detail.invalidate(f.name, f.w, f.h);
    this.overview.invalidate(f.name, f.w, f.h);
    this.repainted.set(f.name, now);
  }

  /** Prepares ordered tile layers (back-to-front) for each visible artboard under a frame time budget. */
  prepare(visible: readonly ViewFrame[], ctx: FrameContext): { tiles: Map<ViewFrame, Tile[] | null>; deferred: boolean } {
    const now = performance.now();
    const cx = (ctx.min.x + ctx.max.x) / 2;
    const cy = (ctx.min.y + ctx.max.y) / 2;
    const isFresh = (f: ViewFrame) => (now - (this.repainted.get(f.name) ?? -Infinity) < REPAINT_MS ? 0 : 1);
    const dist2 = (f: ViewFrame) => {
      const dx = f.x + f.w / 2 - cx;
      const dy = f.y + f.h / 2 - cy;
      return dx * dx + dy * dy;
    };
    const order = visible.length > 1 ? [...visible].sort((a, b) => isFresh(a) - isFresh(b) || dist2(a) - dist2(b)) : visible;
    const budget: WorkBudget = { spentMs: 0, ops: 0, sharpened: false, deferred: false };
    this.serial++;

    const tiles = new Map<ViewFrame, Tile[] | null>();
    for (const f of order) tiles.set(f, this.tilesFor(f, ctx, now, budget));
    return { tiles, deferred: budget.deferred };
  }

  /** Whether the artboard's content changed within the last REPAINT_MS. */
  private changedRecently(f: ViewFrame): boolean {
    return performance.now() - (this.repainted.get(f.name) ?? -Infinity) < REPAINT_MS;
  }

  private forget(name: string) {
    for (const picture of this.recordings.get(name)?.values() ?? []) picture.delete();
    this.recordings.delete(name);
  }

  private pictureFor(f: ViewFrame, viewScale: number, budget: WorkBudget): SkPicture | null {
    if (!f.root) return null;
    let levels = this.recordings.get(f.name);
    if (!levels) {
      levels = new Map();
      this.recordings.set(f.name, levels);
    }
    const { level, greekBelow } = quantizeLod(viewScale);
    let picture = levels.get(level);
    if (!picture) {
      const t0 = performance.now();
      const recorder = new this.engine.ck.PictureRecorder();
      paintNode(this.engine, recorder.beginRecording(this.engine.ck.LTRBRect(0, 0, f.w, f.h), true), f.root, greekBelow);
      picture = recorder.finishRecordingAsPicture();
      recorder.delete();
      levels.set(level, picture);
      budget.ops++;
      budget.spentMs += performance.now() - t0;
    }
    return picture;
  }

  /** Allocates/evicts within `pool`, records if needed, and rasterizes a tile with GPU flush inside budget. */
  private requestTile(
    pool: TilePool,
    maxPixels: number,
    f: ViewFrame,
    box: CropBox,
    targetScale: number,
    ctx: FrameContext,
    limitMs: number,
    deferOnSkip: boolean,
    budget: WorkBudget,
  ): Tile | null {
    const { texels, width, height, pixels } = tileMetrics(box, targetScale);
    if (!pool.evictFor(pixels, maxPixels, f.name, this.serial)) return null;
    if (!canSpend(budget, limitMs)) {
      if (deferOnSkip) budget.deferred = true;
      return null;
    }

    const opsBefore = budget.ops;
    const pic = this.pictureFor(f, targetScale / ctx.dpr, budget);
    if (!pic) return null;
    // A recording that used up the budget is normally rasterized next frame. An
    // artboard whose content just changed (motion in Play mode) gets a new tree
    // every frame, which drops the recording before it was ever shown, so the
    // screen would hold a stale tile for as long as the motion stays expensive.
    // Rasterize it now instead: the budget still keeps later artboards waiting.
    if (budget.ops > opsBefore && budget.spentMs >= limitMs && !this.changedRecently(f)) {
      if (deferOnSkip) budget.deferred = true;
      return null;
    }

    const t0 = performance.now();
    const target = ctx.surface.makeSurface({ ...ctx.surface.imageInfo(), width, height });
    if (!target) {
      budget.spentMs += performance.now() - t0;
      return null;
    }
    const canvas = target.getCanvas();
    canvas.clear(this.engine.ck.WHITE);
    canvas.scale(texels, texels);
    canvas.translate(-box.x, -box.y);
    canvas.drawPicture(pic);
    target.flush();
    const image = target.makeImageSnapshot();
    target.delete();
    budget.ops++;
    budget.spentMs += performance.now() - t0;

    const exact = texels === targetScale;
    const resident = exact && box.x === 0 && box.y === 0 && box.w === f.w && box.h === f.h;
    return pool.put(f.name, {
      image,
      x: box.x,
      y: box.y,
      w: width / texels,
      h: height / texels,
      frameW: f.w,
      frameH: f.h,
      scale: targetScale,
      exact,
      resident,
      stale: false,
      pixels,
      used: this.serial,
    });
  }

  private tilesFor(f: ViewFrame, ctx: FrameContext, now: number, budget: WorkBudget): Tile[] | null {
    if (!f.root || f.w <= 0 || f.h <= 0) return null;
    const fullBox: CropBox = { x: 0, y: 0, w: f.w, h: f.h };
    const scale = ctx.viewScale * ctx.dpr;
    const x0 = Math.max(0, ctx.min.x - f.x);
    const y0 = Math.max(0, ctx.min.y - f.y);
    const x1 = Math.min(f.w, ctx.max.x - f.x);
    const y1 = Math.min(f.h, ctx.max.y - f.y);
    const baseScale = Math.min(ctx.dpr, OVERVIEW_MAX_SIDE / f.w, OVERVIEW_MAX_SIDE / f.h);
    const baseSufficient = scale <= baseScale * 1.02;

    let base = this.overview.get(f.name, this.serial);
    if (x1 <= x0 || y1 <= y0) return base ? [base] : [];

    const slack = 0.5 / scale;
    const covers = (t: Tile) => t.x <= x0 + slack && t.y <= y0 + slack && t.x + t.w >= x1 - slack && t.y + t.h >= y1 - slack;
    const intersects = (t: Tile) => t.x + t.w > x0 && t.x < x1 && t.y + t.h > y0 && t.y < y1;

    const peekDetail = this.detail.peek(f.name);
    const detail = peekDetail && intersects(peekDetail) && !(base && !base.stale && baseSufficient) ? this.detail.get(f.name, this.serial) : null;
    const compose = (b: Tile | null = base, d: Tile | null = detail): Tile[] => {
      if (d && covers(d)) return [d];
      if (b && d) return [b, d];
      return b ? [b] : d ? [d] : [];
    };

    const detailLimit = ctx.canvasPixels * DETAIL_BUDGET;
    const requestBase = (limitMs: number) =>
      this.requestTile(this.overview, OVERVIEW_BUDGET_PIXELS, f, fullBox, baseScale, ctx, limitMs, true, budget);

    const repaintedRecently = now - (this.repainted.get(f.name) ?? -Infinity) < REPAINT_MS;
    if ((ctx.zooming || ctx.panning) && !repaintedRecently) {
      if (detail && covers(detail)) {
        const stretch = scale / detail.scale;
        if (ctx.zooming && (stretch > TILE_MAX_STRETCH || stretch < TILE_MIN_STRETCH) && !budget.sharpened && canSpend(budget, MOTION_BUDGET_MS)) {
          budget.sharpened = true;
          const box = croppedBox(f, x0, y0, x1, y1, ctx, TILE_MARGIN, false);
          const next = this.requestTile(this.detail, detailLimit, f, box, scale, ctx, MOTION_BUDGET_MS, false, budget);
          if (next) return [next];
        }
        return [detail];
      }

      if (!base) {
        const created = requestBase(MOTION_BUDGET_MS);
        return created ? compose(created, detail) : compose();
      }

      if (scale > base.scale * 4 && !budget.sharpened && canSpend(budget, MOTION_BUDGET_MS)) {
        budget.sharpened = true;
        const box = croppedBox(f, x0, y0, x1, y1, ctx, TILE_MARGIN, true);
        const next = this.requestTile(this.detail, detailLimit, f, box, scale, ctx, MOTION_BUDGET_MS, true, budget);
        if (next) return [next];
      }
      return compose();
    }

    if (baseSufficient) {
      if (base && !base.stale) return [base];
      const created = requestBase(SETTLED_BUDGET_MS);
      return created ? [created] : compose();
    }

    const fullW = Math.ceil(f.w * scale);
    const fullH = Math.ceil(f.h * scale);
    const fullFits = !repaintedRecently && fullW <= TILE_MAX_SIDE && fullH <= TILE_MAX_SIDE && fullW * fullH <= ctx.canvasPixels;
    const box = fullFits ? fullBox : croppedBox(f, x0, y0, x1, y1, ctx, repaintedRecently ? 0 : TILE_MARGIN, true);
    const canBeExact = fullFits || (box.w * scale <= TILE_MAX_SIDE && box.h * scale <= TILE_MAX_SIDE);
    const detailReady = fullFits
      ? !!(detail?.resident && detail.scale === scale && !detail.stale)
      : !!(detail && !detail.stale && detail.scale === scale && covers(detail) && (detail.exact || !canBeExact));

    const needBase = !repaintedRecently && (!base || base.stale);
    if (detail && detailReady) {
      if (needBase) requestBase(SETTLED_BUDGET_MS);
      return [detail];
    }

    const next = this.requestTile(this.detail, detailLimit, f, box, scale, ctx, SETTLED_BUDGET_MS, true, budget);
    if (next) {
      if (needBase) budget.deferred = true;
      return [next];
    }
    if (needBase) base = requestBase(SETTLED_BUDGET_MS) ?? base;
    return compose();
  }
}

/** Pre-compiles common Skia WebGL pipelines upfront to avoid mid-gesture shader stalls. */
function warmUpShaders(ck: CanvasKit, surface: Surface) {
  const off = surface.makeSurface({ ...surface.imageInfo(), width: 32, height: 32 });
  if (!off) return;
  const owned: { delete(): void }[] = [off];
  const own = <T extends { delete(): void }>(x: T): T => (owned.push(x), x);
  try {
    const p = own(new ck.Paint());
    p.setAntiAlias(true);
    const pb = new ck.PathBuilder();
    let path: ReturnType<typeof pb.detachAndDelete>;
    try {
      pb.moveTo(2, 2);
      pb.lineTo(28, 28);
      path = own(pb.detachAndDelete());
    } finally {
      if (!pb.isDeleted()) pb.delete();
    }
    const dash = own(ck.PathEffect.MakeDash([2, 2], 0));
    const lg = own(ck.Shader.MakeLinearGradient([0, 0], [32, 32], [ck.BLACK, ck.WHITE], [0, 1], ck.TileMode.Clamp));
    const rg = own(ck.Shader.MakeRadialGradient([0.5, 0.5], 0.5, [ck.BLACK, ck.WHITE], [0, 1], ck.TileMode.Clamp, ck.Matrix.scaled(32, 32)));
    const mask = own(ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, 2, true));
    const blur = own(ck.ImageFilter.MakeBlur(2, 2, ck.TileMode.Decal, null));
    const drop = own(ck.ImageFilter.MakeDropShadowOnly(1, 1, 2, 2, ck.BLACK, null));
    const layer = own(new ck.Paint());

    const c = off.getCanvas();
    c.clear(ck.TRANSPARENT);
    const outer = ck.RRectXY(ck.LTRBRect(2, 2, 30, 30), 4, 4);
    const inner = ck.RRectXY(ck.LTRBRect(6, 6, 26, 26), 2, 2);
    c.drawRect(ck.LTRBRect(0, 0, 16, 16), p);
    c.drawRRect(outer, p);
    c.drawDRRect(outer, inner, p);

    p.setShader(lg);
    c.drawRRect(outer, p);
    p.setShader(rg);
    c.drawRRect(outer, p);
    p.setShader(null);

    p.setStyle(ck.PaintStyle.Stroke);
    p.setStrokeWidth(1.5);
    p.setPathEffect(dash);
    c.drawPath(path, p);
    p.setPathEffect(null);
    p.setStyle(ck.PaintStyle.Fill);

    p.setMaskFilter(mask);
    c.drawRRect(outer, p);
    c.drawDRRect(outer, inner, p);
    p.setMaskFilter(null);

    layer.setImageFilter(blur);
    c.saveLayer(layer);
    c.drawRRect(outer, p);
    c.restore();

    layer.setImageFilter(drop);
    c.saveLayer(layer);
    c.drawRRect(outer, p);
    c.restore();
    layer.setImageFilter(null);

    layer.setBlendMode(ck.BlendMode.DstIn);
    c.saveLayer(layer);
    c.drawRRect(inner, p);
    c.restore();

    off.flush();
    const snap = own(off.makeImageSnapshot());
    c.drawImageRectOptions(snap, ck.XYWHRect(0, 0, 32, 32), ck.XYWHRect(0, 0, 32, 32), ck.FilterMode.Linear, ck.MipmapMode.None, null);
    off.flush();
  } finally {
    for (let i = owned.length - 1; i >= 0; i--) owned[i].delete();
  }
  surface.flush();
}
