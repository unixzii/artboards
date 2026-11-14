// Single source of truth for the DSL: runtime validation, the generated
// `types/artboards.d.ts`, and the `artboards docs` reference all come from here.

type PropType =
  | { kind: "number"; min?: number }
  | { kind: "size" }
  | { kind: "color" }
  | { kind: "string" }
  | { kind: "boolean" }
  | { kind: "padding" }
  | { kind: "enum"; values: readonly string[] }
  | { kind: "children"; of: "nodes" | "text" };

interface PropDef {
  type: PropType;
  doc: string;
  default?: string;
}

const num = (doc: string, def?: string, min = 0): PropDef => ({ type: { kind: "number", min }, doc, default: def });
const color = (doc: string): PropDef => ({ type: { kind: "color" }, doc });
const oneOf = (values: readonly string[], doc: string, def: string): PropDef => ({
  type: { kind: "enum", values },
  doc,
  default: def,
});

const box = {
  width: { type: { kind: "size" }, doc: "Fixed px, \"fill\" (take available space) or \"hug\" (fit content).", default: '"hug"' },
  height: { type: { kind: "size" }, doc: "Fixed px, \"fill\" or \"hug\".", default: '"hug"' },
  x: { type: { kind: "number", min: -Infinity }, doc: "Left offset in px. Only applies when the parent is a <Frame>.", default: "0" },
  y: { type: { kind: "number", min: -Infinity }, doc: "Top offset in px. Only applies when the parent is a <Frame>.", default: "0" },
  name: { type: { kind: "string" }, doc: "Layer name shown in inspect output and diagnostics." },
} satisfies Record<string, PropDef>;

const paint = {
  fill: color("Background color."),
  stroke: color("Border color."),
  strokeWidth: num("Border width in px.", "1"),
} satisfies Record<string, PropDef>;

const radius = { cornerRadius: num("Corner radius in px.", "0") } satisfies Record<string, PropDef>;

const container = {
  padding: { type: { kind: "padding" }, doc: "Inner spacing: all | [vertical, horizontal] | [top, right, bottom, left].", default: "0" },
  clip: { type: { kind: "boolean" }, doc: "Clip children to this element's bounds.", default: "false" },
  children: { type: { kind: "children", of: "nodes" }, doc: "Child elements." },
} satisfies Record<string, PropDef>;

const flex = {
  gap: num("Space between children in px.", "0"),
  align: oneOf(["start", "center", "end", "stretch"], "Cross-axis alignment of children.", '"start"'),
  justify: oneOf(["start", "center", "end", "space-between"], "Main-axis distribution of children.", '"start"'),
} satisfies Record<string, PropDef>;

interface ElementDef {
  doc: string;
  props: Record<string, PropDef>;
}

export const ELEMENTS: Record<string, ElementDef> = {
  Frame: {
    doc: "Free-form container. Children are positioned absolutely with x/y. Use as the artboard root (fixed width/height).",
    props: { ...box, ...paint, ...radius, ...container },
  },
  Row: {
    doc: "Lays children out left to right.",
    props: { ...box, ...paint, ...radius, ...container, ...flex },
  },
  Column: {
    doc: "Lays children out top to bottom.",
    props: { ...box, ...paint, ...radius, ...container, ...flex },
  },
  Text: {
    doc: 'Text. Hugs its content on one line by default; set width (px or "fill") to make it wrap.',
    props: {
      ...box,
      color: color("Text color. Default #000000."),
      fontSize: num("Font size in px.", "14", 1),
      fontWeight: oneOf(["100", "200", "300", "400", "500", "600", "700", "800", "900"], "Font weight.", "400"),
      lineHeight: num("Line height in px. Defaults to the font's natural line height (about 1.2x fontSize).", undefined, 1),
      textAlign: oneOf(["left", "center", "right"], "Horizontal alignment of lines within the text box.", '"left"'),
      children: { type: { kind: "children", of: "text" }, doc: "The text: strings and numbers only." },
    },
  },
  Rect: {
    doc: "Rectangle. Has no content, so give it a size.",
    props: { ...box, ...paint, ...radius },
  },
  Ellipse: {
    doc: "Ellipse inscribed in its box. Equal width and height make a circle.",
    props: { ...box, ...paint },
  },
};

// fontWeight is written as a number in JSX.
const NUMERIC_ENUMS = new Set(["fontWeight"]);

// Props an agent is likely to reach for, mapped to what we actually support.
const HINTS: Record<string, string> = {
  flex: 'use width="fill" or height="fill"',
  alignment: "use `align` (cross axis) and `justify` (main axis)",
  alignItems: "use `align`",
  justifyContent: "use `justify`",
  background: "use `fill`",
  backgroundColor: "use `fill`",
  borderRadius: "use `cornerRadius`",
  radius: "use `cornerRadius`",
  border: "use `stroke` and `strokeWidth`",
  style: "pass style values as individual props",
  className: "there is no CSS; pass style values as individual props",
  direction: "use <Row> or <Column>",
  size: "use `fontSize` for text, `width`/`height` for boxes",
  weight: "use `fontWeight`",
  margin: "there is no margin; use `gap` or `padding` on the parent",
};

