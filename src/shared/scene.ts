// Retained scene tree and geometry primitives shared across Node and browser.

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Pointer state passed to layer mouse handlers in the viewer's Play mode. */
export interface MouseEvent {
  /** Pointer X in this layer's own coordinates (0..width). */
  x: number;
  /** Pointer Y in this layer's own coordinates (0..height). */
  y: number;
  /** Whether the primary mouse button is currently pressed. */
  pressed: boolean;
  /** Whether the pointer is currently over this layer (or one of its descendants). */
  hovered: boolean;
}

export type Padding = number | [number, number] | [number, number, number, number];

export interface Shadow {
  x?: number;
  y?: number;
  blur?: number;
  spread?: number;
  color?: string;
  /** Drawn inside the shape (an inner shadow) instead of behind it. */
  inset?: boolean;
}

export type ViewBox = string | [number, number, number, number];

export interface GradientStop {
  color: string;
  /** 0..1 along the gradient. Stops without one are spread evenly. */
  position?: number;
}

export interface LinearGradient {
  type: "linear";
  /** CSS-style direction in degrees: 0 = to top, 90 = to right, 180 = to bottom (default). */
  angle?: number;
  stops: (string | GradientStop)[];
}

export interface RadialGradient {
  type: "radial";
  /** Centre as fractions of the box. Default [0.5, 0.5]. */
  center?: [number, number];
  /** Radius as a fraction of the box size (an ellipse when the box is not square). Default 0.5. */
  radius?: number;
  stops: (string | GradientStop)[];
}

export type Gradient = LinearGradient | RadialGradient;

/** What `fill` and `stroke` accept: a color string or a gradient. */
export type Fill = string | Gradient;

/** A file imported into a design (`import photo from "./photo.jpg"`). */
export interface AssetRef {
  $asset: "image" | "font";
  /** Content hash; also the file's name on the dev server. */
  id: string;
  /** Path relative to the working directory. */
  file: string;
}

export function isAssetRef(v: unknown): v is AssetRef {
  return typeof v === "object" && v !== null && ((v as any).$asset === "image" || (v as any).$asset === "font") && typeof (v as any).id === "string";
}

