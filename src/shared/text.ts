// Paragraph building and measurement. Platform-free: runs in Node and the browser.

import type { CanvasKit, Paragraph, TypefaceFontProvider } from "canvaskit-wasm";
import { textRunsOf, type PaintableNode } from "./scene.ts";

/** Family used as fallback when no font family resolved. */
export const BASE_FAMILY = "Inter:latin";

export const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/** Nearest weight we ship. */
export function nearestWeight(w: unknown): number {
  const n = Number(w) || 400;
  return WEIGHTS.reduce((best, c) => (Math.abs(c - n) < Math.abs(best - n) ? c : best));
}

export interface FontFace {
  /** Family name the file is registered under. */
  family: string;
  /** Where the dev server serves the file. */
  url: string;
}

export interface FontQuery {
  weight: number;
  italic: boolean;
  /** `fontFamily` as written; the default family when absent. */
  family?: string;
}

export interface FontResolver {
  provider: TypefaceFontProvider;
  /** Preloads the font faces needed for `text` when loading is asynchronous (browser). */
  ensure?(text: string, query: FontQuery): Promise<unknown>;
  /** Makes the glyphs for `text` available and returns the families to use, in priority order. */
  resolve(text: string, query: FontQuery): { families: string[]; missing: string[] };
}

export interface TextEngine {
  ck: CanvasKit;
  fonts: FontResolver;
}

const WEIGHT_NAMES: Record<number, string> = {
  100: "Thin",
  200: "ExtraLight",
  300: "Light",
  400: "Normal",
  500: "Medium",
  600: "SemiBold",
  700: "Bold",
  800: "ExtraBold",
  900: "Black",
};

/** Style props a <Span> can override on its <Text>. */
export const TEXT_STYLE_PROPS = [
  "color",
  "fontSize",
  "fontWeight",
  "fontFamily",
  "italic",
  "letterSpacing",
  "textDecoration",
  "tabularNums",
] as const;

type RunStyle = Partial<Record<(typeof TEXT_STYLE_PROPS)[number], any>>;

function styleOf(props: Record<string, any>): RunStyle {
  const out: RunStyle = {};
  for (const k of TEXT_STYLE_PROPS) if (props[k] != null) out[k] = props[k];
  return out;
}

const queryOf = (s: RunStyle): FontQuery => ({ weight: nearestWeight(s.fontWeight), italic: !!s.italic, family: s.fontFamily });

/** Font queries needed by a Text node (its base line-box style and each styled run). */
export function textQueriesOf(node: PaintableNode): { text: string; query: FontQuery }[] {
  const base = styleOf(node.props);
  const runs = textRunsOf(node);
  return [
    { text: "", query: queryOf(base) },
    ...runs.map((run) => ({ text: run.text, query: queryOf({ ...base, ...styleOf(run.props) }) })),
  ];
}

/** The largest font size in a Text node. */
export function textSizeOf(node: PaintableNode): number {
  const base = node.props.fontSize ?? 14;
  return Math.max(base, ...textRunsOf(node).map((run) => run.props.fontSize ?? base));
}

