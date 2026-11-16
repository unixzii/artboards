// View model: the live scene trees turned into linked nodes placed on the
// canvas, plus the geometry queries on them. No rendering, no DOM.

import type { Diagnostic } from "../../shared/diagnostics.ts";
import type { VariantInfo } from "../../shared/dsl/variants.ts";
import type { ResolvedComment } from "../../shared/protocol.ts";
import { COMPONENT_TYPE, MASK_TYPE, expandSides, layerChildren, layerHint, textContentOf, type PaintableNode, type SceneNode } from "../../shared/scene.ts";

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
  mask?: ViewNode;
  parent: ViewNode | null;
  /** Scroll containers only: the furthest the content can scroll on each axis (0 for an axis it does not scroll). */
  scrollMax?: Point;
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
  /** Source tree identity from DesignHost, used to preserve unchanged caches across updates. */
  source: SceneNode | null;
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

/** Sets a node's artboard position and transform from its parent's, after the parent's scroll offset. */
function place(node: ViewNode) {
  const parent = node.parent;
  const scroll = node.type === MASK_TYPE ? undefined : parent?.scroll;
  const sx = scroll?.x ?? 0;
  const sy = scroll?.y ?? 0;
  node.abs = { x: (parent?.abs.x ?? 0) - sx + node.layout.x, y: (parent?.abs.y ?? 0) - sy + node.layout.y };
  const content = sx || sy ? multiply(parent!.matrix, [1, 0, 0, 1, -sx, -sy]) : (parent?.matrix ?? IDENTITY);
  node.matrix = multiply(content, placement(node.layout, node.props.rotation));
}

/** How far a `scroll` container's content reaches past its box, per scrolled axis. */
function scrollRange(n: SceneNode): Point {
  const pad = expandSides(n.props.padding);
  let right = 0;
  let bottom = 0;
  for (const c of layerChildren(n)) {
    right = Math.max(right, c.layout.x + c.layout.width);
    bottom = Math.max(bottom, c.layout.y + c.layout.height);
  }
  const axis = n.props.scroll;
  return {
    x: axis === "vertical" ? 0 : Math.max(0, right + pad.right - n.layout.width),
    y: axis === "horizontal" ? 0 : Math.max(0, bottom + pad.bottom - n.layout.height),
  };
}

const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));

function hydrate(
  n: SceneNode,
  frame: ViewFrame,
  path: string,
  parent: ViewNode | null,
  nodes: Model["nodes"],
  scrolls: ReadonlyMap<string, Point>,
): ViewNode {
  // The artboard root sits at its frame's origin, whatever x/y it was given.
  const layout = parent ? n.layout : { ...n.layout, x: 0, y: 0 };
  const { children: _children, ...props } = n.props;
  if (n.type === "Text") props.children = textContentOf(n);
  const key = nodeKey(frame.name, path);
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
    key,
    path,
    frame,
    abs: { x: 0, y: 0 },
    matrix: IDENTITY,
  };
  if (props.scroll && n.type !== "Text") {
    const max = scrollRange(n);
    const kept = scrolls.get(key);
    node.scrollMax = max;
    node.scroll = { x: clamp(kept?.x ?? 0, max.x), y: clamp(kept?.y ?? 0, max.y) };
  }
  place(node);
  node.children = n.type === "Text" ? [] : layerChildren(n).map((c, i) => hydrate(c, frame, path === "" ? String(i) : `${path}.${i}`, node, nodes, scrolls));
  if (n.mask) node.mask = hydrate(n.mask, frame, path === "" ? "mask" : `${path}.mask`, node, nodes, scrolls);
  nodes.set(node.key, node);
  return node;
}

/**
 * Scrolls a container by a delta, clamped to its range, and moves everything
 * inside it. Returns whether the offset changed.
 */
export function scrollNode(node: ViewNode, dx: number, dy: number): boolean {
  const { scroll, scrollMax } = node;
  if (!scroll || !scrollMax) return false;
  const x = clamp(scroll.x + dx, scrollMax.x);
  const y = clamp(scroll.y + dy, scrollMax.y);
  if (x === scroll.x && y === scroll.y) return false;
  node.scroll = { x, y };
  const replace = (n: ViewNode) => {
    place(n);
    for (const c of n.children) replace(c);
    if (n.mask) replace(n.mask);
  };
  for (const c of node.children) replace(c);
  return true;
}

