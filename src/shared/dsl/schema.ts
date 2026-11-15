// Single source of truth for the DSL: runtime validation, the generated
// `types/artboards.d.ts`, and the `artboards docs` reference all come from here.

import { builtinFamilies, knownFamilies } from "../fonts.ts";
import { isAssetRef, parseViewBox } from "../scene.ts";

type PropType =
  | { kind: "number"; min?: number; max?: number; integer?: boolean }
  | { kind: "size" }
  | { kind: "color" }
  | { kind: "fill" }
  | { kind: "string" }
  | { kind: "boolean" }
  | { kind: "sides" }
  | { kind: "corners" }
  | { kind: "dash" }
  | { kind: "tracks" }
  | { kind: "image" }
  | { kind: "fontFamily" }
  | { kind: "shadow" }
  | { kind: "viewBox" }
  | { kind: "enum"; values: readonly string[] }
  | { kind: "children"; of: "nodes" | "text" | "runs" };

interface PropDef {
  type: PropType;
  doc: string;
  default?: string;
  required?: boolean;
}

const num = (doc: string, def?: string, min = 0, max?: number): PropDef => ({ type: { kind: "number", min, max }, doc, default: def });
const int = (doc: string, def?: string, min = 1): PropDef => ({ type: { kind: "number", min, integer: true }, doc, default: def });
const color = (doc: string): PropDef => ({ type: { kind: "color" }, doc });
const bool = (doc: string, def = "false"): PropDef => ({ type: { kind: "boolean" }, doc, default: def });
const oneOf = (values: readonly string[], doc: string, def?: string): PropDef => ({
  type: { kind: "enum", values },
  doc,
  default: def,
});

const box = {
  width: { type: { kind: "size" }, doc: "Fixed px, \"fill\" (take available space) or \"hug\" (fit content).", default: '"hug"' },
  height: { type: { kind: "size" }, doc: "Fixed px, \"fill\" or \"hug\".", default: '"hug"' },
  minWidth: num("Lower bound on the width in px."),
  maxWidth: num("Upper bound on the width in px."),
  minHeight: num("Lower bound on the height in px."),
  maxHeight: num("Upper bound on the height in px."),
  grow: num('Share of the free space a `"fill"` child takes along its Row/Column, relative to its fill siblings.', "1"),
  alignSelf: oneOf(["start", "center", "end", "stretch"], "Overrides the parent's `align` for this child."),
  absolute: bool("Take this child out of its Row/Column/Grid flow and place it with x/y/right/bottom, on top of the flow."),
  x: { type: { kind: "number", min: -Infinity }, doc: "Left offset in px from the parent's left edge. Applies inside a <Frame> or with `absolute`.", default: "0" },
  y: { type: { kind: "number", min: -Infinity }, doc: "Top offset in px from the parent's top edge. Applies inside a <Frame> or with `absolute`.", default: "0" },
  right: { type: { kind: "number", min: -Infinity }, doc: "Offset in px from the parent's right edge, instead of x. Applies inside a <Frame> or with `absolute`." },
  bottom: { type: { kind: "number", min: -Infinity }, doc: "Offset in px from the parent's bottom edge, instead of y. Applies inside a <Frame> or with `absolute`." },
  colSpan: int("Number of columns this child spans inside a <Grid>.", "1"),
  rowSpan: int("Number of rows this child spans inside a <Grid>.", "1"),
  opacity: num("Opacity of the element and everything inside it, 0..1.", "1", 0, 1),
  rotation: { type: { kind: "number", min: -Infinity }, doc: "Clockwise rotation in degrees around the centre. Paint only: layout uses the unrotated box.", default: "0" },
  name: { type: { kind: "string" }, doc: "Layer name shown in inspect output and diagnostics." },
} satisfies Record<string, PropDef>;

const fillProp: PropDef = { type: { kind: "fill" }, doc: "Background: a color or a gradient `{ type: \"linear\" | \"radial\", stops, ... }`." };
const strokeProp: PropDef = { type: { kind: "fill" }, doc: "Border color or gradient." };
const strokeDash: PropDef = {
  type: { kind: "dash" },
  doc: "Dashed border: dash length, or `[dash, gap, ...]` in px. Needs a single strokeWidth.",
};

const boxPaint = {
  fill: fillProp,
  stroke: strokeProp,
  strokeWidth: { type: { kind: "sides" }, doc: "Border width in px: all | [vertical, horizontal] | [top, right, bottom, left].", default: "1" },
  strokeAlign: oneOf(["inside", "center", "outside"], "Where the border sits relative to the edge.", '"center"'),
  strokeDash,
} satisfies Record<string, PropDef>;

const radius = {
  cornerRadius: { type: { kind: "corners" }, doc: "Corner radius in px: all | [topLeft, topRight, bottomRight, bottomLeft].", default: "0" },
} satisfies Record<string, PropDef>;

