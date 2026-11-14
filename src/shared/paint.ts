// Scene tree -> Skia canvas. Platform-free: used by both Node export and browser viewer.

import type { Canvas, CanvasKit, ImageFilter, Path } from "canvaskit-wasm";
import { isComponentNode, parseViewBox, type PaintableNode, type Shadow } from "./scene.ts";
import { paragraphFor, type TextEngine } from "./text.ts";

const DEFAULT_SHADOW_COLOR = "rgba(0, 0, 0, 0.25)";

export function paintNode(engine: TextEngine, canvas: Canvas, node: PaintableNode) {
  if (node.type === "#text") return;
  const { ck } = engine;
  const { x, y, width: w, height: h } = node.layout;
  const p = node.props;

  canvas.save();
  canvas.translate(x, y);

  if (isComponentNode(node)) {
    for (const child of node.children) paintNode(engine, canvas, child);
  } else if (node.type === "Text") {
    const para = paragraphFor(engine, node);
    para.layout(w);
    const shadows = normalizeShadows(p.shadow);
    const draw = () => canvas.drawParagraph(para, 0, 0);
    if (shadows.length > 0 && w > 0 && h > 0) drawFilteredShadows(ck, canvas, shadows, draw);
    draw();
  } else if (node.type === "Path") {
    paintPathNode(ck, canvas, node);
  } else {
    const bounds = ck.LTRBRect(0, 0, w, h);
    const isEllipse = node.type === "Ellipse";
    const r = isEllipse ? 0 : Math.max(0, Math.min(p.cornerRadius ?? 0, w / 2, h / 2));

    const blurRadius = p.backdropBlur ?? 0;
    if (blurRadius > 0 && w > 0 && h > 0) {
      const sigma = blurRadius / 2;
      const filter = ck.ImageFilter.MakeBlur(sigma, sigma, ck.TileMode.Clamp, null);
      canvas.save();
      clipBoxShape(ck, canvas, bounds, w, h, isEllipse, r, ck.ClipOp.Intersect);
      canvas.saveLayer(undefined, bounds, filter, 0);
      canvas.restore();
      canvas.restore();
      filter.delete();
    }

    const shadows = normalizeShadows(p.shadow);
    if (shadows.length > 0 && w > 0 && h > 0) {
      drawBoxShadows(ck, canvas, bounds, w, h, isEllipse, r, shadows);
    }

    const shape = (paint: any) => {
      if (isEllipse) canvas.drawOval(bounds, paint);
      else if (r > 0) canvas.drawRRect(ck.RRectXY(bounds, r, r), paint);
      else canvas.drawRect(bounds, paint);
    };
    if (p.fill) withPaint(ck, p.fill, (paint) => shape(paint));
    if (p.stroke) {
      withPaint(ck, p.stroke, (paint) => {
        paint.setStyle(ck.PaintStyle.Stroke);
        paint.setStrokeWidth(p.strokeWidth ?? 1);
        shape(paint);
      });
    }
    if (p.clip) clipBoxShape(ck, canvas, bounds, w, h, isEllipse, r, ck.ClipOp.Intersect);
    for (const child of node.children) paintNode(engine, canvas, child);
  }

  canvas.restore();
}

function paintPathNode(ck: CanvasKit, canvas: Canvas, node: PaintableNode) {
  const { width: w, height: h } = node.layout;
  const p = node.props;
  const path = buildRenderPath(ck, node);
  if (!path) return;

  try {
    const blurRadius = p.backdropBlur ?? 0;
    if (blurRadius > 0 && w > 0 && h > 0) {
      const sigma = blurRadius / 2;
      const filter = ck.ImageFilter.MakeBlur(sigma, sigma, ck.TileMode.Clamp, null);
      const pathBounds = path.getBounds();
      canvas.save();
      canvas.clipPath(path, ck.ClipOp.Intersect, true);
      canvas.saveLayer(undefined, pathBounds, filter, 0);
      canvas.restore();
      canvas.restore();
      filter.delete();
    }

    const shadows = normalizeShadows(p.shadow);
    const draw = () => drawPathFillAndStroke(ck, canvas, path, p);
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
    const matrix = ck.Matrix.multiply(
      ck.Matrix.scaled(w / vbW, h / vbH),
      ck.Matrix.translated(-vbX, -vbY),
    );
    pb.addPath(raw, matrix);
  } else {
    pb.addPath(raw);
  }
  raw.delete();
  return pb.detachAndDelete();
}

function drawPathFillAndStroke(ck: CanvasKit, canvas: Canvas, path: Path, p: Record<string, any>) {
  if (p.fill) {
    withPaint(ck, p.fill, (paint) => canvas.drawPath(path, paint));
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
    withPaint(ck, p.stroke, (paint) => {
      paint.setStyle(ck.PaintStyle.Stroke);
      paint.setStrokeWidth(p.strokeWidth ?? 1);
      paint.setStrokeCap(caps[(p.strokeCap ?? "butt") as keyof typeof caps] ?? ck.StrokeCap.Butt);
      paint.setStrokeJoin(joins[(p.strokeJoin ?? "miter") as keyof typeof joins] ?? ck.StrokeJoin.Miter);
      canvas.drawPath(path, paint);
    });
  }
}

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

function clipBoxShape(
  ck: CanvasKit,
  canvas: Canvas,
  bounds: Float32Array,
  w: number,
  h: number,
  isEllipse: boolean,
  r: number,
  op: any,
) {
  if (isEllipse) {
    canvas.clipRRect(ck.RRectXY(bounds, w / 2, h / 2), op, true);
  } else if (r > 0) {
    canvas.clipRRect(ck.RRectXY(bounds, r, r), op, true);
  } else {
    canvas.clipRect(bounds, op, true);
  }
}

function drawBoxShadows(
  ck: CanvasKit,
  canvas: Canvas,
  bounds: Float32Array,
  w: number,
  h: number,
  isEllipse: boolean,
  r: number,
  shadows: Required<Shadow>[],
) {
  canvas.save();
  clipBoxShape(ck, canvas, bounds, w, h, isEllipse, r, ck.ClipOp.Difference);
  for (const s of shadows) {
    const sb = ck.LTRBRect(s.x - s.spread, s.y - s.spread, w + s.x + s.spread, h + s.y + s.spread);
    const sw = sb[2] - sb[0];
    const sh = sb[3] - sb[1];
    if (sw <= 0 || sh <= 0) continue;
    const mask = s.blur > 0 ? ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, s.blur / 2, true) : null;
    withPaint(ck, s.color, (paint) => {
      if (mask) paint.setMaskFilter(mask);
      if (isEllipse) {
        canvas.drawOval(sb, paint);
      } else {
        const sr = Math.max(0, Math.min(r > 0 ? r + s.spread : 0, sw / 2, sh / 2));
        if (sr > 0) canvas.drawRRect(ck.RRectXY(sb, sr, sr), paint);
        else canvas.drawRect(sb, paint);
      }
    });
    mask?.delete();
  }
  canvas.restore();
}

function drawFilteredShadows(
  ck: CanvasKit,
  canvas: Canvas,
  shadows: Required<Shadow>[],
  drawContent: () => void,
) {
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

function withPaint(ck: CanvasKit, color: string, fn: (paint: any) => void) {
  const paint = new ck.Paint();
  paint.setAntiAlias(true);
  paint.setColor(ck.parseColorString(color));
  fn(paint);
  paint.delete();
}