/** Builds (once) the paragraph for a Text node. Call `releaseParagraphs` when done. */
export function paragraphFor(engine: TextEngine, node: PaintableNode): Paragraph {
  if (node.paragraph) return node.paragraph;
  const { ck } = engine;
  const p = node.props;
  const base = styleOf(p);
  const runs = textRunsOf(node);
  const styles = runs.map((r) => ({ ...base, ...styleOf(r.props) }));

  if (!node.fontFamilies) {
    const missing = new Set<string>();
    node.fontFamilies = engine.fonts.resolve("", queryOf(base)).families;
    runs.forEach((run, i) => {
      const res = engine.fonts.resolve(run.text, queryOf(styles[i]));
      run.fontFamilies = res.families;
      for (const ch of res.missing) missing.add(ch);
    });
    node.missingGlyphs = [...missing];
  }

  const baseSize = base.fontSize ?? 14;
  // The strut forces the line box for every line, so fallback fonts (CJK) with
  // different metrics cannot change it. It is sized for the largest run.
  const strutSize = Math.max(baseSize, ...styles.map((s) => s.fontSize ?? 14));
  const leading = (size: number) => (p.lineHeight ? { heightMultiplier: p.lineHeight / size } : {});
  const textStyle = (s: RunStyle, families: string[] | undefined) => {
    const size = s.fontSize ?? 14;
    const color = ck.parseColorString(s.color ?? "#000000");
    const decoration =
      s.textDecoration === "underline" ? ck.UnderlineDecoration : s.textDecoration === "line-through" ? ck.LineThroughDecoration : ck.NoDecoration;
    return {
      color,
      fontSize: size,
      fontFamilies: families?.length ? families : [BASE_FAMILY],
      fontStyle: {
        weight: (ck.FontWeight as any)[WEIGHT_NAMES[nearestWeight(s.fontWeight)]],
        slant: s.italic ? ck.FontSlant.Italic : ck.FontSlant.Upright,
      },
      letterSpacing: s.letterSpacing ?? 0,
      decoration,
      decorationColor: color,
      decorationThickness: 1,
      fontFeatures: s.tabularNums ? [{ name: "tnum", value: 1 }] : [],
      halfLeading: true,
      ...leading(size),
    };
  };

  const style = new ck.ParagraphStyle({
    textAlign: { left: ck.TextAlign.Left, center: ck.TextAlign.Center, right: ck.TextAlign.Right }[
      (p.textAlign ?? "left") as "left" | "center" | "right"
    ],
    ...(p.maxLines ? { maxLines: p.maxLines, ellipsis: "…" } : {}),
    textStyle: textStyle(base, node.fontFamilies),
    strutStyle: {
      strutEnabled: true,
      forceStrutHeight: true,
      fontFamilies: (node.fontFamilies ?? [BASE_FAMILY]).slice(0, 1),
      fontSize: strutSize,
      fontStyle: { weight: (ck.FontWeight as any)[WEIGHT_NAMES[nearestWeight(base.fontWeight)]] },
      halfLeading: true,
      ...leading(strutSize),
    },
  });
  const builder = ck.ParagraphBuilder.MakeFromFontProvider(style, engine.fonts.provider);
  runs.forEach((run, i) => {
    builder.pushStyle(new ck.TextStyle(textStyle(styles[i], run.fontFamilies)));
    builder.addText(run.text);
    builder.pop();
  });
  node.paragraph = builder.build();
  builder.delete();
  return node.paragraph;
}

export interface Constraint {
  width: number | null | undefined;
  height: number | null | undefined;
}

/** Taffy measure callback body for Text nodes. */
export function measureText(
  engine: TextEngine,
  node: PaintableNode,
  known: Constraint,
  available: { width: number | "min-content" | "max-content" },
) {
  const para = paragraphFor(engine, node);
  let width = known.width;
  if (width == null) {
    para.layout(1e7);
    const max = Math.ceil(para.getMaxIntrinsicWidth());
    if (available.width === "min-content") width = Math.ceil(para.getMinIntrinsicWidth());
    else if (available.width === "max-content") width = max;
    else width = Math.min(max, available.width);
  }
  para.layout(width);
  return { width, height: known.height ?? Math.ceil(para.getHeight()) };
}

/** Height the text needs at the node's final width (may exceed a fixed height). */
export function naturalTextHeight(engine: TextEngine, node: PaintableNode): number {
  const para = paragraphFor(engine, node);
  para.layout(node.layout.width);
  return Math.ceil(para.getHeight());
}

export function releaseParagraphs(root: PaintableNode) {
  if (root.paragraph) {
    root.paragraph.delete();
    root.paragraph = undefined;
  }
  for (const c of root.children) releaseParagraphs(c);
}