const ELEMENT_HINTS: Record<string, string> = {
  Circle: "use <Ellipse> with equal width and height",
  Rectangle: "use <Rect>",
  Box: "use <Frame>, <Row> or <Column>",
  View: "use <Frame>, <Row> or <Column>",
  Stack: "use <Row> or <Column>",
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

function describe(t: PropType, prop: string): string {
  switch (t.kind) {
    case "number":
      return "a number";
    case "size":
      return 'a number, "fill" or "hug"';
    case "color":
      return 'a color like "#2D5A4A", "#2D5A4A80" or "rgba(0, 0, 0, 0.5)"';
    case "string":
      return "a string";
    case "boolean":
      return "true or false";
    case "padding":
      return "a number, [vertical, horizontal] or [top, right, bottom, left]";
    case "enum":
      return `one of ${t.values.map((v) => (NUMERIC_ENUMS.has(prop) ? v : JSON.stringify(v))).join(", ")}`;
    case "children":
      return t.of === "text" ? "strings or numbers" : "elements";
  }
}

function matches(t: PropType, v: unknown, prop: string): boolean {
  const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
  switch (t.kind) {
    case "number":
      return isNum(v) && v >= (t.min ?? 0);
    case "size":
      return (isNum(v) && v >= 0) || v === "fill" || v === "hug";
    case "color":
      return typeof v === "string" && COLOR.test(v.trim());
    case "string":
      return typeof v === "string";
    case "boolean":
      return typeof v === "boolean";
    case "padding":
      return (isNum(v) && v >= 0) || (Array.isArray(v) && (v.length === 2 || v.length === 4) && v.every((n) => isNum(n) && n >= 0));
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
    case "string":
      return "string";
    case "boolean":
      return "boolean";
    case "padding":
      return "Padding";
    case "enum":
      return t.values.map((v) => (NUMERIC_ENUMS.has(prop) ? v : JSON.stringify(v))).join(" | ");
    case "children":
      return t.of === "text" ? "TextContent | TextContent[]" : "ReactNode";
  }
}

const HOOKS = "useState, useEffect, useMemo, useRef, useCallback, Fragment";

export function generateDts(): string {
  const out: string[] = [
    "// Generated from src/schema.ts by `artboards types`. Do not edit.",
    "",
    'declare module "artboards" {',
    '  import type { ReactNode } from "react";',
    `  export { ${HOOKS} } from "react";`,
    "",
    '  /** Fixed px, "fill" (take available space) or "hug" (fit content). */',
    '  export type Size = number | "fill" | "hug";',
    '  /** "#rgb", "#rrggbb", "#rrggbbaa", "rgb(...)" or "rgba(...)". */',
    "  export type Color = string;",
    "  /** all | [vertical, horizontal] | [top, right, bottom, left] */",
    "  export type Padding = number | [number, number] | [number, number, number, number];",
    "  export type TextContent = string | number | null | undefined | false;",
  ];
  for (const [name, el] of Object.entries(ELEMENTS)) {
    out.push("", `  export interface ${name}Props {`);
    for (const [prop, def] of Object.entries(el.props)) {
      const doc = def.default ? `${def.doc} Default ${def.default}.` : def.doc;
      out.push(`    /** ${doc} */`, `    ${prop}?: ${tsType(def.type, prop)};`);
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
    "",
  );
  return out.join("\n");
}

export function generateDocs(): string {
  const out: string[] = [
    "# Artboards DSL",
    "",
    "A design file is a JSX/TSX module. Every exported component of the file you pass to the CLI is an",
    "artboard and must return a single root element, normally a <Frame> with a fixed width and height.",
    "Components that are not exported are reusable pieces. Props are plain function arguments.",
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
    "- `\"fill\"` along a Row/Column's main axis shares the remaining space equally with other fill siblings;",
    "  across it, the element stretches. Inside a <Frame>, fill means 100% of the frame.",
    "- Fixed and hug elements never shrink. If they do not fit, they overflow and `lint` reports it.",
    "- There is no margin and no CSS. Use `gap` and `padding` on the parent.",
    "- Children of <Row>/<Column> ignore `x`/`y`; children of <Frame> are placed by `x`/`y`.",
    "",
    "## Elements",
  ];
  for (const [name, el] of Object.entries(ELEMENTS)) {
    out.push("", `### <${name}>`, "", el.doc, "");
    for (const [prop, def] of Object.entries(el.props)) {
      const type = tsType(def.type, prop).replace("TextContent | TextContent[]", "string | number");
      out.push(`- \`${prop}\`: ${type}${def.default ? ` = ${def.default}` : ""} — ${def.doc}`);
    }
  }
  out.push(
    "",
    "## State",
    "",
    `\`${HOOKS}\` are exported from "artboards" and behave as in React.`,
    "",
    "## Commands",
    "",
    "- `artboards lint <file>` — type-check, render every artboard, and report layout problems. Run after every edit.",
    "- `artboards render <file> [--frame Name] [--scale 2] [-o out.png]` — PNG screenshots (default: `out/`).",
    "- `artboards inspect <file> [--frame Name] [--json]` — layer tree with computed bounds and source lines.",
    "- `artboards comments <file>` — open review comments from a human, with the source line of each layer.",
    "  After addressing one, run `artboards comments <file> --resolve <id>`.",
    "- `artboards dev <file>` — start the viewer a human uses to review and comment (long-running).",
    "",
  );
  return out.join("\n");
}
