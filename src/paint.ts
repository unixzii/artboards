// Scene tree -> Skia canvas.

import type { Canvas, CanvasKit } from "canvaskit-wasm";
import type { SceneNode } from "./scene.ts";
import { paragraphFor, type TextEngine } from "./text.ts";

export function paintNode(engine: TextEngine, canvas: Canvas, node: SceneNode) {
  if (node.type === "#text") return;
  const { ck } = engine;
  const { x, y, width: w, height: h } = node.layout;
  const p = node.props;

  canvas.save();
  canvas.translate(x, y);

  if (node.type === "Text") {
    const para = paragraphFor(engine, node);
    para.layout(w);
    canvas.drawParagraph(para, 0, 0);
  } else {
    const bounds = ck.LTRBRect(0, 0, w, h);
    const r = p.cornerRadius ?? 0;
    const shape = (paint: any) => {
      if (node.type === "Ellipse") canvas.drawOval(bounds, paint);
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
    if (p.clip) canvas.clipRRect(ck.RRectXY(bounds, r, r), ck.ClipOp.Intersect, true);
    for (const child of node.children) paintNode(engine, canvas, child);
  }

  canvas.restore();
}

function withPaint(ck: CanvasKit, color: string, fn: (paint: any) => void) {
  const paint = new ck.Paint();
  paint.setAntiAlias(true);
  paint.setColor(ck.parseColorString(color));
  fn(paint);
  paint.delete();
}

/** Rasterizes one artboard on the CPU and returns PNG bytes. */
export function renderToPng(engine: TextEngine, root: SceneNode, scale = 1): Uint8Array {
  const { ck } = engine;
  const width = Math.ceil(root.layout.width * scale);
  const height = Math.ceil(root.layout.height * scale);
  const surface = ck.MakeSurface(width, height);
  if (!surface) throw new Error(`Could not create a ${width}x${height} surface`);
  const canvas = surface.getCanvas();
  canvas.clear(ck.WHITE);
  canvas.scale(scale, scale);
  canvas.translate(-root.layout.x, -root.layout.y);
  paintNode(engine, canvas, root);
  const image = surface.makeImageSnapshot();
  const png = image.encodeToBytes();
  image.delete();
  surface.delete();
  if (!png) throw new Error("PNG encoding failed");
  return png;
}