const shadowProp: PropDef = {
  type: { kind: "shadow" },
  doc: "Drop shadow or array of shadows: `{ x?, y?, blur?, spread?, color? }`.",
};

const effects = {
  shadow: shadowProp,
  backdropBlur: num("Frosted-glass blur radius in px applied to content behind this element.", "0"),
} satisfies Record<string, PropDef>;

const container = {
  padding: { type: { kind: "sides" }, doc: "Inner spacing: all | [vertical, horizontal] | [top, right, bottom, left].", default: "0" },
  clip: bool("Clip children to this element's bounds."),
  children: { type: { kind: "children", of: "nodes" }, doc: "Child elements." },
} satisfies Record<string, PropDef>;

const flex = {
  gap: num("Space between children in px.", "0"),
  align: oneOf(["start", "center", "end", "stretch"], "Cross-axis alignment of children.", '"start"'),
  justify: oneOf(
    ["start", "center", "end", "space-between", "space-around", "space-evenly"],
    "Main-axis distribution of children.",
    '"start"',
  ),
  wrap: bool("Wrap children onto new lines when they do not fit."),
  crossGap: num("Space between wrapped lines in px. Defaults to `gap`."),
} satisfies Record<string, PropDef>;

const textStyle = {
  color: color("Text color. Default #000000."),
  fontSize: num("Font size in px.", "14", 1),
  fontWeight: oneOf(["100", "200", "300", "400", "500", "600", "700", "800", "900"], "Font weight.", "400"),
  fontFamily: { type: { kind: "fontFamily" }, doc: "A bundled family or one declared with `defineFont`.", default: '"Inter"' },
  italic: bool("Italic style; slanted synthetically where a font has no italic (e.g. CJK)."),
  letterSpacing: { type: { kind: "number", min: -Infinity }, doc: "Extra space between characters in px.", default: "0" },
  textDecoration: oneOf(["none", "underline", "line-through"], "Line drawn with the text.", '"none"'),
  tabularNums: bool("Equal-width digits, so numbers line up in columns."),
} satisfies Record<string, PropDef>;

interface ElementDef {
  doc: string;
  props: Record<string, PropDef>;
}

export const ELEMENTS: Record<string, ElementDef> = {
  Frame: {
    doc: "Free-form container. Children are positioned absolutely with x/y/right/bottom. Use as the artboard root (fixed width/height).",
    props: { ...box, ...boxPaint, ...radius, ...effects, ...container },
  },
  Row: {
    doc: "Lays children out left to right.",
    props: { ...box, ...boxPaint, ...radius, ...effects, ...container, ...flex },
  },
  Column: {
    doc: "Lays children out top to bottom.",
    props: { ...box, ...boxPaint, ...radius, ...effects, ...container, ...flex },
  },
  Grid: {
    doc: 'Lays children out in cells, left to right then top to bottom. Children stretch to fill their cell unless sized; use `colSpan`/`rowSpan` to span cells.',
    props: {
      ...box,
      ...boxPaint,
      ...radius,
      ...effects,
      ...container,
      columns: {
        type: { kind: "tracks" },
        doc: 'Column count (equal widths), or one entry per column: px, `"1fr"`-style share of the free space, or `"hug"`.',
        required: true,
      },
      rows: { type: { kind: "tracks" }, doc: "Row tracks, same forms as `columns`. Rows hug their content by default." },
      gap: num("Space between cells in px.", "0"),
      columnGap: num("Space between columns in px. Defaults to `gap`."),
      rowGap: num("Space between rows in px. Defaults to `gap`."),
      align: oneOf(["start", "center", "end", "stretch"], "Vertical alignment of children within their cells.", '"stretch"'),
      justify: oneOf(["start", "center", "end", "stretch"], "Horizontal alignment of children within their cells.", '"stretch"'),
    },
  },
  Text: {
    doc: 'Text. Hugs its content on one line by default; set width (px or "fill") to make it wrap. Children are strings, numbers and <Span>s.',
    props: {
      ...box,
      ...textStyle,
      lineHeight: num("Line height in px. Defaults to the font's natural line height (about 1.2x fontSize).", undefined, 1),
      textAlign: oneOf(["left", "center", "right"], "Horizontal alignment of lines within the text box.", '"left"'),
      maxLines: int("Cut the text after this many lines and end it with an ellipsis."),
      shadow: shadowProp,
      children: { type: { kind: "children", of: "runs" }, doc: "The text: strings, numbers and <Span> elements." },
    },
  },
  Span: {
    doc: "A styled run inside a <Text>, e.g. `<Text>Total <Span fontWeight={700}>¥28</Span></Text>`. Inherits the Text's style and overrides what it sets. Not a layer: it has no box.",
    props: {
      ...textStyle,
      children: { type: { kind: "children", of: "text" }, doc: "The text: strings and numbers only." },
    },
  },
  Rect: {
    doc: "Rectangle. Has no content, so give it a size.",
    props: { ...box, ...boxPaint, ...radius, ...effects },
  },
  Ellipse: {
    doc: "Ellipse inscribed in its box. Equal width and height make a circle.",
    props: {
      ...box,
      fill: fillProp,
      stroke: strokeProp,
      strokeWidth: num("Border width in px.", "1"),
      strokeAlign: boxPaint.strokeAlign,
      strokeDash,
      ...effects,
    },
  },
  Image: {
    doc: 'Bitmap image imported from a file: `import photo from "./photo.jpg"` then `<Image src={photo} width={120} />`. Keeps its aspect ratio when only one side is set. Without `src` it draws a placeholder.',
    props: {
      ...box,
      src: { type: { kind: "image" }, doc: "An imported .png, .jpg, .webp or .gif file." },
      fit: oneOf(["cover", "contain", "fill"], "How the image fills its box: crop to cover, letterbox to contain, or stretch.", '"cover"'),
      ...boxPaint,
      fill: { type: { kind: "fill" }, doc: "Background behind the image (visible with fit=\"contain\" or a transparent image)." },
      ...radius,
      ...effects,
    },
  },
  Path: {
    doc: 'SVG vector path. Set `viewBox` to scale path coordinates into `width`/`height`, or omit `viewBox` to draw in local px (hugging bounds by default). Draws `fill` and/or `stroke` when specified. Also the way to draw icons: paste the icon\'s path data with `viewBox="0 0 24 24"`.',
    props: {
      ...box,
      d: { type: { kind: "string" }, doc: 'SVG path data string (e.g. `"M 4 12 L 10 18 L 20 6"`).', required: true },
      viewBox: {
        type: { kind: "viewBox" },
        doc: 'Coordinate system `[minX, minY, width, height]` or `"minX minY width height"` mapped into the box.',
      },
      fill: fillProp,
      stroke: strokeProp,
      strokeWidth: num("Stroke width in px.", "1"),
      strokeCap: oneOf(["butt", "round", "square"], "Line cap style for open subpaths.", '"butt"'),
      strokeJoin: oneOf(["miter", "round", "bevel"], "Corner join style for stroked vertices.", '"miter"'),
      strokeDash,
      fillRule: oneOf(["nonzero", "evenodd"], "Interior winding rule when `fill` is set.", '"nonzero"'),
      ...effects,
    },
  },
};

