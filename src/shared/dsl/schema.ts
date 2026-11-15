// Single source of truth for the DSL's elements and props: runtime validation
// and the element part of `types/artboards.d.ts` (see src/cli/docs.ts) come from here.

import { knownFamilies } from "../fonts.ts";
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
  | { kind: "handler" }
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

const ALIGN = ["start", "center", "end", "stretch"] as const;
const WEIGHTS = ["100", "200", "300", "400", "500", "600", "700", "800", "900"] as const;

const box = {
  width: { type: { kind: "size" }, doc: "Width.", default: '"hug"' },
  height: { type: { kind: "size" }, doc: "Height.", default: '"hug"' },
  minWidth: num("Lower bound on the width in px."),
  maxWidth: num("Upper bound on the width in px."),
  minHeight: num("Lower bound on the height in px."),
  maxHeight: num("Upper bound on the height in px."),
  grow: num('Share of the free space a `"fill"` child takes along its Row/Column, relative to its fill siblings.', "1"),
  alignSelf: oneOf(ALIGN, "Overrides the parent's `align` for this child."),
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
  onClick: {
    type: { kind: "handler" },
    doc: "Runs when a reviewer clicks this layer in the viewer's Play mode (the innermost layer with a handler wins). Update state here: `useState`, or a variant setter so the state can also be picked without clicking.",
  },
} satisfies Record<string, PropDef>;

const shadowProp: PropDef = {
  type: { kind: "shadow" },
  doc: "One drop shadow or several.",
};

const paint = {
  fill: { type: { kind: "fill" }, doc: "Background (or shape) color or gradient." },
  stroke: { type: { kind: "fill" }, doc: "Border color or gradient." },
  strokeDash: { type: { kind: "dash" }, doc: "Dashed border: dash length, or `[dash, gap, ...]` in px. Needs a single strokeWidth." },
  shadow: shadowProp,
  backdropBlur: num("Frosted-glass blur radius in px applied to content behind this element.", "0"),
} satisfies Record<string, PropDef>;

const border = {
  strokeWidth: { type: { kind: "sides" }, doc: "Border width in px, per side.", default: "1" },
  strokeAlign: oneOf(["inside", "center", "outside"], "Where the border sits relative to the edge.", '"center"'),
  cornerRadius: { type: { kind: "corners" }, doc: "Corner radius in px, per corner.", default: "0" },
} satisfies Record<string, PropDef>;

const container = {
  padding: { type: { kind: "sides" }, doc: "Inner spacing in px, per side.", default: "0" },
  clip: bool("Clip children to this element's bounds."),
  scroll: oneOf(
    ["vertical", "horizontal", "both"],
    "Lets reviewers scroll content that overflows this container, in the viewer's Play mode. Clips like `clip`. Needs a fixed or \"fill\" size along the scrolled axis; screenshots show the start of the content.",
  ),
  children: { type: { kind: "children", of: "nodes" }, doc: "Child elements." },
} satisfies Record<string, PropDef>;

const flex = {
  gap: num("Space between children in px.", "0"),
  align: oneOf(ALIGN, "Cross-axis alignment of children.", '"start"'),
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
  fontWeight: oneOf(WEIGHTS, "Font weight.", "400"),
  fontFamily: { type: { kind: "fontFamily" }, doc: "A bundled family or one declared with `defineFont`.", default: '"Inter"' },
  italic: bool("Italic style; slanted synthetically where a font has no italic (e.g. CJK)."),
  letterSpacing: { type: { kind: "number", min: -Infinity }, doc: "Extra space between characters in px.", default: "0" },
  textDecoration: oneOf(["none", "underline", "line-through"], "Line drawn with the text.", '"none"'),
  tabularNums: bool("Equal-width digits, so numbers line up in columns."),
} satisfies Record<string, PropDef>;