/** The innermost scroll container at or above `node` that can still move by the delta, else the innermost one. */
export function scrollTarget(node: ViewNode | null, dx = 0, dy = 0): ViewNode | null {
  let first: ViewNode | null = null;
  for (let n = node; n; n = n.parent) {
    if (!n.scroll || !n.scrollMax) continue;
    first ??= n;
    const canX = dx < 0 ? n.scroll.x > 0 : dx > 0 && n.scroll.x < n.scrollMax.x;
    const canY = dy < 0 ? n.scroll.y > 0 : dy > 0 && n.scroll.y < n.scrollMax.y;
    if (canX || canY) return n;
  }
  return first;
}

/** Links live artboard trees and places artboards left to right, wrapping into rows. */
export function buildModel(inputs: LiveFrameInput[], scrolls: ReadonlyMap<string, Point> = new Map()): Model {
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
    const frame: ViewFrame = {
      name: input.name,
      error: input.error,
      variants: input.variants.list(),
      modified: input.modified,
      root: null,
      source: input.root,
      x,
      y,
      w,
      h,
    };
    if (input.root) frame.root = hydrate(input.root, frame, "", null, nodes, scrolls);
    x += w + GAP;
    rowHeight = Math.max(rowHeight, h);
    return frame;
  });
  return { frames, nodes };
}

export type Sizing = "Fixed" | "Fill" | "Hug";

/**
 * How the layout engine sized one axis of the node, following the rules in
 * shared/layout.ts: a number is fixed, `"fill"` fills, and an unsized side
 * fills when its parent stretches it (cross axis, Grid cell, or pinned to both
 * edges) and hugs otherwise. Null when the size is derived from the other side
 * (an Image keeping its aspect ratio).
 */
