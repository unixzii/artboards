// Maps the DSL's sizing model (fixed / fill / hug) onto Taffy flexbox and grid.
//
//   number  -> fixed size, never shrinks
//   "hug"   -> size to content, never shrinks (default)
//   "fill"  -> Row/Column main axis: grow (by `grow`, default 1) into remaining space;
//              cross axis and Grid cells: stretch;
//              inside a plain Frame or when absolute: 100% of the parent
//
// Children of a plain <Frame>, and children marked `absolute`, are positioned
// by x/y/right/bottom against the parent's outer box and take no space in flow.

import type { CanvasKit } from "canvaskit-wasm";
import initWasm, {
  AlignContent,
  AlignItems,
  AlignSelf,
  Display,
  FlexDirection,
  FlexWrap,
  JustifyContent,
  Position,
  Style,
  TaffyTree,
  initSync,
  type GridTemplateComponent,
} from "taffy-layout/wasm";
import { prepareTree, type RenderEngine } from "./engine.ts";
import { expandSides, layerChildren, parseViewBox, walk, type PaintableNode, type SceneNode } from "./scene.ts";
import { measureText, type Constraint } from "./text.ts";

type ParentKind = "row" | "column" | "grid" | "free";

const kindOf = (n: SceneNode): ParentKind =>
  n.type === "Row" ? "row" : n.type === "Column" ? "column" : n.type === "Grid" ? "grid" : "free";

const ALIGN = {
  start: AlignItems.Start,
  center: AlignItems.Center,
  end: AlignItems.End,
  stretch: AlignItems.Stretch,
} as const;

const ALIGN_SELF = {
  start: AlignSelf.Start,
  center: AlignSelf.Center,
  end: AlignSelf.End,
  stretch: AlignSelf.Stretch,
} as const;

const JUSTIFY = {
  start: JustifyContent.Start,
  center: JustifyContent.Center,
  end: JustifyContent.End,
  "space-between": JustifyContent.SpaceBetween,
  "space-around": JustifyContent.SpaceAround,
  "space-evenly": JustifyContent.SpaceEvenly,
} as const;

/** `columns` / `rows` of a Grid -> Taffy track list. */
export function gridTracks(v: unknown): GridTemplateComponent[] {
  if (typeof v === "number") return Array.from({ length: v }, () => ({ min: 0, max: "1fr" as const }));
  if (!Array.isArray(v)) return [];
  return v.map((t): GridTemplateComponent => {
    if (typeof t === "number") return { min: t, max: t };
    if (t === "hug") return { min: "auto", max: "auto" }; // sized to content; the Grid packs tracks at the start
    return { min: 0, max: t as `${number}fr` };
  });
}

type Stretched = Map<SceneNode, { width?: number; height?: number }>;