/** Prop sets shared by several elements; the .d.ts declares each once as `<Name>Props`. */
const GROUPS = {
  Layer: { doc: "Props every element but <Span> takes: size, placement, opacity, rotation, name and onClick.", props: box },
  Paint: { doc: "Fill, border paint and effects of a shape.", props: paint },
  Border: { doc: "Border geometry of a rectangular box.", props: border },
  Container: { doc: "Props of an element that holds child elements.", props: container },
  Flex: { doc: "How a <Row> or <Column> arranges its children.", props: flex },
  TextStyle: { doc: "Character style shared by <Text> and <Span>.", props: textStyle },
} satisfies Record<string, { doc: string; props: Record<string, PropDef> }>;

type GroupName = keyof typeof GROUPS;

interface ElementDef {
  doc: string;
  groups: GroupName[];
  /** Props only this element takes. */
  own: Record<string, PropDef>;
  /** Every prop it accepts: its groups' and its own. */
  props: Record<string, PropDef>;
}

function element(doc: string, groups: GroupName[], own: Record<string, PropDef> = {}): ElementDef {
  return { doc, groups, own, props: Object.assign({}, ...groups.map((g) => GROUPS[g].props), own) };
}

export const ELEMENTS: Record<string, ElementDef> = {
  Frame: element(
    "Free-form container. Children are positioned absolutely with x/y/right/bottom. Use as the artboard root (fixed width/height).",
    ["Layer", "Paint", "Border", "Container"],
  ),
  Row: element("Lays children out left to right.", ["Layer", "Paint", "Border", "Container", "Flex"]),
  Column: element("Lays children out top to bottom.", ["Layer", "Paint", "Border", "Container", "Flex"]),
  Grid: element(
    "Lays children out in cells, left to right then top to bottom. Children stretch to fill their cell unless sized; use `colSpan`/`rowSpan` to span cells.",
    ["Layer", "Paint", "Border", "Container"],
    {
      columns: {
        type: { kind: "tracks" },
        doc: 'Column count (equal widths), or one entry per column: px, `"1fr"`-style share of the free space, or `"hug"`.',
        required: true,
      },
      rows: { type: { kind: "tracks" }, doc: "Row tracks, same forms as `columns`. Rows hug their content by default." },
      gap: num("Space between cells in px.", "0"),
      columnGap: num("Space between columns in px. Defaults to `gap`."),
      rowGap: num("Space between rows in px. Defaults to `gap`."),
      align: oneOf(ALIGN, "Vertical alignment of children within their cells.", '"stretch"'),
      justify: oneOf(ALIGN, "Horizontal alignment of children within their cells.", '"stretch"'),
    },
  ),
  Text: element(
    'Text. Hugs its content on one line by default; set width (px or "fill") to make it wrap. Children are strings, numbers and <Span>s.',
    ["Layer", "TextStyle"],
    {
      lineHeight: num("Line height in px. Defaults to the font's natural line height (about 1.2x fontSize).", undefined, 1),
      textAlign: oneOf(["left", "center", "right"], "Horizontal alignment of lines within the text box.", '"left"'),
      maxLines: int("Cut the text after this many lines and end it with an ellipsis."),
      shadow: shadowProp,
      children: { type: { kind: "children", of: "runs" }, doc: "The text: strings, numbers and <Span> elements." },
    },
  ),
  Span: element(
    "A styled run inside a <Text>, e.g. `<Text>Total <Span fontWeight={700}>¥28</Span></Text>`. Inherits the Text's style and overrides what it sets. Not a layer: it has no box.",
    ["TextStyle"],
    { children: { type: { kind: "children", of: "text" }, doc: "The text: strings and numbers only." } },
  ),
  Rect: element("Rectangle. Has no content, so give it a size.", ["Layer", "Paint", "Border"]),
  Ellipse: element("Ellipse inscribed in its box. Equal width and height make a circle.", ["Layer", "Paint"], {
    strokeWidth: num("Border width in px.", "1"),
    strokeAlign: border.strokeAlign,
  }),
  Image: element(
    'Bitmap image imported from a file: `import photo from "./photo.jpg"` then `<Image src={photo} width={120} />`. Keeps its aspect ratio when only one side is set. Without `src` it draws a placeholder. `fill` shows behind it (with fit="contain" or a transparent image).',
    ["Layer", "Paint", "Border"],
    {
      src: { type: { kind: "image" }, doc: "An imported .png, .jpg, .webp or .gif file." },
      fit: oneOf(["cover", "contain", "fill"], "How the image fills its box: crop to cover, letterbox to contain, or stretch.", '"cover"'),
    },
  ),
  Path: element(
    'SVG vector path. Set `viewBox` to scale path coordinates into `width`/`height`, or omit `viewBox` to draw in local px (hugging bounds by default). Draws `fill` and/or `stroke` when specified. Also the way to draw icons: paste the icon\'s path data with `viewBox="0 0 24 24"`.',
    ["Layer", "Paint"],
    {
      d: { type: { kind: "string" }, doc: 'SVG path data string (e.g. `"M 4 12 L 10 18 L 20 6"`).', required: true },
      viewBox: {
        type: { kind: "viewBox" },
        doc: 'Coordinate system `[minX, minY, width, height]` or `"minX minY width height"` mapped into the box.',
      },
      strokeWidth: num("Stroke width in px.", "1"),
      strokeCap: oneOf(["butt", "round", "square"], "Line cap style for open subpaths.", '"butt"'),
      strokeJoin: oneOf(["miter", "round", "bevel"], "Corner join style for stroked vertices.", '"miter"'),
      fillRule: oneOf(["nonzero", "evenodd"], "Interior winding rule when `fill` is set.", '"nonzero"'),
    },
  ),
};

