// Scene tree -> Skia canvas. Platform-free: used by both Node export and browser viewer.

import type { Canvas, CanvasKit } from "canvaskit-wasm";
import { isComponentNode, type PaintableNode } from "./scene.ts";
import { paragraphFor, type TextEngine } from "./text.ts";

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
