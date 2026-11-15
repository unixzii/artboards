// Distances between two layers, for Option/Alt-hover measuring. Pure geometry
// on canvas-space boxes; the renderer draws the lines and the stage overlay
// labels them.

import type { Box, Point } from "./model.ts";

/** A measured distance: a solid line from `from` to `to`, labelled with its length. */
export interface Gap {
  from: Point;
  to: Point;
  length: number;
  axis: "x" | "y";
}

/** A dashed line extending the target's edge to meet a gap line that passes beside it. */
export interface Guide {
  from: Point;
  to: Point;
}

export interface Measurement {
  gaps: Gap[];
  guides: Guide[];
}

const mid = (a: number, b: number) => (a + b) / 2;
const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

/**
 * Distances from the selected box `a` to the target box `b`, Figma-style:
 * - Overlapping (one inside the other, or crossing): the distance between each
 *   pair of matching edges, drawn through the middle of the inner box.
 * - Apart: the gap on each axis where they don't overlap. The line runs through
 *   the middle of their shared span, or through the middle of `a` with a dashed
 *   guide extending `b`'s edge when they share none.
 */
export function measure(a: Box, b: Box): Measurement {
  const gaps: Gap[] = [];
  const guides: Guide[] = [];
  const add = (from: Point, to: Point, axis: "x" | "y") => {
    const length = axis === "x" ? Math.abs(to.x - from.x) : Math.abs(to.y - from.y);
    if (length > 0.01) gaps.push({ from, to, length, axis });
  };
  const overlapX = overlaps(a.x0, a.x1, b.x0, b.x1);
  const overlapY = overlaps(a.y0, a.y1, b.y0, b.y1);

  if (overlapX && overlapY) {
    const aInB = b.x0 <= a.x0 && a.x1 <= b.x1 && b.y0 <= a.y0 && a.y1 <= b.y1;
    const inner = aInB ? a : b.x0 >= a.x0 && b.x1 <= a.x1 && b.y0 >= a.y0 && b.y1 <= a.y1 ? b : a;
    const cx = mid(inner.x0, inner.x1);
    const cy = mid(inner.y0, inner.y1);
    add({ x: Math.min(a.x0, b.x0), y: cy }, { x: Math.max(a.x0, b.x0), y: cy }, "x");
    add({ x: Math.min(a.x1, b.x1), y: cy }, { x: Math.max(a.x1, b.x1), y: cy }, "x");
    add({ x: cx, y: Math.min(a.y0, b.y0) }, { x: cx, y: Math.max(a.y0, b.y0) }, "y");
    add({ x: cx, y: Math.min(a.y1, b.y1) }, { x: cx, y: Math.max(a.y1, b.y1) }, "y");
    return { gaps, guides };
  }

  if (!overlapX) {
    const aLeft = a.x1 <= b.x0;
    const x0 = aLeft ? a.x1 : b.x1;
    const x1 = aLeft ? b.x0 : a.x0;
    const y = overlapY ? mid(Math.max(a.y0, b.y0), Math.min(a.y1, b.y1)) : mid(a.y0, a.y1);
    add({ x: x0, y }, { x: x1, y }, "x");
    if (!overlapY) {
      // Extend b's facing edge up or down to the line.
      const edgeX = aLeft ? b.x0 : b.x1;
      guides.push({ from: { x: edgeX, y: y < b.y0 ? b.y0 : b.y1 }, to: { x: edgeX, y } });
    }
  }
  if (!overlapY) {
    const aAbove = a.y1 <= b.y0;
    const y0 = aAbove ? a.y1 : b.y1;
    const y1 = aAbove ? b.y0 : a.y0;
    const x = overlapX ? mid(Math.max(a.x0, b.x0), Math.min(a.x1, b.x1)) : mid(a.x0, a.x1);
    add({ x, y: y0 }, { x, y: y1 }, "y");
    if (!overlapX) {
      const edgeY = aAbove ? b.y0 : b.y1;
      guides.push({ from: { x: x < b.x0 ? b.x0 : b.x1, y: edgeY }, to: { x, y: edgeY } });
    }
  }
  return { gaps, guides };
}
