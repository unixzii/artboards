// Scene tree -> Skia canvas. Platform-free: used by both Node export and browser viewer.

import type { Canvas, CanvasKit, ImageFilter, Paint, Paragraph, Path } from "canvaskit-wasm";
import type { RenderEngine } from "./engine.ts";
import {
  expandCorners,
  expandSides,
  isComponentNode,
  parseViewBox,
  type Fill,
  type GradientStop,
  type PaintableNode,
  type Shadow,
  type Sides,
} from "./scene.ts";
import { layoutParagraph, paragraphFor, textSizeOf } from "./text.ts";

const DEFAULT_SHADOW_COLOR = "rgba(0, 0, 0, 0.25)";
const PLACEHOLDER_FILL = "#e5e7eb";
const PLACEHOLDER_LINE = "#9ca3af";

/** How much of a line of text is ink, roughly: the opacity of the bar that stands in for it. */
const GREEK_OPACITY = 0.4;

/**
 * Paints a node and everything in it. Text whose font size is below
 * `greekBelow` is drawn as a bar per line instead of glyphs: the viewer uses
 * this for text too small on screen to read, which is costly to rasterise.
 */
export function paintNode(engine: RenderEngine, canvas: Canvas, node: PaintableNode, greekBelow = 0) {
  if (node.type === "#text" || node.type === "Span") return;
  const { ck } = engine;
  const { x, y, width: w, height: h } = node.layout;
  const p = node.props;

  canvas.save();
  canvas.translate(x, y);
  if (p.rotation) canvas.rotate(p.rotation, w / 2, h / 2);

  // Frosted glass reads what is already on the canvas, so it goes before any
  // opacity layer (which starts out empty).
  const box = isComponentNode(node) || node.type === "Text" || node.type === "Path" ? null : boxGeometry(node);
  if (box && (p.backdropBlur ?? 0) > 0 && w > 0 && h > 0) {
    backdropBlur(ck, canvas, p.backdropBlur, (op) => canvas.clipRRect(box.rrect(ck, ZERO), op, true));
  }

  const opacity = typeof p.opacity === "number" ? Math.max(0, Math.min(1, p.opacity)) : 1;
  if (opacity < 1) {
    const layer = new ck.Paint();
    layer.setAlphaf(opacity);
    canvas.saveLayer(layer);
    layer.delete();
  }

  if (isComponentNode(node)) {
    for (const child of node.children) paintNode(engine, canvas, child, greekBelow);
  } else if (node.type === "Text" && textSizeOf(node) < greekBelow) {
    const para = paragraphFor(engine, node);
    layoutParagraph(para, w);
    greekText(ck, canvas, node, para);
  } else if (node.type === "Text") {
    const para = paragraphFor(engine, node);
    layoutParagraph(para, w);
    const shadows = normalizeShadows(p.shadow);
    const draw = () => canvas.drawParagraph(para, 0, 0);
    if (shadows.length > 0 && w > 0 && h > 0) drawFilteredShadows(ck, canvas, shadows, draw);
    draw();
  } else if (node.type === "Path") {
    paintPathNode(ck, canvas, node);
  } else if (box) {
    paintBox(engine, canvas, node, box, greekBelow);
  }

  if (opacity < 1) canvas.restore();
  canvas.restore();
}

// ------------------------------------------------------------------ geometry

const ZERO: Sides = { top: 0, right: 0, bottom: 0, left: 0 };

/** A rounded rectangle (or ellipse) that can be inset or outset per side. */
interface BoxGeometry {
  w: number;
  h: number;
  /** [rx, ry] per corner: top-left, top-right, bottom-right, bottom-left. */
  corners: [number, number][];
  rrect(ck: CanvasKit, inset: Sides, dx?: number, dy?: number): Float32Array;
}

function boxGeometry(node: PaintableNode): BoxGeometry {
  const { width: w, height: h } = node.layout;
  const max = Math.min(w, h) / 2;
  const corners: [number, number][] =
    node.type === "Ellipse"
      ? Array.from({ length: 4 }, () => [w / 2, h / 2] as [number, number])
      : expandCorners(node.props.cornerRadius).map((r) => {
          const c = Math.max(0, Math.min(r, max));
          return [c, c] as [number, number];
        });
  return {
    w,
    h,
    corners,
    rrect(_ck, inset, dx = 0, dy = 0) {
      // A sharp corner stays sharp when outset; a round one follows the offset.
      const adj = (r: number, d: number) => (r === 0 ? 0 : Math.max(0, r - d));
      const [tl, tr, br, bl] = corners;
      return Float32Array.of(
        inset.left + dx,
        inset.top + dy,
        w - inset.right + dx,
        h - inset.bottom + dy,
        adj(tl[0], inset.left),
        adj(tl[1], inset.top),
        adj(tr[0], inset.right),
        adj(tr[1], inset.top),
        adj(br[0], inset.right),
        adj(br[1], inset.bottom),
        adj(bl[0], inset.left),
        adj(bl[1], inset.bottom),
      );
    },
  };
}

