// Platform-free font resolution: bundled packs loaded per unicode-range subset
// on demand, plus font files a design imports and names with `defineFont`.
//
// Each bundled pack is split into subsets (Inter: 7, Noto Sans SC: 101). A
// subset+weight+style is registered with Skia only when some text needs it,
// under its own family name, and each text run lists the families it needs:
// first the run's own `fontFamily`, then Inter, then Noto Sans SC as fallback.

import frauncesMeta from "@fontsource/fraunces/metadata.json" with { type: "json" };
import frauncesUnicode from "@fontsource/fraunces/unicode.json" with { type: "json" };
import interMeta from "@fontsource/inter/metadata.json" with { type: "json" };
import interUnicode from "@fontsource/inter/unicode.json" with { type: "json" };
import jetbrainsMeta from "@fontsource/jetbrains-mono/metadata.json" with { type: "json" };
import jetbrainsUnicode from "@fontsource/jetbrains-mono/unicode.json" with { type: "json" };
import notoMeta from "@fontsource/noto-sans-sc/metadata.json" with { type: "json" };
import notoUnicode from "@fontsource/noto-sans-sc/unicode.json" with { type: "json" };
import type { CanvasKit, Typeface, TypefaceFontProvider } from "canvaskit-wasm";
import type { AssetRef } from "./scene.ts";
import { WEIGHTS, type FontFace, type FontQuery, type FontResolver } from "./text.ts";

export interface FontPack {
  name: string;
  pkg: string;
  slug: string;
  weights: ReadonlySet<number>;
  styles: ReadonlySet<string>;
  unicode: Record<string, string>;
}

// Inter and Noto Sans SC also serve as the fallback chain for every family.
export const PACKS: FontPack[] = [
  { name: "Inter", pkg: "@fontsource/inter", slug: "inter", weights: new Set(interMeta.weights), styles: new Set(interMeta.styles), unicode: interUnicode },
  {
    name: "Noto Sans SC",
    pkg: "@fontsource/noto-sans-sc",
    slug: "noto-sans-sc",
    weights: new Set(notoMeta.weights),
    styles: new Set(notoMeta.styles),
    unicode: notoUnicode,
  },
  {
    name: "JetBrains Mono",
    pkg: "@fontsource/jetbrains-mono",
    slug: "jetbrains-mono",
    weights: new Set(jetbrainsMeta.weights),
    styles: new Set(jetbrainsMeta.styles),
    unicode: jetbrainsUnicode,
  },
  {
    name: "Fraunces",
    pkg: "@fontsource/fraunces",
    slug: "fraunces",
    weights: new Set(frauncesMeta.weights),
    styles: new Set(frauncesMeta.styles),
    unicode: frauncesUnicode,
  },
];

const FALLBACK = ["Inter", "Noto Sans SC"];
export const DEFAULT_FAMILY = "Inter";

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

