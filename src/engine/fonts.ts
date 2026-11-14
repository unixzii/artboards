// Fonts for Node: bundled packs loaded per unicode-range subset on demand, plus
// font files a design imports and names with `defineFont`.
//
// Each bundled pack is split into subsets (Inter: 7, Noto Sans SC: 101). A
// subset+weight+style is registered with Skia only when some text needs it,
// under its own family name, and each text run lists the families it needs:
// first the run's own `fontFamily`, then Inter, then Noto Sans SC as fallback.
// The dev server hands the same files to the browser by URL.

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { CanvasKit, Typeface, TypefaceFontProvider } from "canvaskit-wasm";
import type { AssetRef } from "../shared/scene.ts";
import { WEIGHTS, type FontFace, type FontQuery, type FontResolver } from "../shared/text.ts";
import { readAsset } from "./assets.ts";

const require = createRequire(import.meta.url);

interface Pack {
  name: string;
  pkg: string;
  slug: string;
}

// Inter and Noto Sans SC also serve as the fallback chain for every family.
const PACKS: Pack[] = [
  { name: "Inter", pkg: "@fontsource/inter", slug: "inter" },
  { name: "Noto Sans SC", pkg: "@fontsource/noto-sans-sc", slug: "noto-sans-sc" },
  { name: "JetBrains Mono", pkg: "@fontsource/jetbrains-mono", slug: "jetbrains-mono" },
  { name: "Fraunces", pkg: "@fontsource/fraunces", slug: "fraunces" },
];
const FALLBACK = ["Inter", "Noto Sans SC"];
export const DEFAULT_FAMILY = "Inter";

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

interface Subset {
  family: string; // name registered with Skia, e.g. "Noto Sans SC:[100]"
  pack: string;
  /** File for the nearest available weight and style. */
  fileFor(weight: number, italic: boolean): string;
  covers(cp: number): boolean;
}

const subsetsByPack = new Map<string, Subset[]>();

function packSubsets(pack: Pack): Subset[] {
  let subsets = subsetsByPack.get(pack.name);
  if (subsets) return subsets;
  const dir = fontDir(pack.slug)!;
  const unicode: Record<string, string> = require(`${pack.pkg}/unicode.json`);
  subsets = Object.entries(unicode).map(([key, spec]) => {
    const part = key.replace(/^\[(.*)\]$/, "$1"); // "[100]" -> "100"
    const ranges = parseRanges(spec);
    const name = (w: number, italic: boolean) => `${pack.slug}-${part}-${w}-${italic ? "italic" : "normal"}.woff2`;
    const files = new Map<string, string>();
    return {
      family: `${pack.name}:${key}`,
      pack: pack.slug,
      fileFor(weight: number, italic: boolean) {
        const k = `${weight}${italic}`;
        let file = files.get(k);
        if (file) return file;
        const byDistance = [...WEIGHTS].sort((a, b) => Math.abs(a - weight) - Math.abs(b - weight));
        search: for (const style of italic ? [true, false] : [false]) {
          for (const w of byDistance) {
            if (existsSync(join(dir, name(w, style)))) {
              file = name(w, style);
              break search;
            }
          }
        }
        file ??= name(400, false);
        files.set(k, file);
        return file;
      },
      covers: (cp: number) => ranges.some(([lo, hi]) => cp >= lo && cp <= hi),
    };
  });
  // The "latin" subset first, so plain Latin never touches the other tables and
  // the family's first subset is the one that defines its line box.
  subsets.sort((a, b) => Number(b.family.endsWith(":latin")) - Number(a.family.endsWith(":latin")));
  subsetsByPack.set(pack.name, subsets);
  return subsets;
}

// ------------------------------------------------------------- custom families

export interface CustomFace {
  src: AssetRef;
  weight?: number;
  italic?: boolean;
}

/** Families declared by the design being built, reset before each load. */
const custom = new Map<string, Required<CustomFace>[]>();

export function resetCustomFonts() {
  custom.clear();
}

export function builtinFamilies(): string[] {
  return PACKS.map((p) => p.name);
}

/** Every family a `fontFamily` prop may name right now. */
export function knownFamilies(): string[] {
  return [...builtinFamilies(), ...custom.keys()];
}