// fontWeight is written as a number in JSX.
const NUMERIC_ENUMS = new Set(["fontWeight"]);

// Props an agent is likely to reach for, mapped to what we actually support.
const HINTS: Record<string, string> = {
  flex: 'use width="fill" or height="fill", and `grow` for unequal shares',
  flexGrow: 'use width/height="fill" with `grow`',
  flexWrap: "use `wrap`",
  alignment: "use `align` (cross axis) and `justify` (main axis)",
  alignItems: "use `align`",
  justifyContent: "use `justify`",
  background: "use `fill`",
  backgroundColor: "use `fill`",
  backgroundImage: 'use `fill={{ type: "linear", stops: [...] }}` for a gradient, or an <Image> child for a picture',
  gradient: 'use `fill={{ type: "linear", angle: 180, stops: ["#fff", "#000"] }}`',
  borderRadius: "use `cornerRadius`",
  radius: "use `cornerRadius`",
  border: "use `stroke` and `strokeWidth`",
  borderWidth: "use `strokeWidth` (all or [top, right, bottom, left])",
  borderStyle: "use `strokeDash` for a dashed border",
  borderColor: "use `stroke`",
  boxShadow: "use `shadow` (e.g. shadow={{ y: 4, blur: 12, color: \"rgba(0,0,0,0.12)\" }})",
  dropShadow: "use `shadow`",
  textShadow: "use `shadow`",
  backdropFilter: "use `backdropBlur` (radius in px)",
  blur: "use `backdropBlur` for frosted glass or `shadow={{ blur }}` for drop shadows",
  strokeLinecap: "use `strokeCap`",
  strokeLinejoin: "use `strokeJoin`",
  strokeDasharray: "use `strokeDash`",
  path: "use `d` on <Path>",
  style: "pass style values as individual props",
  className: "there is no CSS; pass style values as individual props",
  direction: "use <Row> or <Column>",
  size: "use `fontSize` for text, `width`/`height` for boxes",
  weight: "use `fontWeight`",
  margin: "there is no margin; use `gap` or `padding` on the parent",
  position: "use `absolute` (inside Row/Column/Grid) or a <Frame> parent",
  top: "use `y`",
  left: "use `x`",
  zIndex: "later siblings paint on top; reorder children instead",
  transform: "use `rotation` (degrees)",
  rotate: "use `rotation` (degrees)",
  alpha: "use `opacity`",
  numberOfLines: "use `maxLines`",
  lineClamp: "use `maxLines`",
  fontStyle: "use `italic`",
  textDecorationLine: "use `textDecoration`",
  fontVariantNumeric: "use `tabularNums`",
  tracking: "use `letterSpacing` (px)",
  objectFit: "use `fit`",
  resizeMode: "use `fit`",
  source: "use `src` with an imported file",
  href: "use `src` with an imported file",
  url: "use `src` with an imported file",
  gridTemplateColumns: "use `columns`",
  gridTemplateRows: "use `rows`",
  gridColumn: "use `colSpan`",
  gridRow: "use `rowSpan`",
  span: "use `colSpan` / `rowSpan`",
};

