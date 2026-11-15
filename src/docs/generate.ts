// Build-time generator for dist/artboards.d.ts and dist/docs.md (`artboards docs`).
// Their prose lives next to this file; `{{name}}` marks where generated text goes.

import { readFileSync } from "node:fs";
import { ELEMENT_HINTS, HINTS, elementDeclarations, enumDeclarations } from "../shared/dsl/schema.ts";
import { ASSET_KINDS } from "../cli/assets.ts";
import { builtinFamilies } from "../shared/fonts.ts";

const read = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

/** Replaces every `{{name}}`; a placeholder without a value is a mistake in the template. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    if (!(name in values)) throw new Error(`No value for {{${name}}} in a docs template.`);
    return values[name];
  });
}

const extensions = (kind: string) =>
  Object.entries(ASSET_KINDS)
    .filter(([, k]) => k === kind)
    .map(([ext]) => ext);

export function generateDts(): string {
  const assetModules = Object.entries(ASSET_KINDS).map(
    ([ext, kind]) => `declare module "*${ext}" { const asset: import("artboards").${kind === "image" ? "ImageAsset" : "FontAsset"}; export default asset; }`,
  );
  return fill(read("artboards.d.ts.tmpl"), {
    enums: enumDeclarations(),
    fontFamilies: builtinFamilies().map((f) => JSON.stringify(f)).join(" | "),
    elements: elementDeclarations(),
    assetModules: assetModules.join("\n"),
  });
}

export function generateDocs(dts = generateDts()): string {
  // Only the "artboards" module: the JSX and file-import declarations are plumbing.
  const start = dts.indexOf('declare module "artboards" {');
  const api = dts.slice(start, dts.indexOf("\n}\n", start) + 2);
  // One line per alternative, listing every name it replaces.
  const byHint = new Map<string, string[]>();
  for (const [name, hint] of Object.entries(ELEMENT_HINTS)) byHint.set(hint, [...(byHint.get(hint) ?? []), `<${name}>`]);
  for (const [name, hint] of Object.entries(HINTS)) byHint.set(hint, [...(byHint.get(hint) ?? []), `\`${name}\``]);
  const unsupported = [...byHint].map(([hint, names]) => `- ${names.join(", ")}: ${hint}`);
  return fill(read("guide.md"), {
    fontFamilies: builtinFamilies().join(", "),
    imageExts: extensions("image").join(", "),
    fontExts: extensions("font").join(", "),
    unsupported: unsupported.join("\n"),
    api,
  });
}
