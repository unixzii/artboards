// Retained scene tree and geometry primitives shared across Node and browser.

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Padding = number | [number, number] | [number, number, number, number];

export const COMPONENT_TYPE = "#component";

export function isComponentNode(node: { type: string }): boolean {
  return node.type === COMPONENT_TYPE;
}

/** Metadata captured for a user-defined JSX component instance. */
export interface ComponentInfo {
  name: string;
  props: Record<string, unknown>;
  /** Call-site "file:line" where `<Component ... />` was instantiated. */
  source?: string;
}

/** Minimal node contract required by shared text measurement and Skia painting. */
export interface PaintableNode {
  type: string;
  props: Record<string, any>;
  children: PaintableNode[];
  /** Position relative to parent, filled in by layout. */
  layout: Box;
  /** Present when this node represents a virtual component instance (`type === "#component"`). */
  component?: ComponentInfo;
  /** Only for "#text" nodes. */
  text?: string;
  /** Laid-out Skia paragraph, only for Text nodes. Owned by the text module. */
  paragraph?: any;
  /** Font families the Text node's paragraph uses, once resolved. */
  fontFamilies?: string[];
  /** Characters in a Text node that no bundled font covers. */
  missingGlyphs?: string[];
}

export interface SceneNode extends PaintableNode {
  id: number;
  type: string; // "Frame" | "Row" | ... | "#component" | "#text" | "#root"
  children: SceneNode[];
  parent: SceneNode | null;
  /** Outermost-to-innermost component instances enclosing this host node before grouping. */
  componentStack?: ComponentInfo[];
}

let nextId = 1;

export function createNode(type: string, props: Record<string, any>): SceneNode {
  return {
    id: nextId++,
    type,
    props,
    children: [],
    parent: null,
    layout: { x: 0, y: 0, width: 0, height: 0 },
  };
}

/** Where the node was written, e.g. "examples/page1.jsx:12". */
export function sourceOf(node: PaintableNode): string | undefined {
  return node.component?.source ?? node.props.$source;
}

export function textContentOf(node: PaintableNode): string {
  const c = node.props.children;
  if (typeof c === "string" || typeof c === "number") return String(c);
  return node.children.map((n) => n.text ?? "").join("");
}

/** Compact `k="v"` summary of component props for tree rows and anchor hints. */
export function formatPropsSummary(props: Record<string, unknown>): string {
  return Object.entries(props)
    .map(([k, v]) => {
      if (typeof v === "boolean") return v ? k : "";
      if (typeof v === "string") return `${k}=${JSON.stringify(v.length > 24 ? v.slice(0, 24) + "…" : v)}`;
      if (typeof v === "number") return `${k}=${v}`;
      return `${k}=${JSON.stringify(v)}`;
    })
    .filter(Boolean)
    .join(" ");
}

/** Text for a Text layer, props summary for a Component, otherwise the layer's name. */
export function layerHint(node: PaintableNode): string {
  if (node.component) return formatPropsSummary(node.component.props);
  return node.type === "Text" ? textContentOf(node) : (node.props.name ?? "");
}

export function walk<N extends { children: N[] }>(node: N, fn: (n: N, depth: number) => void, depth = 0) {
  fn(node, depth);
  for (const c of node.children) walk(c, fn, depth + 1);
}

/** Layer children: everything except raw text instances. */
export function layerChildren<N extends { type: string; children: N[] }>(node: N): N[] {
  return node.children.filter((c) => c.type !== "#text");
}

/**
 * Child-index path from the artboard root, e.g. "0.2.1" ("" for the root).
 * With the artboard name it identifies a layer across rebuilds.
 */
export function nodePath(node: SceneNode): string {
  const parts: number[] = [];
  for (let n = node; n.parent && n.parent.type !== "#root"; n = n.parent) {
    parts.unshift(layerChildren(n.parent).indexOf(n));
  }
  return parts.join(".");
}

export function nodeAtPath(root: SceneNode, path: string): SceneNode | undefined {
  let node: SceneNode | undefined = root;
  for (const i of path === "" ? [] : path.split(".")) node = node && layerChildren(node)[Number(i)];
  return node;
}
