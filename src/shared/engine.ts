// What layout, painting and the checks need from a CanvasKit host. Node and
// the browser each provide one; neither side's loading code leaks in here.

import type { Image } from "canvaskit-wasm";
import type { TextEngine } from "./text.ts";

/** Decoded images by asset id. */
export interface ImageSource {
  /** The decoded image, or null when the id is unknown or the file did not decode. */
  get(id: string): Image | null;
}

export interface RenderEngine extends TextEngine {
  images: ImageSource;
}
