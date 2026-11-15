// What layout, painting and the checks need from a CanvasKit host. Node and
// the browser each provide one; neither side's loading code leaks in here.

import type { Image } from "canvaskit-wasm";
import { walk, type PaintableNode } from "./scene.ts";
import { textQueriesOf, type TextEngine } from "./text.ts";

/** Decoded images by asset id. */
export interface ImageSource {
  /** Preloads an image asset before synchronous measurement when loading is async. */
  ensure?(id: string): Promise<unknown>;
  /** The decoded image, or null when the id is unknown or the file did not decode. */
  get(id: string): Image | null;
}

export interface RenderEngine extends TextEngine {
  images: ImageSource;
}

/** Preloads every font face and image needed to measure and paint `root`. */
export async function prepareTree(root: PaintableNode, engine: RenderEngine): Promise<void> {
  if (!engine.fonts.ensure && !engine.images.ensure) return;
  const tasks: Promise<unknown>[] = [];
  walk(root, (node) => {
    if (node.type === "Image" && node.props.src?.id && engine.images.ensure) {
      tasks.push(engine.images.ensure(node.props.src.id));
    } else if (node.type === "Text" && !node.fontFamilies && engine.fonts.ensure) {
      for (const { text, query } of textQueriesOf(node)) {
        tasks.push(engine.fonts.ensure(text, query));
      }
    }
  });
  if (tasks.length) await Promise.all(tasks);
}
