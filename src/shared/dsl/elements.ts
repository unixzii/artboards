// The public "artboards" module: what DSL files import at runtime.
// Primitives are host element types (plain strings). Their props are defined in
// schema.ts, which also generates the type declarations agents check against.

import { builtinFamilies, declareFont, type CustomFace } from "../fonts.ts";
import { isAssetRef, type AssetRef } from "../scene.ts";
import { DslError } from "./schema.ts";

export { useState, useEffect, useMemo, useRef, useCallback, Fragment } from "react";
export { useVariant } from "./variants.ts";

export const Frame = "Frame";
export const Row = "Row";
export const Column = "Column";
export const Grid = "Grid";
export const Text = "Text";
export const Span = "Span";
export const Rect = "Rect";
export const Ellipse = "Ellipse";
export const Image = "Image";
export const Path = "Path";

/** Declares a font family from imported font files; returns the name to use as `fontFamily`. */
export function defineFont(name: unknown, faces: unknown): string {
  if (typeof name !== "string" || !name.trim()) throw new DslError("defineFont: the first argument must be the family name.");
  if (builtinFamilies().includes(name)) throw new DslError(`defineFont: "${name}" is a bundled family; pick another name.`);
  const isFont = (v: unknown): v is AssetRef => isAssetRef(v) && v.$asset === "font";
  const list: unknown[] = isFont(faces) ? [{ src: faces }] : Array.isArray(faces) ? faces : [];
  if (list.length === 0) {
    throw new DslError(`defineFont("${name}"): pass an imported font file, or an array of { src, weight?, italic?, index? }.`);
  }
  const out: CustomFace[] = list.map((f: any, i) => {
    if (!f || !isFont(f.src)) {
      throw new DslError(`defineFont("${name}"): face ${i} needs \`src\` set to an imported .woff2, .ttf, .otf or .ttc file.`);
    }
    if (f.weight != null && !(typeof f.weight === "number" && f.weight >= 1 && f.weight <= 1000)) {
      throw new DslError(`defineFont("${name}"): weight must be a number from 1 to 1000, got ${JSON.stringify(f.weight)}.`);
    }
    if (f.index != null && !(Number.isInteger(f.index) && f.index >= 0)) {
      throw new DslError(`defineFont("${name}"): index picks a font of a .ttc collection and must be 0 or more, got ${JSON.stringify(f.index)}.`);
    }
    return { src: f.src, weight: f.weight, italic: f.italic === true, index: f.index ?? 0 };
  });
  declareFont(name, out);
  return name;
}

export type { Padding, Shadow, ViewBox } from "../scene.ts";