const ELEMENT_HINTS: Record<string, string> = {
  Circle: "use <Ellipse> with equal width and height",
  Rectangle: "use <Rect>",
  Box: "use <Frame>, <Row> or <Column>",
  View: "use <Frame>, <Row> or <Column>",
  Stack: "use <Row>/<Column>, or `absolute` on a child to layer it on top of the flow",
  Overlay: "use `absolute` on a child of Row/Column, or a <Frame> parent",
  Svg: 'use <Path d="..." viewBox="0 0 24 24" />',
  SVG: 'use <Path d="..." viewBox="0 0 24 24" />',
  Vector: 'use <Path d="..." />',
  Icon: 'there is no icon primitive; draw it with <Path d="..." viewBox="0 0 24 24" /> using the icon\'s path data',
  Img: 'use <Image src={photo} /> with `import photo from "./photo.jpg"`',
  Picture: 'use <Image src={photo} /> with `import photo from "./photo.jpg"`',
  Strong: "use <Span fontWeight={700}> inside <Text>",
  Bold: "use <Span fontWeight={700}> inside <Text>",
  Em: "use <Span italic> inside <Text>",
  Tspan: "use <Span> inside <Text>",
  Table: "use <Grid> with `columns`",
};

export class DslError extends Error {
  source?: string;
  bare: string;
  constructor(message: string, source?: string) {
    super(source ? `${source}: ${message}` : message);
    this.name = "DslError";
    this.bare = message;
    this.source = source;
  }
}

/** Error for `import { Name } from "artboards"` when Name does not exist. */
export function unknownExport(name: string): DslError {
  const hint = ELEMENT_HINTS[name];
  return new DslError(
    `"artboards" has no export \`${name}\`` + (hint ? ` — ${hint}.` : `. Elements: ${Object.keys(ELEMENTS).join(", ")}.`),
  );
}

