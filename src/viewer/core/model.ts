// View model: the live scene trees turned into linked nodes placed on the
// canvas, plus the geometry queries on them. No rendering, no DOM.

import type { Diagnostic } from "../../shared/diagnostics.ts";
import type { VariantInfo } from "../../shared/dsl/variants.ts";
import type { ResolvedComment } from "../../shared/protocol.ts";
import { layerChildren, layerHint, textContentOf, type PaintableNode, type SceneNode } from "../../shared/scene.ts";

export interface ViewNode extends PaintableNode {
  /** "<artboard>/<path>", stable across rebuilds. */
  key: string;
  path: string;
  frame: ViewFrame;
  /** Top-left within the artboard, ignoring rotation. */
  abs: Point;
  /** Local -> artboard affine transform `[a, b, c, d, e, f]` (x' = a·x + c·y + e, y' = b·x + d·y + f), rotation included. */
  matrix: Affine;
  children: ViewNode[];
  parent: ViewNode | null;
}

export interface LiveFrameInput {
  name: string;
  root: SceneNode | null;
  error?: Diagnostic;
  variants: { list(): VariantInfo[] };
  modified: boolean;
}

export interface ViewFrame {
  name: string;
  error?: Diagnostic;
  /** Variants rendered in the artboard, with their current values. */
  variants: VariantInfo[];
  /** Not in its initial state: a variant was changed or a layer clicked. Comments are off until it is reset. */
  modified: boolean;
  /** Null when the artboard failed to build. */
  root: ViewNode | null;
  /** Position and size on the canvas. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Model {
  frames: ViewFrame[];
  nodes: Map<string, ViewNode>;
}

export interface Point {
  x: number;
  y: number;
}

export type Affine = [number, number, number, number, number, number];

const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

function multiply([a1, b1, c1, d1, e1, f1]: Affine, [a2, b2, c2, d2, e2, f2]: Affine): Affine {
  return [a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2, b1 * c2 + d1 * d2, a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1];
}

/** Placement of a node inside its parent: offset, then rotation about its centre. */
function placement(layout: { x: number; y: number; width: number; height: number }, rotation: unknown): Affine {
  const move: Affine = [1, 0, 0, 1, layout.x, layout.y];
  if (typeof rotation !== "number" || !rotation) return move;
  const r = (rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const cx = layout.width / 2;
  const cy = layout.height / 2;
  return multiply(move, [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy]);
}

/** A point in the parent's coordinates -> the node's own (unrotated) coordinates. */
function toLocal(n: { layout: { x: number; y: number; width: number; height: number }; props: Record<string, any> }, px: number, py: number): Point {
  let lx = px - n.layout.x;
  let ly = py - n.layout.y;
  const rotation = n.props.rotation;
  if (typeof rotation === "number" && rotation) {
    const r = (-rotation * Math.PI) / 180;
    const cx = n.layout.width / 2;
    const cy = n.layout.height / 2;
    const dx = lx - cx;
    const dy = ly - cy;
    lx = cx + dx * Math.cos(r) - dy * Math.sin(r);
    ly = cy + dx * Math.sin(r) + dy * Math.cos(r);
  }
  return { x: lx, y: ly };
}

export const EMPTY_MODEL: Model = { frames: [], nodes: new Map() };

export const nodeKey = (frame: string, path: string) => `${frame}/${path}`;

/** Text for a Text layer, otherwise the layer's name. Also the comment anchor hint. */
export const describe = layerHint;

const GAP = 120;
const ROW_WIDTH = 6000;
/** Placeholder size for an artboard that failed to build. */
const FAILED = { w: 480, h: 200 };

function hydrate(n: SceneNode, frame: ViewFrame, path: string, parent: ViewNode | null, nodes: Model["nodes"]): ViewNode {
  // The artboard root sits at its frame's origin, whatever x/y it was given.
  const layout = parent ? n.layout : { ...n.layout, x: 0, y: 0 };
  const { children: _children, ...props } = n.props;
  if (n.type === "Text") props.children = textContentOf(n);
  const node: ViewNode = {
    type: n.type,
    props,
    layout,
    component: n.component,
    paragraph: n.paragraph,
    fontFamilies: n.fontFamilies,
    runs: n.runs,
    missingGlyphs: n.missingGlyphs,
    children: [],
    parent,
    key: nodeKey(frame.name, path),
    path,
    frame,
    abs: { x: (parent?.abs.x ?? 0) + layout.x, y: (parent?.abs.y ?? 0) + layout.y },
    matrix: multiply(parent?.matrix ?? IDENTITY, placement(layout, n.props.rotation)),
  };
  node.children = n.type === "Text" ? [] : layerChildren(n).map((c, i) => hydrate(c, frame, path === "" ? String(i) : `${path}.${i}`, node, nodes));
  nodes.set(node.key, node);
  return node;
}

/** Links live artboard trees and places artboards left to right, wrapping into rows. */
export function buildModel(inputs: LiveFrameInput[]): Model {
  const nodes: Model["nodes"] = new Map();
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  const frames = inputs.map((input) => {
    const w = input.root?.layout.width ?? FAILED.w;
    const h = input.root?.layout.height ?? FAILED.h;
    if (x > 0 && x + w > ROW_WIDTH) {
      x = 0;
      y += rowHeight + GAP + 40;
      rowHeight = 0;
    }
    const frame: ViewFrame = { name: input.name, error: input.error, variants: input.variants.list(), modified: input.modified, root: null, x, y, w, h };
    if (input.root) frame.root = hydrate(input.root, frame, "", null, nodes);
    x += w + GAP;
    rowHeight = Math.max(rowHeight, h);
    return frame;
  });
  return { frames, nodes };
}

export function bounds(frames: ViewFrame[]) {
  return {
    x0: Math.min(...frames.map((f) => f.x)),
    y0: Math.min(...frames.map((f) => f.y)),
    x1: Math.max(...frames.map((f) => f.x + f.w)),
    y1: Math.max(...frames.map((f) => f.y + f.h)),
  };
}

function hitNode(n: ViewNode, px: number, py: number): ViewNode | null {
  const { x: lx, y: ly } = toLocal(n, px, py);
  const inside = lx >= 0 && ly >= 0 && lx <= n.layout.width && ly <= n.layout.height;
  if (n.props.clip && !inside) return null;
  for (let i = n.children.length - 1; i >= 0; i--) {
    const hit = hitNode(n.children[i], lx, ly);
    if (hit) return hit;
  }
  return inside && !n.component ? n : null;
}

/** Nearest enclosing user component instance above `node`, if any. */
export function enclosingComponent(node: ViewNode): ViewNode | null {
  for (let p = node.parent; p; p = p.parent) {
    if (p.component) return p;
  }
  return null;
}

/** Deepest layer under a canvas point. */
export function hitTest(model: Model, world: Point): ViewNode | null {
  for (let i = model.frames.length - 1; i >= 0; i--) {
    const f = model.frames[i];
    if (!f.root || world.x < f.x || world.y < f.y || world.x > f.x + f.w || world.y > f.y + f.h) continue;
    return hitNode(f.root, world.x - f.x, world.y - f.y);
  }
  return null;
}

/**
 * Canvas position of a comment's pin: where the reviewer clicked while that is
 * still on the layer, the layer's centre if it has moved away.
 */
export function pinPosition(comment: ResolvedComment, model: Model): Point | null {
  const frame = model.frames.find((f) => f.name === comment.frame);
  if (!frame) return null;
  let { x, y } = comment.point;
  const n = comment.attached ? model.nodes.get(nodeKey(comment.frame, comment.path)) : null;
  if (n && (x < n.abs.x || y < n.abs.y || x > n.abs.x + n.layout.width || y > n.abs.y + n.layout.height)) {
    x = n.abs.x + n.layout.width / 2;
    y = n.abs.y + n.layout.height / 2;
  }
  return { x: frame.x + x, y: frame.y + y };
}

/** The onClick of the innermost layer at or above `node` that has one. */
export function clickHandler(node: ViewNode | null): (() => void) | null {
  for (let n = node; n; n = n.parent) {
    if (typeof n.props.onClick === "function") return n.props.onClick;
  }
  return null;
}
