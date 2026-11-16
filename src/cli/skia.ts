// Node-side CanvasKit + Taffy WASM bootstrap and headless PNG rasterization.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CanvasKit } from "canvaskit-wasm";
import { prepareTree, type RenderEngine } from "../shared/engine.ts";
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

/**
 * Rasterizes one artboard on the CPU and returns PNG bytes. The artboard sits
 * on white, as in the viewer, unless `transparent`: then whatever it does not
 * paint stays transparent (icons, images to place on other backgrounds).
 */
export function renderToPng(engine: RenderEngine, root: PaintableNode, scale = 1, { transparent = false } = {}): Uint8Array {
  const { ck } = engine;
  const width = Math.ceil(root.layout.width * scale);
  const height = Math.ceil(root.layout.height * scale);
  const surface = ck.MakeSurface(width, height);
  if (!surface) throw new Error(`Could not create a ${width}x${height} surface`);
  const canvas = surface.getCanvas();
  canvas.clear(transparent ? ck.TRANSPARENT : ck.WHITE);
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

/**
 * A contact sheet of one artboard at several moments: each frame on its own
 * (white unless `transparent`) with its label above, on a grey sheet. Add the
 * frames in order as they are laid out, then encode.
 */
export class Filmstrip {
  private static readonly PAD = 16;
  private static readonly GAP = 16;
  private static readonly LABEL = 22;
  /** Rows wrap past this many artboard units. */
  private static readonly MAX_WIDTH = 2400;

  private engine: NodeEngine;
  private surface: ReturnType<CanvasKit["MakeSurface"]>;
  private cols: number;
  private cellW: number;
  private cellH: number;
  private scale: number;
  private transparent: boolean;
  private count = 0;

  constructor(engine: NodeEngine, frames: number, cellW: number, cellH: number, scale: number, { transparent = false } = {}) {
    const { PAD, GAP, LABEL, MAX_WIDTH } = Filmstrip;
    this.engine = engine;
    this.cellW = cellW;
    this.cellH = cellH;
    this.scale = scale;
    this.transparent = transparent;
    this.cols = Math.max(1, Math.min(frames, Math.floor((MAX_WIDTH - 2 * PAD + GAP) / (cellW + GAP))));
    const rows = Math.ceil(frames / this.cols);
    const width = Math.ceil((2 * PAD + this.cols * cellW + (this.cols - 1) * GAP) * scale);
    const height = Math.ceil((2 * PAD + rows * (LABEL + cellH) + (rows - 1) * GAP) * scale);
    this.surface = engine.ck.MakeSurface(width, height);
    if (!this.surface) throw new Error(`Could not create a ${width}x${height} surface`);
    this.surface.getCanvas().clear(engine.ck.Color(244, 244, 245, 1));
  }

  async add(label: string, root: PaintableNode) {
    const { PAD, GAP, LABEL } = Filmstrip;
    const { ck } = this.engine;
    const col = this.count % this.cols;
    const row = Math.floor(this.count / this.cols);
    this.count++;
    const x = PAD + col * (this.cellW + GAP);
    const y = PAD + row * (LABEL + this.cellH + GAP);
    const text: PaintableNode = {
      type: "Text",
      props: { children: label, fontSize: 12, fontWeight: 500, color: "#52525b" },
      children: [],
      layout: { x, y: y + 3, width: this.cellW, height: 16 },
    };
    await prepareTree(text, this.engine);

    const canvas = this.surface!.getCanvas();
    canvas.save();
    canvas.scale(this.scale, this.scale);
    paintNode(this.engine, canvas, text);
    const cell = ck.XYWHRect(x, y + LABEL, this.cellW, this.cellH);
    if (!this.transparent) {
      const white = new ck.Paint();
      white.setColor(ck.WHITE);
      canvas.drawRect(cell, white);
      white.delete();
    }
    canvas.clipRect(cell, ck.ClipOp.Intersect, true);
    canvas.translate(x - root.layout.x, y + LABEL - root.layout.y);
    paintNode(this.engine, canvas, root);
    canvas.restore();
    text.paragraph?.delete();
  }

  encode(): Uint8Array {
    const image = this.surface!.makeImageSnapshot();
    const png = image.encodeToBytes();
    image.delete();
    this.surface!.delete();
    if (!png) throw new Error("PNG encoding failed");
    return png;
  }
}