const INTERNAL = new Set(["key", "ref", "$source"]);
const COLOR = /^(#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]+\))$/i;
const SHADOW_KEYS = new Set(["x", "y", "blur", "spread", "color"]);
const FR = /^\d+(\.\d+)?fr$/;

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isColor = (v: unknown) => typeof v === "string" && COLOR.test(v.trim());

function isShadowObject(v: unknown): boolean {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const obj = v as Record<string, unknown>;
  for (const k of Object.keys(obj)) {
    if (!SHADOW_KEYS.has(k)) return false;
  }
  if (obj.x != null && !isNum(obj.x)) return false;
  if (obj.y != null && !isNum(obj.y)) return false;
  if (obj.blur != null && (!isNum(obj.blur) || obj.blur < 0)) return false;
  if (obj.spread != null && !isNum(obj.spread)) return false;
  if (obj.color != null && !isColor(obj.color)) return false;
  return true;
}

function isStop(s: unknown): boolean {
  if (isColor(s)) return true;
  if (typeof s !== "object" || s === null) return false;
  const o = s as Record<string, unknown>;
  return Object.keys(o).every((k) => k === "color" || k === "position") && isColor(o.color) && (o.position == null || (isNum(o.position) && o.position >= 0 && o.position <= 1));
}

function isGradient(v: unknown): boolean {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const g = v as Record<string, unknown>;
  if (!Array.isArray(g.stops) || g.stops.length < 2 || !g.stops.every(isStop)) return false;
  if (g.type === "linear") {
    return Object.keys(g).every((k) => ["type", "angle", "stops"].includes(k)) && (g.angle == null || isNum(g.angle));
  }
  if (g.type === "radial") {
    const c = g.center;
    return (
      Object.keys(g).every((k) => ["type", "center", "radius", "stops"].includes(k)) &&
      (c == null || (Array.isArray(c) && c.length === 2 && c.every(isNum))) &&
      (g.radius == null || (isNum(g.radius) && g.radius > 0))
    );
  }
  return false;
}

function describe(t: PropType, prop: string): string {
  switch (t.kind) {
    case "number": {
      const range = t.max != null ? ` between ${t.min ?? 0} and ${t.max}` : t.min != null && t.min > -Infinity && t.min !== 0 ? ` of at least ${t.min}` : t.min === 0 ? " (0 or more)" : "";
      return `${t.integer ? "a whole number" : "a number"}${range}`;
    }
    case "size":
      return 'a number, "fill" or "hug"';
    case "color":
      return 'a color like "#2D5A4A", "#2D5A4A80" or "rgba(0, 0, 0, 0.5)"';
    case "fill":
      return 'a color, or a gradient like `{ type: "linear", angle: 180, stops: ["#fff", { color: "#000", position: 1 }] }` or `{ type: "radial", center?: [0.5, 0.5], radius?: 0.5, stops }` with at least two stops';
    case "string":
      return "a string";
    case "boolean":
      return "true or false";
    case "sides":
      return "a number, [vertical, horizontal] or [top, right, bottom, left]";
    case "corners":
      return "a number or [topLeft, topRight, bottomRight, bottomLeft]";
    case "dash":
      return "a positive number or an array of positive numbers";
    case "tracks":
      return 'a column count, or an array of px numbers, "1fr"-style shares and "hug"';
    case "image":
      return 'an imported image file (`import photo from "./photo.jpg"`)';
    case "fontFamily":
      return `one of ${knownFamilies().map((f) => JSON.stringify(f)).join(", ")} (declare others with \`defineFont\`)`;
    case "shadow":
      return 'a shadow `{ x?, y?, blur?, spread?, color? }` or array of shadows';
    case "viewBox":
      return '`[minX, minY, width, height]` or `"minX minY width height"` with positive width and height';
    case "enum":
      return `one of ${t.values.map((v) => (NUMERIC_ENUMS.has(prop) ? v : JSON.stringify(v))).join(", ")}`;
    case "children":
      return t.of === "text" ? "strings or numbers" : t.of === "runs" ? "strings, numbers or <Span> elements" : "elements";
  }
}

function matches(t: PropType, v: unknown, prop: string): boolean {
  switch (t.kind) {
    case "number":
      return isNum(v) && v >= (t.min ?? 0) && (t.max == null || v <= t.max) && (!t.integer || Number.isInteger(v));
    case "size":
      return (isNum(v) && v >= 0) || v === "fill" || v === "hug";
    case "color":
      return isColor(v);
    case "fill":
      return isColor(v) || isGradient(v);
    case "string":
      return typeof v === "string";
    case "boolean":
      return typeof v === "boolean";
    case "sides":
      return (isNum(v) && v >= 0) || (Array.isArray(v) && (v.length === 2 || v.length === 4) && v.every((n) => isNum(n) && n >= 0));
    case "corners":
      return (isNum(v) && v >= 0) || (Array.isArray(v) && v.length === 4 && v.every((n) => isNum(n) && n >= 0));
    case "dash":
      return (isNum(v) && v > 0) || (Array.isArray(v) && v.length > 0 && v.every((n) => isNum(n) && n >= 0) && v.some((n) => n > 0));
    case "tracks":
      return (
        (isNum(v) && Number.isInteger(v) && v >= 1) ||
        (Array.isArray(v) && v.length > 0 && v.every((x) => (isNum(x) && x >= 0) || x === "hug" || (typeof x === "string" && FR.test(x))))
      );
    case "image":
      return isAssetRef(v) && v.$asset === "image";
    case "fontFamily":
      return typeof v === "string" && knownFamilies().includes(v);
    case "shadow":
      return isShadowObject(v) || (Array.isArray(v) && v.every(isShadowObject));
    case "viewBox":
      return parseViewBox(v) !== null;
    case "enum":
      return t.values.includes(NUMERIC_ENUMS.has(prop) ? String(v) : (v as string)) && (NUMERIC_ENUMS.has(prop) || typeof v === "string");
    case "children":
      return true; // structure is enforced by the reconciler
  }
}

export function validateProps(type: string, props: Record<string, any>) {
  const def = ELEMENTS[type];
  const src = props.$source;
  if (!def) {
    const hint = ELEMENT_HINTS[type];
    throw new DslError(
      `Unknown element <${type}>` + (hint ? ` — ${hint}.` : `. Available: ${Object.keys(ELEMENTS).join(", ")}.`),
      src,
    );
  }
  for (const [key, value] of Object.entries(props)) {
    if (INTERNAL.has(key)) continue;
    const prop = def.props[key];
    if (!prop) {
      const hint = HINTS[key];
      throw new DslError(
        `Unknown prop \`${key}\` on <${type}>` + (hint ? ` — ${hint}.` : `. Allowed: ${Object.keys(def.props).join(", ")}.`),
        src,
      );
    }
    if (value == null) continue;
    if (!matches(prop.type, value, key)) {
      throw new DslError(
        `\`${key}\` on <${type}> must be ${describe(prop.type, key)}, got ${JSON.stringify(value)}.`,
        src,
      );
    }
  }
  for (const [key, prop] of Object.entries(def.props)) {
    if (prop.required && props[key] == null) {
      throw new DslError(`Missing required prop \`${key}\` on <${type}>.`, src);
    }
  }
}

// ---------------------------------------------------------------- generators

function tsType(t: PropType, prop: string): string {
  switch (t.kind) {
    case "number":
      return "number";
    case "size":
      return "Size";
    case "color":
      return "Color";
    case "fill":
      return "Fill";
    case "string":
      return "string";
    case "boolean":
      return "boolean";
    case "sides":
      return "Sides";
    case "corners":
      return "Corners";
    case "dash":
      return "number | number[]";
    case "tracks":
      return "number | Track[]";
    case "image":
      return "ImageAsset";
    case "fontFamily":
      return "FontFamily";
    case "shadow":
      return "Shadow | Shadow[]";
    case "viewBox":
      return "ViewBox";
    case "enum":
      return t.values.map((v) => (NUMERIC_ENUMS.has(prop) ? v : JSON.stringify(v))).join(" | ");
    case "children":
      return t.of === "text" ? "TextContent | TextContent[]" : "ReactNode";
  }
}

const HOOKS = "useState, useEffect, useMemo, useRef, useCallback, Fragment";
const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
const FONT_EXTS = [".woff2", ".ttf", ".otf"];

export function generateDts(): string {
  const out: string[] = [
    "// Generated from src/shared/dsl/schema.ts by `artboards types`. Do not edit.",
    "",
    'declare module "artboards" {',
    '  import type { ReactNode } from "react";',
    `  export { ${HOOKS} } from "react";`,
    "",
    '  /** Fixed px, "fill" (take available space) or "hug" (fit content). */',
    '  export type Size = number | "fill" | "hug";',
    '  /** "#rgb", "#rrggbb", "#rrggbbaa", "rgb(...)" or "rgba(...)". */',
    "  export type Color = string;",
    "  /** A color, or a stop at a position 0..1 along the gradient (missing positions spread evenly). */",
    "  export type GradientStop = Color | { color: Color; position?: number };",
    "  export interface LinearGradient {",
    '    type: "linear";',
    "    /** CSS-style direction in degrees: 0 = to top, 90 = to right, 180 = to bottom. Default 180. */",
    "    angle?: number;",
    "    stops: GradientStop[];",
    "  }",
    "  export interface RadialGradient {",
    '    type: "radial";',
    "    /** Centre as fractions of the box. Default [0.5, 0.5]. */",
    "    center?: [number, number];",
    "    /** Radius as a fraction of the box size; an ellipse in a non-square box. Default 0.5. */",
    "    radius?: number;",
    "    stops: GradientStop[];",
    "  }",
    "  export type Gradient = LinearGradient | RadialGradient;",
    "  /** A color or a gradient. */",
    "  export type Fill = Color | Gradient;",
    "  /** all | [vertical, horizontal] | [top, right, bottom, left] */",
    "  export type Sides = number | [number, number] | [number, number, number, number];",
    "  export type Padding = Sides;",
    "  /** all | [topLeft, topRight, bottomRight, bottomLeft] */",
    "  export type Corners = number | [number, number, number, number];",
    '  /** A grid track: px, a `"1fr"`-style share of the free space, or `"hug"` (fit content). */',
    '  export type Track = number | `${number}fr` | "hug";',
    "  export interface Shadow {",
    "    /** Horizontal offset in px. Default 0. */",
    "    x?: number;",
    "    /** Vertical offset in px. Default 0. */",
    "    y?: number;",
    "    /** Blur radius in px. Default 0. */",
    "    blur?: number;",
    "    /** Spread distance in px. Default 0. */",
    "    spread?: number;",
    '    /** Shadow color. Default "rgba(0, 0, 0, 0.25)". */',
    "    color?: Color;",
    "  }",
    '  /** `[minX, minY, width, height]` or `"minX minY width height"`. */',
    "  export type ViewBox = string | [number, number, number, number];",
    "  export type TextContent = string | number | null | undefined | false;",
    "  /** What importing an image file gives you. */",
    '  export interface ImageAsset { readonly $asset: "image"; readonly id: string; readonly file: string }',
    "  /** What importing a font file gives you; pass it to `defineFont`. */",
    '  export interface FontAsset { readonly $asset: "font"; readonly id: string; readonly file: string }',
    `  /** Bundled families, or a name declared with \`defineFont\`. */`,
    `  export type FontFamily = ${builtinFamilies().map((f) => JSON.stringify(f)).join(" | ")} | (string & {});`,
    "  export interface FontFaceSource {",
    "    src: FontAsset;",
    "    /** Weight this file provides. Default 400. */",
    "    weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;",
    "    /** Whether this file is the italic style. Default false. */",
    "    italic?: boolean;",
    "  }",
    "  /**",
    "   * Declares a font family from imported files and returns its name for `fontFamily`.",
    "   * Characters the files lack fall back to the bundled fonts.",
    "   * @example",
    '   * import regular from "./fonts/Brand-Regular.woff2";',
    '   * import bold from "./fonts/Brand-Bold.woff2";',
    '   * const Brand = defineFont("Brand", [{ src: regular, weight: 400 }, { src: bold, weight: 700 }]);',
    "   */",
    "  export function defineFont(name: string, faces: FontAsset | FontFaceSource[]): string;",
    "",
    "  /** A value a variant can take. */",
    "  export type VariantValue = string | number | boolean;",
    "  /**",
    "   * A named state of the artboard that reviewers can switch between (the viewer, or",
    "   * `--variant name=value` on the command line). Returns the value and a setter, like",
    "   * useState. Calls with the same name in one artboard share one value.",
    "   * @param initial Defaults to the first option.",
    "   * @example",
    '   * const [step, setStep] = useVariant("Step", [0, 1, 2, 3], 1);',
    "   */",
    "  export function useVariant<const T extends VariantValue>(name: string, options: readonly T[], initial?: NoInfer<T>): [T, (value: T) => void];",
  ];
  for (const [name, el] of Object.entries(ELEMENTS)) {
    out.push("", `  export interface ${name}Props {`);
    for (const [prop, def] of Object.entries(el.props)) {
      const doc = def.default ? `${def.doc} Default ${def.default}.` : def.doc;
      const opt = def.required ? "" : "?";
      out.push(`    /** ${doc} */`, `    ${prop}${opt}: ${tsType(def.type, prop)};`);
    }
    out.push("  }", `  /** ${el.doc} */`, `  export function ${name}(props: ${name}Props): ReactNode;`);
  }
  out.push(
    "}",
    "",
    'declare module "artboards/jsx-runtime" {',
    '  import type { Key, ReactNode } from "react";',
    "  export namespace JSX {",
    "    type Element = ReactNode;",
    "    type ElementType = (props: any) => ReactNode;",
    "    interface ElementChildrenAttribute { children: {} }",
    "    interface IntrinsicAttributes { key?: Key | null }",
    "    // No lowercase tags: there is no DOM.",
    "    interface IntrinsicElements {}",
    "  }",
    "}",
  );
  for (const ext of IMAGE_EXTS) {
    out.push("", `declare module "*${ext}" {`, '  const asset: import("artboards").ImageAsset;', "  export default asset;", "}");
  }
  for (const ext of FONT_EXTS) {
    out.push("", `declare module "*${ext}" {`, '  const asset: import("artboards").FontAsset;', "  export default asset;", "}");
  }
  out.push("");
  return out.join("\n");
}

export function generateDocs(): string {
  const out: string[] = [
    "# Artboards DSL",
    "",
    "A design file is a JSX/TSX module. Every exported component of the file you pass to the CLI is an",
    "artboard and must return a single root element, normally a <Frame> with a fixed width and height.",
    "Components that are not exported are reusable pieces. Props are plain function arguments.",
    "Split larger designs across files with relative imports (`import { Button } from \"./components.jsx\"`).",
    "",
    "```jsx",
    'import { Column, Frame, Row, Text } from "artboards";',
    "",
    "export default function Home() {",
    "  return (",
    '    <Frame width={390} height={844} fill="#ffffff">',
    '      <Column width="fill" height="fill" padding={16} gap={12} align="stretch">',
    "        <Text fontSize={24} fontWeight={700}>Title</Text>",
    '        <Row height={44} padding={[0, 12]} align="center" justify="space-between" fill="#f3f4f6" cornerRadius={8}>',
    "          <Text>Label</Text>",
    "        </Row>",
    "      </Column>",
    "    </Frame>",
    "  );",
    "}",
    "```",
    "",
    "## Sizing",
    "",
    "- `width` / `height` take a number (px), `\"fill\"` or `\"hug\"` (default).",
    "- `\"fill\"` along a Row/Column's main axis shares the remaining space with other fill siblings, in proportion",
    "  to `grow` (default 1); across it, the element stretches. In a Grid cell it stretches to the cell.",
    "  Inside a <Frame> (or with `absolute`), fill spans the parent minus the x/right (y/bottom) offsets;",
    "  setting both x and right (or y and bottom) without a size does the same.",
    "- `minWidth` / `maxWidth` / `minHeight` / `maxHeight` bound any of these.",
    "- Fixed and hug elements never shrink. If they do not fit, they overflow and `lint` reports it.",
    "- There is no margin and no CSS. Use `gap` and `padding` on the parent.",
    "",
    "## Positioning and layering",
    "",
    "- Children of <Row>/<Column>/<Grid> are placed by their parent. Children of <Frame> are placed by `x`/`y`",
    "  (or `right`/`bottom`) against the frame's outer edges.",
    "- `absolute` takes a child of Row/Column/Grid out of the flow and places it the same way, e.g. a badge:",
    "  `<Ellipse absolute right={-4} y={-4} width={10} height={10} fill=\"#ef4444\" />`.",
    "- Later siblings paint on top of earlier ones. Put overlays (sheets, toasts, badges) last.",
    "- `rotation` and `opacity` only affect painting, never layout.",
    "",
    "## Paint",
    "",
    '- `fill` and `stroke` take a color or a gradient: `{ type: "linear", angle: 135, stops: ["#f97316", "#db2777"] }`,',
    '  `{ type: "radial", center: [0.3, 0.2], radius: 0.8, stops: [...] }`. A stop can be `{ color, position }`.',
    "- Borders: `strokeWidth` per side, `strokeAlign` inside/center/outside, `strokeDash` for dashed lines.",
    "- `cornerRadius` per corner: `[topLeft, topRight, bottomRight, bottomLeft]`, e.g. a bottom sheet `[20, 20, 0, 0]`.",
    "",
    "## Text",
    "",
    "- Mix styles in one paragraph with <Span>: `<Text fontSize={14}>¥<Span fontSize={28} fontWeight={700}>28</Span></Text>`.",
    "- `maxLines` truncates with an ellipsis; give the Text a width.",
    "- Bundled families: " + builtinFamilies().join(", ") + ". Inter and Noto Sans SC also cover characters other families lack.",
    "",
    "## Images and fonts",
    "",
    "Import files next to the design and use the imported value:",
    "",
    "```jsx",
    'import { Image, Text, defineFont } from "artboards";',
    'import latte from "./assets/latte.jpg";',
    'import display from "./fonts/Display-Bold.woff2";',
    "",
    'const Display = defineFont("Display", [{ src: display, weight: 700 }]);',
    "",
    '// <Image src={latte} width={160} fit="cover" cornerRadius={12} />',
    "// <Text fontFamily={Display} fontWeight={700}>Menu</Text>",
    "```",
    "",
    `Images: ${IMAGE_EXTS.join(", ")}. Fonts: ${FONT_EXTS.join(", ")} (static files; a variable font renders at its default instance).`,
    "There are no remote URLs: download a file into the project first. There is no icon element: draw icons",
    'with <Path d="..." viewBox="0 0 24 24" />.',
    "",
    "## Elements",
  ];
  for (const [name, el] of Object.entries(ELEMENTS)) {
    out.push("", `### <${name}>`, "", el.doc, "");
    for (const [prop, def] of Object.entries(el.props)) {
      const type = tsType(def.type, prop).replace("TextContent | TextContent[]", "string | number");
      const req = def.required ? " *(required)*" : "";
      out.push(`- \`${prop}\`: ${type}${def.default ? ` = ${def.default}` : ""}${req} — ${def.doc}`);
    }
  }
  out.push(
    "",
    "## State",
    "",
    `\`${HOOKS}\` are exported from "artboards" and behave as in React.`,
    "",
    "Visual states a reviewer should be able to switch between (loading / empty / error, the step of a",
    "flow, a selected tab) are variants. Declare them in the artboard with `useVariant` and pass the",
    "value down as props:",
    "",
    "```tsx",
    "export function OrderTracking() {",
    '  const [step] = useVariant("Step", [0, 1, 2, 3], 1); // name, options, initial (default: first option)',
    "  return <Phone><Steps current={step} /></Phone>;",
    "}",
    "```",
    "",
    "Options are strings, numbers or booleans. Calls with the same name in one artboard share one value",
    "and must declare the same options. Render another state with `--variant Step=2` (repeatable) on",
    "`render`, `inspect` and `lint`; `inspect` lists each artboard's variants.",
    "",
    "## Commands",
    "",
    "- `artboards lint <file> [--variant name=value]` — type-check, render every artboard, and report layout problems. Run after every edit.",
    "- `artboards render <file> [--frame Name] [--variant name=value] [--scale 2] [-o out.png]` — PNG screenshots (default: `out/`).",
    "- `artboards inspect <file> [--frame Name] [--variant name=value] [--json]` — layer tree with computed bounds, source lines and variants.",
    "- `artboards comments <file>` — open review comments from a human, with the source line of each layer.",
    "  After addressing one, run `artboards comments <file> --resolve <id>`.",
    "- `artboards dev <file>` — start the viewer a human uses to review and comment (long-running).",
    "",
  );
  return out.join("\n");
}