function packSubsets(pack: FontPack): Subset[] {
  let subsets = subsetsByPack.get(pack.name);
  if (subsets) return subsets;
  subsets = Object.entries(pack.unicode).map(([key, spec]) => {
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
          if (!pack.styles.has(style ? "italic" : "normal")) continue;
          for (const w of byDistance) {
            if (pack.weights.has(w)) {
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

/** Families declared by the design being built, reset before each module load. */
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

/** Loads raw font bytes for `/fonts/<pack>/<file>` or `/assets/<id>`. */
export type FontByteLoader = (url: string) => Promise<ArrayBuffer | undefined> | ArrayBuffer | undefined;

const isPromise = <T>(v: Promise<T> | T): v is Promise<T> => typeof (v as any)?.then === "function";

export class FontSet implements FontResolver {
  provider: TypefaceFontProvider;
  /** Every face registered so far, keyed by URL. */
  faces = new Map<string, FontFace>();
  private ck: CanvasKit;
  private load: FontByteLoader;
  private inflight = new Map<string, Promise<ArrayBuffer | undefined>>();
  private bytes = new Map<string, ArrayBuffer | null>();
  private typefaces = new Map<string, Typeface | null>();
  /** Fallback chain per family, and which link covers each code point. */
  private chains = new Map<string, { links: Link[]; hits: Map<number, Link | null> }>();

  constructor(ck: CanvasKit, load: FontByteLoader) {
    this.ck = ck;
    this.load = load;
    this.provider = ck.TypefaceFontProvider.Make();
  }

  private storeBytes(url: string, data: ArrayBuffer | undefined) {
    this.bytes.set(url, data ?? null);
    return data;
  }

  private registerLoaded(url: string, family: string, data: ArrayBuffer | undefined) {
    if (!data || this.faces.has(url)) return;
    this.faces.set(url, { family, url });
    this.provider.registerFont(data, family);
  }

  private async fetchFace(url: string, family: string): Promise<ArrayBuffer | undefined> {
    if (this.bytes.has(url)) {
      const cached = this.bytes.get(url) ?? undefined;
      this.registerLoaded(url, family, cached);
      return cached;
    }
    let pending = this.inflight.get(url);
    if (!pending) {
      pending = Promise.resolve(this.load(url)).then(
        (b) => this.storeBytes(url, b),
        () => this.storeBytes(url, undefined),
      );
      this.inflight.set(url, pending);
    }
    const data = await pending;
    this.registerLoaded(url, family, data);
    return data;
  }

  private syncFace(url: string, family: string): ArrayBuffer | undefined {
    if (this.bytes.has(url)) {
      const cached = this.bytes.get(url) ?? undefined;
      this.registerLoaded(url, family, cached);
      return cached;
    }
    const res = this.load(url);
    if (isPromise(res)) return undefined;
    const data = this.storeBytes(url, res);
    this.registerLoaded(url, family, data);
    return data;
  }

  private customFamilyName(name: string, faces: Required<CustomFace>[]) {
    return `${name}#${faces.map((f) => f.src.id.slice(0, 6)).join("")}`;
  }

  private ensureTypeface(id: string, data: ArrayBuffer | undefined) {
    if (this.typefaces.has(id)) return;
    this.typefaces.set(id, data ? this.ck.Typeface.MakeTypefaceFromData(data) : null);
  }

  /** A custom family is registered under a name tied to its files' contents. */
  private customFamily(name: string): { family: string; covers(cp: number): boolean } | undefined {
    const faces = custom.get(name);
    if (!faces?.length) return undefined;
    const family = this.customFamilyName(name, faces);
    for (const f of faces) this.syncFace(`/assets/${f.src.id}`, family);
    const id = faces[0].src.id;
    if (!this.typefaces.has(id)) this.ensureTypeface(id, this.bytes.get(`/assets/${id}`) ?? undefined);
    const tf = this.typefaces.get(id) ?? null;
    return { family, covers: (cp) => !!tf && tf.getGlyphIDs(String.fromCodePoint(cp))[0] !== 0 };
  }

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

  private selectLinks(text: string, wanted: string): { ordered: Link[]; missing: string[] } {
    const { links, hits } = this.chainFor(wanted);
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
    return { ordered: links.filter((l) => used.has(l)), missing: [...missing] };
  }

  async ensure(text: string, { weight, italic, family }: FontQuery): Promise<void> {
    const wanted = family ?? DEFAULT_FAMILY;
    const faces = custom.get(wanted);
    if (faces?.length) {
      const regFamily = this.customFamilyName(wanted, faces);
      const loaded = await Promise.all(faces.map((f) => this.fetchFace(`/assets/${f.src.id}`, regFamily)));
      this.ensureTypeface(faces[0].src.id, loaded[0]);
    }
    const { ordered } = this.selectLinks(text, wanted);
    await Promise.all(
      ordered.map((l) => {
        if (!l.subset) return;
        const file = l.subset.fileFor(weight, italic);
        return this.fetchFace(`/fonts/${l.subset.pack}/${file}`, l.subset.family);
      }),
    );
  }

  resolve(text: string, { weight, italic, family }: FontQuery): { families: string[]; missing: string[] } {
    const { ordered, missing } = this.selectLinks(text, family ?? DEFAULT_FAMILY);
    for (const l of ordered) {
      if (l.subset) {
        const file = l.subset.fileFor(weight, italic);
        this.syncFace(`/fonts/${l.subset.pack}/${file}`, l.subset.family);
      }
    }
    return { families: ordered.map((l) => l.family), missing };
  }
}
