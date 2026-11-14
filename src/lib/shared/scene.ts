// Retained scene tree. Everything downstream (layout, paint, inspect) reads this
// and nothing else, so the React runtime can be swapped without touching them.

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SceneNode {
  id: number;
  type: string; // "Frame" | "Row" | ... | "#text" | "#root"
  props: Record<string, any>;
  children: SceneNode[];
  parent: SceneNode | null;
  /** Only for "#text" nodes. */
  text?: string;
  /** Position relative to parent, filled in by layout. */
  layout: Box;
  /** Laid-out Skia paragraph, only for Text nodes. Owned by the text module. */
  paragraph?: any;
  /** Font families the Text node's paragraph uses, once resolved. */
  fontFamilies?: string[];
  /** Characters in a Text node that no bundled font covers. */
  missingGlyphs?: string[];
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
export function sourceOf(node: SceneNode): string | undefined {
  return node.props.$source;
}

export function textContentOf(node: SceneNode): string {
  const c = node.props.children;
  if (typeof c === "string" || typeof c === "number") return String(c);
  return node.children.map((n) => n.text ?? "").join("");
}

export function walk(node: SceneNode, fn: (n: SceneNode, depth: number) => void, depth = 0) {
  fn(node, depth);
  for (const c of node.children) walk(c, fn, depth + 1);
}

/** Layer children: everything except raw text instances. */
export function layerChildren(node: SceneNode): SceneNode[] {
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
