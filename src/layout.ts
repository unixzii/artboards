// Maps the DSL's sizing model (fixed / fill / hug) onto Taffy flexbox.
//
//   number  -> fixed size, never shrinks
//   "hug"   -> size to content, never shrinks (default)
//   "fill"  -> main axis: grow to take remaining space; cross axis: stretch;
//              inside a plain Frame: 100% of the parent
//
// Children of a plain <Frame> are absolutely positioned by x/y.

import {
  AlignItems,
  AlignSelf,
  Display,
  FlexDirection,
  JustifyContent,
  Position,
  Style,
  TaffyTree,
  loadTaffy,
} from "taffy-layout";
import type { Padding } from "./dsl.ts";
import { layerChildren, type SceneNode } from "./scene.ts";
import { measureText, type TextEngine } from "./text.ts";

type ParentKind = "row" | "column" | "free";

const kindOf = (n: SceneNode): ParentKind => (n.type === "Row" ? "row" : n.type === "Column" ? "column" : "free");

const ALIGN = {
  start: AlignItems.Start,
  center: AlignItems.Center,
  end: AlignItems.End,
  stretch: AlignItems.Stretch,
} as const;

const JUSTIFY = {
  start: JustifyContent.Start,
  center: JustifyContent.Center,
  end: JustifyContent.End,
  "space-between": JustifyContent.SpaceBetween,
} as const;

function padding(p: Padding | undefined) {
  if (p == null) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof p === "number") return { top: p, right: p, bottom: p, left: p };
  if (p.length === 2) return { top: p[0], right: p[1], bottom: p[0], left: p[1] };
  return { top: p[0], right: p[1], bottom: p[2], left: p[3] };
}

function styleFor(node: SceneNode, parent: ParentKind): Style {
  const p = node.props;
  const s = new Style();
  s.display = Display.Flex;
  s.flexShrink = 0;

  for (const axis of ["width", "height"] as const) {
    const v = p[axis] ?? "hug";
    if (typeof v === "number") {
      s[axis] = v;
    } else if (v === "fill") {
      const isMain = (parent === "row" && axis === "width") || (parent === "column" && axis === "height");
      if (parent === "free") {
        s[axis] = "100%";
      } else if (isMain) {
        s.flexGrow = 1;
        s.flexShrink = 1;
        s.flexBasis = 0;
        if (axis === "width") s.minWidth = 0;
        else s.minHeight = 0;
      } else {
        s.alignSelf = AlignSelf.Stretch;
      }
    }
  }

  if (parent === "free") {
    s.position = Position.Absolute;
    s.inset = { left: p.x ?? 0, top: p.y ?? 0, right: "auto", bottom: "auto" };
  }

  const kind = kindOf(node);
  if (kind !== "free") {
    s.flexDirection = kind === "row" ? FlexDirection.Row : FlexDirection.Column;
    s.gap = { width: p.gap ?? 0, height: p.gap ?? 0 };
    s.alignItems = ALIGN[(p.align ?? "start") as keyof typeof ALIGN];
    s.justifyContent = JUSTIFY[(p.justify ?? "start") as keyof typeof JUSTIFY];
  }
  s.padding = padding(p.padding);
  return s;
}

let taffyReady: Promise<unknown> | undefined;

/** Lays out one artboard (a single root node) and writes `layout` on every node. */
export async function layoutTree(root: SceneNode, engine: TextEngine) {
  await (taffyReady ??= loadTaffy());
  const tree = new TaffyTree();
  const ids = new Map<SceneNode, bigint>();

  const build = (node: SceneNode, parent: ParentKind): bigint => {
    const style = styleFor(node, parent);
    let id: bigint;
    if (node.type === "Text") {
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