// fontWeight is written as a number in JSX.
const NUMERIC_ENUMS = new Set(["fontWeight"]);

// Props an agent is likely to reach for, mapped to what we actually support.
export const HINTS: Record<string, string> = {
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

export const ELEMENT_HINTS: Record<string, string> = {
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
    case "handler":
      return "a function";
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
    case "handler":
      return typeof v === "function";
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

/** Enums the .d.ts names once instead of spelling out at every prop. */
const ENUM_ALIASES = new Map<readonly string[], string>([
  [ALIGN, "Align"],
  [WEIGHTS, "FontWeight"],
]);

function tsType(t: PropType, prop: string): string {
  if (t.kind === "enum" && ENUM_ALIASES.has(t.values)) return ENUM_ALIASES.get(t.values)!;
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
    case "handler":
      return "() => void";
    case "enum":
      return t.values.map((v) => (NUMERIC_ENUMS.has(prop) ? v : JSON.stringify(v))).join(" | ");
    case "children":
      return t.of === "text" ? "TextContent | TextContent[]" : "ReactNode";
  }
}

/** The named enums, as declarations inside `declare module "artboards"`. */
export function enumDeclarations(): string {
  return [...ENUM_ALIASES]
    .map(([values, name]) => `  export type ${name} = ${values.map((v) => (values === WEIGHTS ? v : JSON.stringify(v))).join(" | ")};`)
    .join("\n");
}

/** The prop sets and elements, as declarations inside `declare module "artboards"`. */
export function elementDeclarations(): string {
  const out: string[] = [];
  const members = (props: Record<string, PropDef>) =>
    Object.entries(props).flatMap(([prop, def]) => [
      `    /** ${def.default ? `${def.doc} Default ${def.default}.` : def.doc} */`,
      `    ${prop}${def.required ? "" : "?"}: ${tsType(def.type, prop)};`,
    ]);
  out.push("", "  // Prop sets shared by several elements.");
  for (const [name, group] of Object.entries(GROUPS)) {
    out.push(`  /** ${group.doc} */`, `  export interface ${name}Props {`, ...members(group.props), "  }");
  }
  out.push("", "  // Elements. Each takes the props of the sets it extends, plus its own.");
  for (const [name, el] of Object.entries(ELEMENTS)) {
    const head = `  export interface ${name}Props extends ${el.groups.map((g) => `${g}Props`).join(", ")} {`;
    const own = members(el.own);
    out.push("", `  /** ${el.doc} */`, `  export function ${name}(props: ${name}Props): ReactNode;`);
    out.push(...(own.length ? [head, ...own, "  }"] : [`${head}}`]));
  }
  return out.join("\n");
}
