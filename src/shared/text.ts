// Paragraph building and measurement. Platform-free: runs in Node and the browser.

import type { CanvasKit, Paragraph, TypefaceFontProvider } from "canvaskit-wasm";
import { textContentOf, type PaintableNode } from "./scene.ts";

/** Family that every paragraph loads; it also defines the line box (strut). */
export const BASE_FAMILY = "Inter:latin";

export const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/** Nearest weight we ship. */
export function nearestWeight(w: unknown): number {
  const n = Number(w) || 400;
  return WEIGHTS.reduce((best, c) => (Math.abs(c - n) < Math.abs(best - n) ? c : best));
}

export interface FontFace {
  family: string;
  /** Path under the dev server's /fonts/ route: "<pack>/<file>". */
  path: string;
}

export interface FontResolver {
  provider: TypefaceFontProvider;
  /** Makes the glyphs for `text` available and returns the families to use. */
  resolve(text: string, weight: number): { families: string[]; missing: string[] };
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

/** Builds (once) the paragraph for a Text node. Call `releaseParagraphs` when done. */
export function paragraphFor(engine: TextEngine, node: PaintableNode): Paragraph {
  if (node.paragraph) return node.paragraph;
  const { ck } = engine;
  const p = node.props;
  const text = textContentOf(node);
  const fontSize = p.fontSize ?? 14;
  const weight = nearestWeight(p.fontWeight);
  // A node that arrives already resolved (sent from the dev server) keeps its families.
  if (!node.fontFamilies) {
    const resolved = engine.fonts.resolve(text, weight);
    node.fontFamilies = resolved.families;
    node.missingGlyphs = resolved.missing;
  }

  const fontStyle = { weight: (ck.FontWeight as any)[WEIGHT_NAMES[weight]] };
  // Line height: explicit `lineHeight` in px, otherwise the base font's own
  // metrics. The strut forces it for every line, so fallback fonts (CJK) with
  // different metrics cannot change the line box.
  const leading = p.lineHeight ? { heightMultiplier: p.lineHeight / fontSize } : {};
  const style = new ck.ParagraphStyle({
    textAlign: { left: ck.TextAlign.Left, center: ck.TextAlign.Center, right: ck.TextAlign.Right }[
      (p.textAlign ?? "left") as "left" | "center" | "right"
    ],
    textStyle: {
      color: ck.parseColorString(p.color ?? "#000000"),
      fontSize,
      fontFamilies: node.fontFamilies,
      fontStyle,
      halfLeading: true,
      ...leading,
    },
    strutStyle: {
      strutEnabled: true,
      forceStrutHeight: true,
      fontFamilies: [BASE_FAMILY],
      fontSize,
      fontStyle,
      halfLeading: true,
      ...leading,
    },
  });
  const builder = ck.ParagraphBuilder.MakeFromFontProvider(style, engine.fonts.provider);
  builder.addText(text);
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