function styleFor(node: SceneNode, parent: ParentKind, stretched?: { width?: number; height?: number }): Style {
  const p = node.props;
  const s = new Style();
  s.display = node.type === "Grid" ? Display.Grid : Display.Flex;
  s.flexShrink = 0;
  const absolute = parent === "free" || p.absolute === true;
  const inFlow = !absolute;

  if (inFlow && p.alignSelf) s.alignSelf = ALIGN_SELF[p.alignSelf as keyof typeof ALIGN_SELF];

  for (const axis of ["width", "height"] as const) {
    const v = p[axis] ?? "hug";
    if (typeof v === "number") {
      s[axis] = v;
    } else if (v === "fill") {
      const isMain = (parent === "row" && axis === "width") || (parent === "column" && axis === "height");
      if (absolute) {
        // Sized from the parent by layoutTree (see absoluteSizes).
      } else if (parent === "grid") {
        if (axis === "width") s.justifySelf = AlignSelf.Stretch;
        else s.alignSelf = AlignSelf.Stretch;
      } else if (isMain) {
        s.flexGrow = p.grow ?? 1;
        s.flexShrink = 1;
        s.flexBasis = 0;
        if (axis === "width") s.minWidth = 0;
        else s.minHeight = 0;
      } else {
        s.alignSelf = AlignSelf.Stretch;
      }
    }
  }
  if (p.minWidth != null) s.minWidth = p.minWidth;
  if (p.maxWidth != null) s.maxWidth = p.maxWidth;
  if (p.minHeight != null) s.minHeight = p.minHeight;
  if (p.maxHeight != null) s.maxHeight = p.maxHeight;

  if (absolute) {
    // Only near-edge insets go to Taffy: it resolves right/bottom against the
    // wrong box, so layoutTree places those itself (see resolveFarInsets).
    s.position = Position.Absolute;
    s.inset = { left: p.x ?? 0, top: p.y ?? 0, right: "auto", bottom: "auto" };
  }
  if (stretched?.width != null) s.width = stretched.width;
  if (stretched?.height != null) s.height = stretched.height;

  if (parent === "grid" && inFlow) {
    if (p.colSpan > 1) s.gridColumn = { start: "auto", end: { span: p.colSpan } };
    if (p.rowSpan > 1) s.gridRow = { start: "auto", end: { span: p.rowSpan } };
  }

  const kind = kindOf(node);
  const gap = p.gap ?? 0;
  if (kind === "row" || kind === "column") {
    const cross = p.crossGap ?? gap;
    s.flexDirection = kind === "row" ? FlexDirection.Row : FlexDirection.Column;
    s.flexWrap = p.wrap ? FlexWrap.Wrap : FlexWrap.NoWrap;
    s.alignContent = AlignContent.Start;
    s.gap = kind === "row" ? { width: gap, height: cross } : { width: cross, height: gap };
    s.alignItems = ALIGN[(p.align ?? "start") as keyof typeof ALIGN];
    s.justifyContent = JUSTIFY[(p.justify ?? "start") as keyof typeof JUSTIFY];
  } else if (kind === "grid") {
    s.gridTemplateColumns = gridTracks(p.columns);
    if (p.rows != null) s.gridTemplateRows = gridTracks(p.rows);
    s.gap = { width: p.columnGap ?? gap, height: p.rowGap ?? gap };
    // Pack tracks at the start. CSS's default ("normal") hands leftover space to
    // auto tracks, so a "hug" column or an implicit row would grow past its content.
    s.justifyContent = JustifyContent.Start;
    s.alignContent = AlignContent.Start;
    s.alignItems = ALIGN[(p.align ?? "stretch") as keyof typeof ALIGN];
    s.justifyItems = ALIGN[(p.justify ?? "stretch") as keyof typeof ALIGN];
  }
  const pad = expandSides(p.padding);
  s.padding = pad;
  return s;
}

function measurePath(ck: CanvasKit, node: PaintableNode, known: Constraint): { width: number; height: number } {
  if (known.width != null && known.height != null) return { width: known.width, height: known.height };
  const vb = parseViewBox(node.props.viewBox);
  if (vb) {
    const [, , vbW, vbH] = vb;
    if (known.width != null) return { width: known.width, height: known.width * (vbH / vbW) };
    if (known.height != null) return { width: known.height * (vbW / vbH), height: known.height };
    return { width: vbW, height: vbH };
  }
  const d = typeof node.props.d === "string" ? node.props.d.trim() : "";
  const path = d ? ck.Path.MakeFromSVGString(d) : null;
  if (!path) return { width: known.width ?? 0, height: known.height ?? 0 };
  const b = path.computeTightBounds();
  path.delete();
  if (b[0] === 0 && b[1] === 0 && b[2] === 0 && b[3] === 0) {
    return { width: known.width ?? 0, height: known.height ?? 0 };
  }
  const pad = node.props.stroke ? (typeof node.props.strokeWidth === "number" ? node.props.strokeWidth : 1) / 2 : 0;
  return {
    width: known.width ?? Math.ceil(Math.max(0, b[2] + pad)),
    height: known.height ?? Math.ceil(Math.max(0, b[3] + pad)),
  };
}

/** Images keep their aspect ratio; with no size given they are as many px as the file has pixels. */
function measureImage(engine: RenderEngine, node: PaintableNode, known: Constraint): { width: number; height: number } {
  if (known.width != null && known.height != null) return { width: known.width, height: known.height };
  const img = node.props.src ? engine.images.get(node.props.src.id) : null;
  const iw = img?.width() ?? 0;
  const ih = img?.height() ?? 0;
  if (!iw || !ih) return { width: known.width ?? 0, height: known.height ?? 0 };
  if (known.width != null) return { width: known.width, height: (known.width * ih) / iw };
  if (known.height != null) return { width: (known.height * iw) / ih, height: known.height };
  return { width: iw, height: ih };
}

const LEAVES = new Set(["Text", "Path", "Image"]);

let taffyReady: Promise<void> | undefined;

/** Initializes Taffy from WASM bytes (Node) or a URL (browser). Idempotent. */
export function initTaffy(wasm: ArrayBufferView | ArrayBuffer | string): Promise<void> {
  return (taffyReady ??=
    typeof wasm === "string"
      ? initWasm({ module_or_path: wasm }).then(() => {})
      : Promise.resolve().then(() => {
          initSync({ module: wasm });
        }));
}