const scaleSides = (s: Sides, k: number): Sides => ({ top: s.top * k, right: s.right * k, bottom: s.bottom * k, left: s.left * k });
const uniform = (d: number): Sides => ({ top: d, right: d, bottom: d, left: d });

// ------------------------------------------------------------------ boxes

function paintBox(engine: RenderEngine, canvas: Canvas, node: PaintableNode, box: BoxGeometry, greekBelow: number) {
  const { ck } = engine;
  const p = node.props;
  const { w, h } = box;
  const outer = box.rrect(ck, ZERO);

  const shadows = normalizeShadows(p.shadow);
  if (shadows.length > 0 && w > 0 && h > 0) drawBoxShadows(ck, canvas, box, shadows);

  const isImage = node.type === "Image";
  const img = isImage && p.src ? engine.images.get(p.src.id) : null;
  const fill: Fill | undefined = p.fill ?? (isImage && !img ? PLACEHOLDER_FILL : undefined);
  if (fill) withPaint(ck, fill, w, h, (paint) => canvas.drawRRect(outer, paint));
  if (isImage) {
    canvas.save();
    canvas.clipRRect(outer, ck.ClipOp.Intersect, true);
    if (img) drawImageFit(ck, canvas, img, w, h, p.fit ?? "cover");
    else drawPlaceholder(ck, canvas, w, h);
    canvas.restore();
  }

  if (p.stroke) drawBoxStroke(ck, canvas, node, box);

  if (p.clip || p.scroll) canvas.clipRRect(outer, ck.ClipOp.Intersect, true);
  if (node.scroll) canvas.translate(-node.scroll.x, -node.scroll.y);
  for (const child of node.children) paintNode(engine, canvas, child, greekBelow);
}

/** A bar per line where the lowercase letters would sit, in the text's color. */
function greekText(ck: CanvasKit, canvas: Canvas, node: PaintableNode, para: Paragraph) {
  const size = textSizeOf(node);
  const color = ck.parseColorString(node.props.color ?? "#000000");
  color[3] *= GREEK_OPACITY;
  const paint = new ck.Paint();
  paint.setColor(color);
  for (const line of para.getLineMetrics()) {
    canvas.drawRect(ck.LTRBRect(line.left, line.baseline - size / 2, line.left + line.width, line.baseline), paint);
  }
  paint.delete();
}

function drawBoxStroke(ck: CanvasKit, canvas: Canvas, node: PaintableNode, box: BoxGeometry) {
  const p = node.props;
  const sw = expandSides(p.strokeWidth, 1);
  const align = p.strokeAlign ?? "center";
  const dash = normalizeDash(p.strokeDash);
  if (dash) {
    // Dashes follow one centre line, so they need one width.
    const width = Math.max(sw.top, sw.right, sw.bottom, sw.left);
    const offset = align === "inside" ? width / 2 : align === "outside" ? -width / 2 : 0;
    const effect = ck.PathEffect.MakeDash(dash);
    withPaint(ck, p.stroke, box.w, box.h, (paint) => {
      paint.setStyle(ck.PaintStyle.Stroke);
      paint.setStrokeWidth(width);
      paint.setPathEffect(effect);
      canvas.drawRRect(box.rrect(ck, uniform(offset)), paint);
    });
    effect.delete();
    return;
  }
  const outerInset = align === "inside" ? ZERO : align === "outside" ? scaleSides(sw, -1) : scaleSides(sw, -0.5);
  const innerInset = align === "inside" ? sw : align === "outside" ? ZERO : scaleSides(sw, 0.5);
  const outer = box.rrect(ck, outerInset);
  const inner = box.rrect(ck, innerInset);
  withPaint(ck, p.stroke, box.w, box.h, (paint) => {
    if (inner[2] > inner[0] && inner[3] > inner[1]) canvas.drawDRRect(outer, inner, paint);
    else canvas.drawRRect(outer, paint); // the stroke is wider than the box: it covers it
  });
}

function drawImageFit(ck: CanvasKit, canvas: Canvas, img: any, w: number, h: number, fit: string) {
  const iw = img.width();
  const ih = img.height();
  if (!iw || !ih || w <= 0 || h <= 0) return;
  let src = ck.LTRBRect(0, 0, iw, ih);
  let dst = ck.LTRBRect(0, 0, w, h);
  if (fit === "cover") {
    const s = Math.max(w / iw, h / ih);
    const cw = w / s;
    const ch = h / s;
    src = ck.XYWHRect((iw - cw) / 2, (ih - ch) / 2, cw, ch);
  } else if (fit === "contain") {
    const s = Math.min(w / iw, h / ih);
    dst = ck.XYWHRect((w - iw * s) / 2, (h - ih * s) / 2, iw * s, ih * s);
  }
  canvas.drawImageRectOptions(img, src, dst, ck.FilterMode.Linear, ck.MipmapMode.Linear, null);
}

