// Bundled fonts for Node, loaded per unicode-range subset on demand.
//
// Each font package is split into subsets (Inter: 7, Noto Sans SC: 101). A
// subset+weight is registered with Skia only when some text actually needs it,
// under its own family name, and the paragraph lists the families it needs.
// The dev server hands the same files to the browser by URL.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { TypefaceFontProvider } from "canvaskit-wasm";
import { BASE_FAMILY, type FontFace, type FontResolver } from "../shared/text.ts";

const require = createRequire(import.meta.url);

interface Subset {
  family: string; // name registered with Skia, e.g. "Noto Sans SC:[100]"
  pack: string;
  fileName: (weight: number) => string;
  ranges: [number, number][];
}

// Order is priority: the first subset that covers a code point wins.
const PACKS = [
  { name: "Inter", pkg: "@fontsource/inter", slug: "inter" },
  { name: "Noto Sans SC", pkg: "@fontsource/noto-sans-sc", slug: "noto-sans-sc" },
];

/** Directory holding a pack's font files, or undefined for an unknown pack. */
export function fontDir(slug: string): string | undefined {
  const pack = PACKS.find((p) => p.slug === slug);
  return pack && join(dirname(require.resolve(`${pack.pkg}/package.json`)), "files");
}

function parseRanges(spec: string): [number, number][] {
  return spec.split(",").map((part) => {
    const [lo, hi] = part.trim().replace(/^U\+/i, "").split("-");
    return [parseInt(lo, 16), parseInt(hi ?? lo, 16)];
  });
}

let subsets: Subset[] | undefined;

function loadSubsets(): Subset[] {
  if (subsets) return subsets;
  subsets = [];
  for (const pack of PACKS) {
    const unicode: Record<string, string> = require(`${pack.pkg}/unicode.json`);
    for (const [key, spec] of Object.entries(unicode)) {
      const part = key.replace(/^\[(.*)\]$/, "$1"); // "[100]" -> "100"
      subsets.push({
        family: `${pack.name}:${key}`,
        pack: pack.slug,
        fileName: (w) => `${pack.slug}-${part}-${w}-normal.woff2`,
        ranges: parseRanges(spec),
      });
    }
  }
  // Keep the base subset first so plain Latin never touches the other tables.
  subsets.sort((a, b) => Number(b.family === BASE_FAMILY) - Number(a.family === BASE_FAMILY));
  return subsets;
}

const subsetOfCodePoint = new Map<number, Subset | null>();

function subsetFor(cp: number): Subset | null {
  let hit = subsetOfCodePoint.get(cp);
  if (hit !== undefined) return hit;
  hit = loadSubsets().find((s) => s.ranges.some(([lo, hi]) => cp >= lo && cp <= hi)) ?? null;
  subsetOfCodePoint.set(cp, hit);
  return hit;
}

export class FontSet implements FontResolver {
  provider: TypefaceFontProvider;
  /** Every face registered so far, keyed by family@weight. */
  faces = new Map<string, FontFace>();

  constructor(provider: TypefaceFontProvider) {
    this.provider = provider;
  }

  private register(subset: Subset, weight: number) {
    const key = `${subset.family}@${weight}`;
    if (this.faces.has(key)) return;
    const file = subset.fileName(weight);
    this.faces.set(key, { family: subset.family, path: `${subset.pack}/${file}` });
    const bytes = readFileSync(join(fontDir(subset.pack)!, file));
    this.provider.registerFont(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      subset.family,
    );
  }

  resolve(text: string, weight: number): { families: string[]; missing: string[] } {
    const all = loadSubsets();
    const used = new Set<Subset>([all[0]]); // base family also drives the strut
    const missing = new Set<string>();
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      if (cp < 0x20 || cp === 0x200d || (cp >= 0xfe00 && cp <= 0xfe0f)) continue; // controls, ZWJ, variation selectors
      const s = subsetFor(cp);
      if (s) used.add(s);
      else missing.add(ch);
    }
    for (const s of used) this.register(s, weight);
    return { families: [...used].map((s) => s.family), missing: [...missing] };
  }
}
