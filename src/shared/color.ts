// CSS color parsing with bounded memoization. Platform-free: runs in Node and the browser.

import type { CanvasKit } from "canvaskit-wasm";

const colorCache = new Map<string, Float32Array>();

/** Cached RGBA float array for a CSS color string. Callers must never mutate the returned array. */
export function parseColor(ck: CanvasKit, raw: string): Float32Array {
  let c = colorCache.get(raw);
  if (!c) {
    if (colorCache.size >= 4096) colorCache.clear();
    c = ck.parseColorString(raw);
    colorCache.set(raw, c);
  }
  return c;
}
