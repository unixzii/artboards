// Files a design imports (`import photo from "./photo.jpg"`). Each becomes an
// AssetRef named by a hash of its content, so a changed file gets a new id and
// the dev server can serve it with a long cache lifetime. Only files a design
// actually imported are ever registered, and only those are served.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { extname, relative } from "node:path";
import type { CanvasKit, Image } from "canvaskit-wasm";
import type { ImageSource } from "../shared/engine.ts";
import type { AssetRef } from "../shared/scene.ts";

export const ASSET_KINDS: Record<string, AssetRef["$asset"]> = {
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".webp": "image",
  ".gif": "image",
  ".woff2": "font",
  ".ttf": "font",
  ".otf": "font",
  ".ttc": "font",
};

const paths = new Map<string, string>(); // id -> absolute path

/** Registers an imported file and returns the value the import evaluates to. */
export function importAsset(absPath: string): AssetRef {
  const kind = ASSET_KINDS[extname(absPath).toLowerCase()];
  const bytes = readFileSync(absPath);
  const id = createHash("sha1").update(bytes).digest("hex").slice(0, 16);
  paths.set(id, absPath);
  return Object.freeze({ $asset: kind, id, file: relative(process.cwd(), absPath) });
}

/** Every asset imported so far, by id. */
export function registeredAssets(): ReadonlyMap<string, string> {
  return paths;
}

/** Absolute path of a registered asset, or undefined. */
export function assetPath(id: string): string | undefined {
  return paths.get(id);
}

export function readAsset(id: string): ArrayBuffer | undefined {
  const path = paths.get(id);
  if (!path) return undefined;
  const bytes = readFileSync(path);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Server-side decoded images, cached by content hash for the life of the process. */
export class NodeImages implements ImageSource {
  private ck: CanvasKit;
  private cache = new Map<string, Image | null>();

  constructor(ck: CanvasKit) {
    this.ck = ck;
  }

  get(id: string): Image | null {
    let img = this.cache.get(id);
    if (img === undefined) {
      const bytes = readAsset(id);
      img = bytes ? this.ck.MakeImageFromEncoded(bytes) : null;
      this.cache.set(id, img);
    }
    return img;
  }
}
