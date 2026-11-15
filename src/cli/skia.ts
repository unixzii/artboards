// Node-side CanvasKit + Taffy WASM bootstrap and headless PNG rasterization.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CanvasKit } from "canvaskit-wasm";
import type { RenderEngine } from "../shared/engine.ts";
import type { FontSet } from "../shared/fonts.ts";
import { initTaffy } from "../shared/layout.ts";
import { paintNode } from "../shared/paint.ts";
import type { PaintableNode } from "../shared/scene.ts";
import { NodeImages } from "./assets.ts";
import { createNodeFonts } from "./fonts.ts";

const require = createRequire(import.meta.url);

export interface NodeEngine extends RenderEngine {
  fonts: FontSet;
  images: NodeImages;
}

/** Directory with canvaskit.js / canvaskit.wasm, also served to the viewer. */
export const canvasKitDir = dirname(require.resolve("canvaskit-wasm"));

/** Path to taffy_wasm_bg.wasm, also served to the viewer. */
export const taffyWasmPath = fileURLToPath(new URL("./taffy_wasm_bg.wasm", import.meta.resolve("taffy-layout/wasm")));

let engine: Promise<NodeEngine> | undefined;

export function createEngine(): Promise<NodeEngine> {
  return (engine ??= (async () => {
    const init = require("canvaskit-wasm") as (opts: object) => Promise<CanvasKit>;
    const [ck] = await Promise.all([
      init({ locateFile: (f: string) => join(canvasKitDir, f) }),
      initTaffy(readFileSync(taffyWasmPath)),
    ]);
    return { ck, fonts: createNodeFonts(ck), images: new NodeImages(ck) };
  })());
}

/** Rasterizes one artboard on the CPU and returns PNG bytes. */
export function renderToPng(engine: RenderEngine, root: PaintableNode, scale = 1): Uint8Array {
  const { ck } = engine;
  const width = Math.ceil(root.layout.width * scale);
  const height = Math.ceil(root.layout.height * scale);
  const surface = ck.MakeSurface(width, height);
  if (!surface) throw new Error(`Could not create a ${width}x${height} surface`);
  const canvas = surface.getCanvas();
  canvas.clear(ck.WHITE);
  canvas.scale(scale, scale);
  canvas.translate(-root.layout.x, -root.layout.y);
  paintNode(engine, canvas, root);
  const image = surface.makeImageSnapshot();
  const png = image.encodeToBytes();
  image.delete();
  surface.delete();
  if (!png) throw new Error("PNG encoding failed");
  return png;
}
