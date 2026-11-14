// View model: the server's scene turned into linked nodes placed on the
// canvas, plus the geometry queries on it. No rendering, no DOM.

import type { SceneNode } from "../lib/shared/scene.ts";
import type { FramePayload, ResolvedComment, ScenePayload, SerializedNode } from "../lib/shared/protocol.ts";

export interface ViewNode extends SceneNode {
  /** "<artboard>/<path>", stable across rebuilds. */
  key: string;
  path: string;
  frame: ViewFrame;
  /** Top-left within the artboard. */
  abs: Point;
  children: ViewNode[];
  parent: ViewNode | null;
}

export interface ViewFrame {
  name: string;
  payload: FramePayload;
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

export const EMPTY_MODEL: Model = { frames: [], nodes: new Map() };

export const nodeKey = (frame: string, path: string) => `${frame}/${path}`;

const GAP = 120;
const ROW_WIDTH = 6000;
/** Placeholder size for an artboard that failed to build. */
const FAILED = { w: 480, h: 200 };

let nextId = 1;

function hydrate(s: SerializedNode, frame: ViewFrame, path: string, parent: ViewNode | null, nodes: Model["nodes"]): ViewNode {
  // The artboard root sits at its frame's origin, whatever x/y it was given.
  const layout = parent ? s.layout : { ...s.layout, x: 0, y: 0 };
  const node: ViewNode = {
    id: nextId++,
    type: s.type,
    props: s.props,
    layout,
    fontFamilies: s.fontFamilies,
    children: [],
    parent,
    key: nodeKey(frame.name, path),
    path,
    frame,
    abs: { x: (parent?.abs.x ?? 0) + layout.x, y: (parent?.abs.y ?? 0) + layout.y },
  };
  node.children = s.children.map((c, i) => hydrate(c, frame, path === "" ? String(i) : `${path}.${i}`, node, nodes));
  nodes.set(node.key, node);
  return node;
}

/** Links the payload's trees and places artboards left to right, wrapping into rows. */
export function buildModel(scene: ScenePayload): Model {
  const nodes: Model["nodes"] = new Map();
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  const frames = (scene.frames ?? []).map((payload) => {
    const w = payload.root?.layout.width ?? FAILED.w;
    const h = payload.root?.layout.height ?? FAILED.h;
    if (x > 0 && x + w > ROW_WIDTH) {
      x = 0;
      y += rowHeight + GAP + 40;
      rowHeight = 0;
    }
    const frame: ViewFrame = { name: payload.name, payload, root: null, x, y, w, h };
    if (payload.root) frame.root = hydrate(payload.root, frame, "", null, nodes);
    x += w + GAP;
    rowHeight = Math.max(rowHeight, h);
    return frame;
  });
  return { frames, nodes };
}

/** Text for a Text layer, otherwise the layer's name. Also the comment anchor hint. */
export function describe(n: ViewNode): string {
  return n.type === "Text" ? String(n.props.children ?? "") : (n.props.name ?? "");
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
  const lx = px - n.layout.x;
  const ly = py - n.layout.y;
  const inside = lx >= 0 && ly >= 0 && lx <= n.layout.width && ly <= n.layout.height;
  if (n.props.clip && !inside) return null;
  for (let i = n.children.length - 1; i >= 0; i--) {
    const hit = hitNode(n.children[i], lx, ly);
    if (hit) return hit;
  }
  return inside ? n : null;
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