export function sizing(node: ViewNode, axis: "width" | "height"): Sizing | null {
  // A component instance is a wrapper with no props of its own: read the layer it renders.
  let host = node;
  while (host.type === COMPONENT_TYPE && host.children.length === 1) host = host.children[0];
  if (host.type === COMPONENT_TYPE) return null;
  if (host.type === MASK_TYPE) return "Fixed";
  const p = host.props;
  const v = p[axis];
  if (typeof v === "number") return "Fixed";
  if (v === "fill") return "Fill";
  const other = p[axis === "width" ? "height" : "width"];
  if (host.type === "Image" && typeof other === "number") return null;
  // Likewise, the container laying it out is the nearest ancestor that isn't a wrapper.
  let parent = host.parent;
  while (parent?.type === COMPONENT_TYPE) parent = parent.parent;
  if (!parent) return "Hug";
  const kind = parent.type === "Row" ? "row" : parent.type === "Column" ? "column" : parent.type === "Grid" ? "grid" : "free";
  if (kind === "free" || p.absolute === true) {
    const pinned = axis === "width" ? p.x != null && p.right != null : p.y != null && p.bottom != null;
    return pinned ? "Fill" : "Hug";
  }
  if (kind === "grid") {
    const align = axis === "width" ? (parent.props.justify ?? "stretch") : (p.alignSelf ?? parent.props.align ?? "stretch");
    return align === "stretch" ? "Fill" : "Hug";
  }
  const cross = (kind === "row") === (axis === "height");
  return cross && (p.alignSelf ?? parent.props.align ?? "start") === "stretch" ? "Fill" : "Hug";
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The node's on-canvas bounding box (rotation included), in canvas coordinates. */
export function canvasBox(node: ViewNode): Box {
  const [a, b, c, d, e, f] = node.matrix;
  const { width: w, height: h } = node.layout;
  const xs = [e, a * w + e, c * h + e, a * w + c * h + e].map((x) => x + node.frame.x);
  const ys = [f, b * w + f, d * h + f, b * w + d * h + f].map((y) => y + node.frame.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** The bottom-centre of the node's on-canvas box, in canvas coordinates. */
export function bottomCenter(node: ViewNode): Point {
  const box = canvasBox(node);
  return { x: (box.x0 + box.x1) / 2, y: box.y1 };
}

export function bounds(frames: ViewFrame[]) {
  return {
    x0: Math.min(...frames.map((f) => f.x)),
    y0: Math.min(...frames.map((f) => f.y)),
    x1: Math.max(...frames.map((f) => f.x + f.w)),
    y1: Math.max(...frames.map((f) => f.y + f.h)),
  };
}

type MaskCoverage = (mask: ViewNode, x: number, y: number) => boolean;

function hitNode(n: ViewNode, px: number, py: number, maskCovers: MaskCoverage): ViewNode | null {
  const { x: lx, y: ly } = toLocal(n, px, py);
  const inside = lx >= 0 && ly >= 0 && lx <= n.layout.width && ly <= n.layout.height;
  if ((n.props.clip || n.props.scroll) && !inside) return null;
  const cx = lx + (n.scroll?.x ?? 0);
  const cy = ly + (n.scroll?.y ?? 0);
  let hit: ViewNode | null = null;
  for (let i = n.children.length - 1; i >= 0; i--) {
    hit = hitNode(n.children[i], cx, cy, maskCovers);
    if (hit) break;
  }
  if (!hit && inside && !n.component) hit = n;
  return hit && (!n.mask || maskCovers(n.mask, lx, ly)) ? hit : null;
}

/** Nearest enclosing user component instance above `node`, if any. */
export function enclosingComponent(node: ViewNode): ViewNode | null {
  for (let p = node.parent; p; p = p.parent) {
    if (p.component) return p;
  }
  return null;
}

/** Deepest layer under a canvas point. */
export function hitTest(model: Model, world: Point, maskCovers: MaskCoverage): ViewNode | null {
  for (let i = model.frames.length - 1; i >= 0; i--) {
    const f = model.frames[i];
    if (!f.root || world.x < f.x || world.y < f.y || world.x > f.x + f.w || world.y > f.y + f.h) continue;
    return hitNode(f.root, world.x - f.x, world.y - f.y, maskCovers);
  }
  return null;
}

const apply = ([a, b, c, d, e, f]: Affine, p: Point): Point => ({ x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f });

function invert([a, b, c, d, e, f]: Affine): Affine {
  const det = a * d - b * c || 1;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

/** An artboard point in a layer's own (unrotated, unscrolled) coordinates. */
export function toLayer(node: ViewNode, artboard: Point): Point {
  return apply(invert(node.matrix), artboard);
}

/** Whether an artboard point is inside every clipping or scrolling layer above `node`. */
function unclipped(node: ViewNode, artboard: Point): boolean {
  for (let n = node.parent; n; n = n.parent) {
    if (!n.props.clip && !n.props.scroll) continue;
    const p = toLayer(n, artboard);
    if (p.x < 0 || p.y < 0 || p.x > n.layout.width || p.y > n.layout.height) return false;
  }
  return true;
}

/**
 * Canvas position of a comment's pin, or null when it should not show: the
 * point is in the layer's own coordinates, so the pin follows the layer as it
 * moves or scrolls, and is hidden while the layer is gone or scrolled out of view.
 */
export function pinPosition(comment: ResolvedComment, model: Model): Point | null {
  const frame = model.frames.find((f) => f.name === comment.frame);
  const n = comment.attached ? model.nodes.get(nodeKey(comment.frame, comment.path)) : null;
  if (!frame || !n) return null;
  // A layer that shrank keeps the pin on its edge.
  const at = apply(n.matrix, { x: clamp(comment.point.x, n.layout.width), y: clamp(comment.point.y, n.layout.height) });
  if (!unclipped(n, at)) return null;
  return { x: frame.x + at.x, y: frame.y + at.y };
}

/** The onClick of the innermost layer at or above `node` that has one. */
export function clickHandler(node: ViewNode | null): (() => void) | null {
  for (let n = node; n; n = n.parent) {
    if (typeof n.props.onClick === "function") return n.props.onClick;
  }
  return null;
}
