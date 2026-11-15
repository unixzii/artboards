// Node-side font loader: reads @fontsource subset files and imported font
// assets synchronously from disk for `FontSet`.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { CanvasKit } from "canvaskit-wasm";
import { FontSet, PACKS } from "../shared/fonts.ts";
import { readAsset } from "./assets.ts";

const require = createRequire(import.meta.url);

/** Directory holding a bundled pack's `.woff2` files, or undefined for an unknown slug. */
export function fontDir(slug: string): string | undefined {
  const pack = PACKS.find((p) => p.slug === slug);
  return pack && join(dirname(require.resolve(`${pack.pkg}/package.json`)), "files");
}

/** Every bundled font file (`/fonts/<pack>/<file>`) read so far, for `artboards build`. */
export const usedFontFiles = new Set<string>();

export function createNodeFonts(ck: CanvasKit): FontSet {
  return new FontSet(ck, (url) => {
    let m = /^\/fonts\/([a-z0-9-]+)\/([a-z0-9-]+\.woff2)$/.exec(url);
    if (m) {
      usedFontFiles.add(url);
      const dir = fontDir(m[1]);
      if (!dir) return undefined;
      const bytes = readFileSync(join(dir, m[2]));
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    }
    m = /^\/assets\/([0-9a-f]{16})$/.exec(url);
    if (m) return readAsset(m[1]);
    return undefined;
  });
}