export function declareFont(name: string, faces: CustomFace[]) {
  custom.set(
    name,
    faces.map((f) => ({ src: f.src, weight: f.weight ?? 400, italic: f.italic ?? false })),
  );
}

// ---------------------------------------------------------------------- FontSet

interface Link {
  family: string;
  covers(cp: number): boolean;
  /** Bundled subsets are registered per weight and style when used. */
  subset?: Subset;
}

export class FontSet implements FontResolver {
  provider: TypefaceFontProvider;
  /** Every face registered so far, keyed by file. */
  faces = new Map<string, FontFace>();
  private ck: CanvasKit;
  private typefaces = new Map<string, Typeface | null>();

  constructor(ck: CanvasKit) {
    this.ck = ck;
    this.provider = ck.TypefaceFontProvider.Make();
  }

  private register(key: string, family: string, url: string, read: () => ArrayBuffer | undefined) {
    if (this.faces.has(key)) return;
    const bytes = read();
    if (!bytes) return;
    this.faces.set(key, { family, url });
    this.provider.registerFont(bytes, family);
  }

  private registerSubset(subset: Subset, weight: number, italic: boolean) {
    const file = subset.fileFor(weight, italic);
    this.register(`${subset.pack}/${file}`, subset.family, `/fonts/${subset.pack}/${file}`, () => {
      const bytes = readFileSync(join(fontDir(subset.pack)!, file));
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    });
  }

  /** A custom family is registered under a name tied to its files' contents. */
  private customFamily(name: string): { family: string; covers(cp: number): boolean } | undefined {
    const faces = custom.get(name);
    if (!faces?.length) return undefined;
    const family = `${name}#${faces.map((f) => f.src.id.slice(0, 6)).join("")}`;
    for (const f of faces) this.register(`asset/${f.src.id}`, family, `/assets/${f.src.id}`, () => readAsset(f.src.id));
    const id = faces[0].src.id;
    let tf = this.typefaces.get(id);
    if (tf === undefined) {
      const bytes = readAsset(id);
      tf = bytes ? this.ck.Typeface.MakeTypefaceFromData(bytes) : null;
      this.typefaces.set(id, tf);
    }
    return { family, covers: (cp) => !!tf && tf.getGlyphIDs(String.fromCodePoint(cp))[0] !== 0 };
  }

  /** Fallback chain per family, and which link covers each code point. */
  private chains = new Map<string, { links: Link[]; hits: Map<number, Link | null> }>();

  private chainFor(wanted: string) {
    const own = this.customFamily(wanted);
    const key = own?.family ?? wanted;
    let chain = this.chains.get(key);
    if (chain) return chain;
    const links: Link[] = own ? [{ family: own.family, covers: own.covers }] : [];
    for (const name of [wanted, ...FALLBACK]) {
      const pack = PACKS.find((p) => p.name === name);
      if (!pack || links.some((l) => l.subset?.pack === pack.slug)) continue;
      for (const s of packSubsets(pack)) links.push({ family: s.family, covers: s.covers, subset: s });
    }
    chain = { links, hits: new Map() };
    this.chains.set(key, chain);
    return chain;
  }

  resolve(text: string, { weight, italic, family }: FontQuery): { families: string[]; missing: string[] } {
    const { links, hits } = this.chainFor(family ?? DEFAULT_FAMILY);
    // The first link always takes part: it defines the line box.
    const used = new Set([links[0]]);
    const missing = new Set<string>();
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      if (cp < 0x20 || cp === 0x200d || (cp >= 0xfe00 && cp <= 0xfe0f)) continue; // controls, ZWJ, variation selectors
      let hit = hits.get(cp);
      if (hit === undefined) {
        hit = links.find((l) => l.covers(cp)) ?? null;
        hits.set(cp, hit);
      }
      if (hit) used.add(hit);
      else missing.add(ch);
    }
    const ordered = links.filter((l) => used.has(l));
    for (const l of ordered) if (l.subset) this.registerSubset(l.subset, weight, italic);
    return { families: ordered.map((l) => l.family), missing: [...missing] };
  }
}