export interface Sides {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** all | [vertical, horizontal] | [top, right, bottom, left] -> four sides. */
export function expandSides(p: number | number[] | undefined, fallback = 0): Sides {
  if (p == null) return { top: fallback, right: fallback, bottom: fallback, left: fallback };
  if (typeof p === "number") return { top: p, right: p, bottom: p, left: p };
  if (p.length === 2) return { top: p[0], right: p[1], bottom: p[0], left: p[1] };
  return { top: p[0], right: p[1], bottom: p[2], left: p[3] };
}

/** all | [topLeft, topRight, bottomRight, bottomLeft] -> four corner radii. */
export function expandCorners(r: number | number[] | undefined): [number, number, number, number] {
  if (r == null) return [0, 0, 0, 0];
  if (typeof r === "number") return [r, r, r, r];
  return [r[0], r[1], r[2], r[3]];
}

/** One styled run of a Text: the Text's own text, or a <Span>. */
export interface TextRun {
  text: string;
  /** Span props (style overrides); empty for the Text's own text. */
  props: Record<string, any>;
  /** Font families this run uses, once resolved. */
  fontFamilies?: string[];
}

export function parseViewBox(vb: unknown): [number, number, number, number] | null {
  if (Array.isArray(vb)) {
    if (vb.length !== 4 || !vb.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
    return vb[2] > 0 && vb[3] > 0 ? [vb[0], vb[1], vb[2], vb[3]] : null;
  }
  if (typeof vb === "string") {
    const trimmed = vb.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(/[\s,]+/);
    if (parts.length !== 4) return null;
    const nums = parts.map((s) => (s === "" ? NaN : Number(s)));
    if (!nums.every((n) => Number.isFinite(n)) || nums[2] <= 0 || nums[3] <= 0) return null;
    return [nums[0], nums[1], nums[2], nums[3]];
  }
  return null;
}

export const COMPONENT_TYPE = "#component";
export const MASK_TYPE = "#mask";

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
  /** Isolated alpha mask, positioned in this node's own coordinates. */
  mask?: PaintableNode;
  /** Position relative to parent, filled in by layout. */
  layout: Box;
  /** Present when this node represents a virtual component instance (`type === "#component"`). */
  component?: ComponentInfo;
  /** Only for "#text" nodes. */
  text?: string;
  /** Laid-out Skia paragraph, only for Text nodes. Owned by the text module. */
  paragraph?: any;
  /** Styled runs of a Text node (see textRunsOf). */
  runs?: TextRun[];
  /** Font families of the Text node's own style (they also set the line box), once resolved. */
  fontFamilies?: string[];
  /** Characters in a Text node that no bundled font covers. */
  missingGlyphs?: string[];
  /** Viewer only: how far a `scroll` container's content is scrolled, in px. */
  scroll?: { x: number; y: number };
}

export interface SceneNode extends PaintableNode {
  id: number;
  type: string; // "Frame" | "Row" | ... | "#component" | "#text" | "#root"
  children: SceneNode[];
  mask?: SceneNode;
  parent: SceneNode | null;
  /** Host nodes only: outermost-to-innermost component instances enclosing this node. */
  componentStack?: ComponentInfo[];
  /** Layer nodes only: the host node (owned by React) this layer stands for. Absent on `#component` wrappers. */
  host?: SceneNode;
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
  if (node.runs) return node.runs.map((r) => r.text).join("");
  const c = node.props.children;
  if (typeof c === "string" || typeof c === "number") return String(c);
  return node.children.map((n) => (n.type === "Span" ? textContentOf(n) : (n.text ?? ""))).join("");
}

/** The runs a Text paragraph is built from: plain text children and <Span>s, in order. */
export function textRunsOf(node: PaintableNode): TextRun[] {
  if (node.runs) return node.runs;
  const c = node.props.children;
  if (typeof c === "string" || typeof c === "number") return (node.runs = [{ text: String(c), props: {} }]);
  const runs: TextRun[] = [];
  for (const n of node.children) {
    if (n.type === "Span") {
      const { children: _c, $source: _s, ...props } = n.props;
      runs.push({ text: textContentOf(n), props });
    } else if (n.text) {
      runs.push({ text: n.text, props: {} });
    }
  }
  return (node.runs = runs);
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

/** Visits the content tree, optionally visiting each node's mask before its children. */
export function walk<N extends { children: N[]; mask?: N }>(
  root: N,
  fn: (node: N, depth: number) => void,
  { includeMasks = false }: { includeMasks?: boolean } = {},
) {
  function visit(node: N, depth: number) {
    fn(node, depth);
    if (includeMasks && node.mask) visit(node.mask, depth + 1);
    for (const child of node.children) visit(child, depth + 1);
  }
  visit(root, 0);
}

/** Layer children: everything except raw text instances and the <Span>s inside a Text. */
export function layerChildren<N extends { type: string; children: N[] }>(node: N): N[] {
  return node.children.filter((c) => c.type !== "#text" && c.type !== "Span");
}

/**
 * Child-index path from the artboard root, e.g. "0.2.1" ("" for the root).
 * A mask slot uses "mask" in place of a child index.
 * With the artboard name it identifies a layer across rebuilds.
 */
export function nodePath(node: SceneNode): string {
  const parts: (number | "mask")[] = [];
  for (let n = node; n.parent && n.parent.type !== "#root"; n = n.parent) {
    parts.unshift(n === n.parent.mask ? "mask" : layerChildren(n.parent).indexOf(n));
  }
  return parts.join(".");
}

export function nodeAtPath(root: SceneNode, path: string): SceneNode | undefined {
  let node: SceneNode | undefined = root;
  for (const i of path === "" ? [] : path.split(".")) node = node && (i === "mask" ? node.mask : layerChildren(node)[Number(i)]);
  return node;
}