function drawPlaceholder(ck: CanvasKit, canvas: Canvas, w: number, h: number) {
  withPaint(ck, PLACEHOLDER_LINE, w, h, (paint) => {
    paint.setStyle(ck.PaintStyle.Stroke);
    paint.setStrokeWidth(1);
    canvas.drawLine(0, 0, w, h, paint);
    canvas.drawLine(w, 0, 0, h, paint);
  });
}

function backdropBlur(ck: CanvasKit, canvas: Canvas, radius: number, clip: (op: any) => void) {
  const sigma = radius / 2;
  const filter = ck.ImageFilter.MakeBlur(sigma, sigma, ck.TileMode.Clamp, null);
  canvas.save();
  clip(ck.ClipOp.Intersect);
  canvas.saveLayer(undefined, undefined, filter, 0);
  canvas.restore();
  canvas.restore();
  filter.delete();
}

function drawBoxShadows(ck: CanvasKit, canvas: Canvas, box: BoxGeometry, shadows: Required<Shadow>[]) {
  canvas.save();
  canvas.clipRRect(box.rrect(ck, ZERO), ck.ClipOp.Difference, true);
  for (const s of shadows) {
    if (box.w + s.spread * 2 <= 0 || box.h + s.spread * 2 <= 0) continue;
    const mask = s.blur > 0 ? ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, s.blur / 2, true) : null;
    withPaint(ck, s.color, box.w, box.h, (paint) => {
      if (mask) paint.setMaskFilter(mask);
      canvas.drawRRect(box.rrect(ck, uniform(-s.spread), s.x, s.y), paint);
    });
    mask?.delete();
  }
  canvas.restore();
}

// ------------------------------------------------------------------ paths

function paintPathNode(ck: CanvasKit, canvas: Canvas, node: PaintableNode) {
  const { width: w, height: h } = node.layout;
  const p = node.props;
  const path = buildRenderPath(ck, node);
  if (!path) return;

  try {
    if ((p.backdropBlur ?? 0) > 0 && w > 0 && h > 0) {
      backdropBlur(ck, canvas, p.backdropBlur, (op) => canvas.clipPath(path, op, true));
    }

    const shadows = normalizeShadows(p.shadow);
    const draw = () => drawPathFillAndStroke(ck, canvas, path, p, w, h);
    if (shadows.length > 0 && (p.fill || p.stroke)) {
      if (p.fill && !p.stroke) {
        canvas.save();
        canvas.clipPath(path, ck.ClipOp.Difference, true);
        drawFilteredShadows(ck, canvas, shadows, draw);
        canvas.restore();
      } else {
        drawFilteredShadows(ck, canvas, shadows, draw);
      }
    }
    draw();
  } finally {
    path.delete();
  }
}

function buildRenderPath(ck: CanvasKit, node: PaintableNode): Path | null {
  const p = node.props;
  if (typeof p.d !== "string" || !p.d.trim()) return null;
  const raw = ck.Path.MakeFromSVGString(p.d);
  if (!raw) return null;

  const fillType = p.fillRule === "evenodd" ? ck.FillType.EvenOdd : ck.FillType.Winding;
  const vb = parseViewBox(p.viewBox);
  const { width: w, height: h } = node.layout;

  if (!vb && fillType === ck.FillType.Winding) {
    return raw;
  }

  const pb = new ck.PathBuilder();
  pb.setFillType(fillType);
  if (vb) {
    const [vbX, vbY, vbW, vbH] = vb;
    if (w <= 0 || h <= 0) {
      pb.delete();
      raw.delete();
      return null;
    }
    const matrix = ck.Matrix.multiply(ck.Matrix.scaled(w / vbW, h / vbH), ck.Matrix.translated(-vbX, -vbY));
    pb.addPath(raw, matrix);
  } else {
    pb.addPath(raw);
  }
  raw.delete();
  return pb.detachAndDelete();
}