const isAbsolute = (n: SceneNode) => n.props.absolute === true || (n.parent != null && n.parent.type !== "#root" && kindOf(n.parent) === "free");

/** Lays out one artboard (a single root node) and writes `layout` on every node. */
export async function layoutTree(root: SceneNode, engine: RenderEngine) {
  if (!taffyReady) throw new Error("Taffy is not initialized; call initTaffy first.");
  await Promise.all([taffyReady, prepareTree(root, engine)]);
  layoutSubtree(root, engine, new Map());
}

function layoutSubtree(root: SceneNode, engine: RenderEngine, sized: Stretched) {
  // Taffy resolves percentages and right/bottom insets of absolute children
  // against the wrong box, so sizes that depend on the parent are computed
  // here from the previous pass. Each pass settles one more level of nesting.
  for (let pass = 0; pass < 8; pass++) {
    computeLayout(root, engine, sized);
    if (!absoluteSizes(root, sized)) break;
  }
  resolveFarInsets(root);
  walk(root, (node) => {
    if (!node.mask) return;
    const { width, height } = node.layout;
    layoutSubtree(node.mask, engine, new Map([[node.mask, { width, height }]]));
  });
}

/**
 * Absolute children with `"fill"`, or pinned to both edges of an axis without a
 * fixed size, span their parent minus the offsets. Returns whether any changed.
 */
function absoluteSizes(root: SceneNode, sized: Stretched): boolean {
  let changed = false;
  walk(root, (n) => {
    if (n === root || !n.parent || !isAbsolute(n)) return;
    const p = n.props;
    const span = (axis: "width" | "height", start: unknown, end: unknown) => {
      const v = p[axis];
      if (v === "fill" || (start != null && end != null && typeof v !== "number")) {
        return Math.max(0, n.parent!.layout[axis] - ((start as number) ?? 0) - ((end as number) ?? 0));
      }
      return undefined;
    };
    const next = { width: span("width", p.x, p.right), height: span("height", p.y, p.bottom) };
    if (next.width == null && next.height == null) return;
    const prev = sized.get(n);
    if (prev?.width !== next.width || prev?.height !== next.height) {
      sized.set(n, next);
      changed = true;
    }
  });
  return changed;
}

/** Places absolute children given by `right`/`bottom` (and no `x`/`y`) against their parent's far edges. */
function resolveFarInsets(root: SceneNode) {
  walk(root, (n) => {
    if (n === root || !n.parent || !isAbsolute(n)) return;
    const p = n.props;
    if (p.right != null && p.x == null) n.layout.x = n.parent.layout.width - p.right - n.layout.width;
    if (p.bottom != null && p.y == null) n.layout.y = n.parent.layout.height - p.bottom - n.layout.height;
  });
}

function computeLayout(root: SceneNode, engine: RenderEngine, stretched: Stretched) {
  const tree = new TaffyTree();
  // Keep subpixel positions and sizes. Rounding to whole pixels snaps each edge
  // on its own, so a 16.8 × 16.8 circle could come out 17 × 16, and centred
  // content drifts by up to half a pixel. Skia paints fractions crisply enough.
  tree.disableRounding();
  const ids = new Map<SceneNode, bigint>();

  const build = (node: SceneNode, parent: ParentKind): bigint => {
    const style = styleFor(node, parent, stretched.get(node));
    let id: bigint;
    if (LEAVES.has(node.type)) {
      id = tree.newLeafWithContext(style, node);
    } else {
      const kind = kindOf(node);
      const kids = layerChildren(node).map((c) => build(c, kind));
      id = tree.newWithChildren(style, kids);
    }
    style.free();
    ids.set(node, id);
    return id;
  };

  // The artboard root sits on the canvas, not in a layout container.
  const rootId = build(root, "free");
  tree.computeLayoutWithMeasure(
    rootId,
    { width: "max-content", height: "max-content" },
    (known: any, available: any, _id: bigint, context: SceneNode | undefined, style: Style) => {
      style.free();
      if (!context) return { width: 0, height: 0 };
      if (context.type === "Path") return measurePath(engine.ck, context, known);
      if (context.type === "Image") return measureImage(engine, context, known);
      return measureText(engine, context, known, available);
    },
  );

  for (const [node, id] of ids) {
    const l = tree.getLayout(id);
    node.layout = { x: l.x, y: l.y, width: l.width, height: l.height };
    l.free();
  }
  tree.free();
}
