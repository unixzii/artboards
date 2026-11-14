// Node-side CanvasKit bootstrap.

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { CanvasKit } from "canvaskit-wasm";
import { FontSet } from "./fonts.ts";
import type { TextEngine } from "./shared/text.ts";

const require = createRequire(import.meta.url);

export interface NodeEngine extends TextEngine {
  fonts: FontSet;
}

/** Directory with canvaskit.js / canvaskit.wasm, also served to the viewer. */
export const canvasKitDir = dirname(require.resolve("canvaskit-wasm"));

let engine: Promise<NodeEngine> | undefined;

export function createTextEngine(): Promise<NodeEngine> {
  return (engine ??= (async () => {
    const init = require("canvaskit-wasm") as (opts: object) => Promise<CanvasKit>;
    const ck = await init({ locateFile: (f: string) => join(canvasKitDir, f) });
    return { ck, fonts: new FontSet(ck.TypefaceFontProvider.Make()) };
  })());
}