function drawPathFillAndStroke(ck: CanvasKit, canvas: Canvas, path: Path, p: Record<string, any>, w: number, h: number) {
  if (p.fill) {
    withPaint(ck, p.fill, w, h, (paint) => canvas.drawPath(path, paint));
  }
  if (p.stroke) {
    const caps = {
      butt: ck.StrokeCap.Butt,
      round: ck.StrokeCap.Round,
      square: ck.StrokeCap.Square,
    } as const;
    const joins = {
      miter: ck.StrokeJoin.Miter,
      round: ck.StrokeJoin.Round,
      bevel: ck.StrokeJoin.Bevel,
    } as const;
    const dash = normalizeDash(p.strokeDash);
    const effect = dash ? ck.PathEffect.MakeDash(dash) : null;
    withPaint(ck, p.stroke, w, h, (paint) => {
      paint.setStyle(ck.PaintStyle.Stroke);
      paint.setStrokeWidth(p.strokeWidth ?? 1);
      paint.setStrokeCap(caps[(p.strokeCap ?? "butt") as keyof typeof caps] ?? ck.StrokeCap.Butt);
      paint.setStrokeJoin(joins[(p.strokeJoin ?? "miter") as keyof typeof joins] ?? ck.StrokeJoin.Miter);
      if (effect) paint.setPathEffect(effect);
      canvas.drawPath(path, paint);
    });
    effect?.delete();
  }
}

// ------------------------------------------------------------------ effects

function normalizeShadows(raw: Shadow | Shadow[] | undefined): Required<Shadow>[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((s) => ({
    x: s.x ?? 0,
    y: s.y ?? 0,
    blur: s.blur ?? 0,
    spread: s.spread ?? 0,
    color: s.color ?? DEFAULT_SHADOW_COLOR,
  }));
}

/** `strokeDash` -> an even-length interval list, or null for a solid line. */
function normalizeDash(raw: unknown): number[] | null {
  if (raw == null) return null;
  const list = typeof raw === "number" ? [raw, raw] : Array.isArray(raw) ? raw.filter((n) => typeof n === "number") : [];
  if (list.length === 0 || list.every((n) => n <= 0)) return null;
  return list.length % 2 ? [...list, ...list] : list;
}

function drawFilteredShadows(ck: CanvasKit, canvas: Canvas, shadows: Required<Shadow>[], drawContent: () => void) {
  for (const s of shadows) {
    const sigma = s.blur / 2;
    let morphology: ImageFilter | null = null;
    if (s.spread > 0) morphology = ck.ImageFilter.MakeDilate(s.spread, s.spread, null);
    else if (s.spread < 0) morphology = ck.ImageFilter.MakeErode(-s.spread, -s.spread, null);
    const drop = ck.ImageFilter.MakeDropShadowOnly(s.x, s.y, sigma, sigma, ck.parseColorString(s.color), morphology);
    const layerPaint = new ck.Paint();
    layerPaint.setImageFilter(drop);
    canvas.saveLayer(layerPaint);
    drawContent();
    canvas.restore();
    layerPaint.delete();
    drop.delete();
    morphology?.delete();
  }
}

// ------------------------------------------------------------------ paints

/** Stops with missing positions spread evenly between their neighbours' slots. */
export function gradientStops(stops: (string | GradientStop)[]): { colors: string[]; positions: number[] } {
  const n = stops.length;
  const colors = stops.map((s) => (typeof s === "string" ? s : s.color));
  const positions = stops.map((s, i) => {
    const at = typeof s === "string" ? undefined : s.position;
    return at ?? (n === 1 ? 0 : i / (n - 1));
  });
  return { colors, positions };
}

/** Runs `fn` with a paint for a color or a gradient laid over a w x h box. */
function withPaint(ck: CanvasKit, fill: Fill, w: number, h: number, fn: (paint: Paint) => void) {
  const paint = new ck.Paint();
  paint.setAntiAlias(true);
  if (typeof fill === "string") {
    paint.setColor(ck.parseColorString(fill));
  } else {
    const { colors, positions } = gradientStops(fill.stops);
    const parsed = colors.map((c) => ck.parseColorString(c));
    let shader;
    if (fill.type === "radial") {
      const [cx, cy] = fill.center ?? [0.5, 0.5];
      // Built in a unit box and stretched over the real one, so it is an ellipse in non-square boxes.
      shader = ck.Shader.MakeRadialGradient([cx, cy], fill.radius ?? 0.5, parsed, positions, ck.TileMode.Clamp, ck.Matrix.scaled(w || 1, h || 1));
    } else {
      const rad = ((fill.angle ?? 180) * Math.PI) / 180;
      const dx = Math.sin(rad);
      const dy = -Math.cos(rad);
      // CSS gradient line: long enough that the corners get the first and last stops.
      const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
      shader = ck.Shader.MakeLinearGradient(
        [w / 2 - dx * half, h / 2 - dy * half],
        [w / 2 + dx * half, h / 2 + dy * half],
        parsed,
        positions,
        ck.TileMode.Clamp,
      );
    }
    paint.setShader(shader);
    shader.delete();
  }
  fn(paint);
  paint.delete();
}
