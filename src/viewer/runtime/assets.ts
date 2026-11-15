// Browser-side RenderEngine: fetches and caches @fontsource subset files and
// imported design assets on demand before Taffy measures text and images.

import type { CanvasKit, Image } from "canvaskit-wasm";
import type { ImageSource, RenderEngine } from "../../shared/engine.ts";
import { FontSet } from "../../shared/fonts.ts";

class BrowserImages implements ImageSource {
  private ck: CanvasKit;
  private fetchBytes: (url: string) => Promise<ArrayBuffer | undefined>;
  private cache = new Map<string, Image | null>();
  private inflight = new Map<string, Promise<void>>();

  constructor(ck: CanvasKit, fetchBytes: (url: string) => Promise<ArrayBuffer | undefined>) {
    this.ck = ck;
    this.fetchBytes = fetchBytes;
  }

  async ensure(id: string): Promise<void> {
    if (this.cache.has(id)) return;
    let pending = this.inflight.get(id);
    if (!pending) {
      pending = this.fetchBytes(`/assets/${id}`).then((bytes) => {
        this.cache.set(id, bytes ? this.ck.MakeImageFromEncoded(bytes) : null);
      });
      this.inflight.set(id, pending);
    }
    await pending;
  }

  get(id: string): Image | null {
    return this.cache.get(id) ?? null;
  }
}

export function createBrowserEngine(ck: CanvasKit): RenderEngine {
  const downloads = new Map<string, Promise<ArrayBuffer | undefined>>();
  const fetchBytes = (url: string) => {
    let p = downloads.get(url);
    if (!p) {
      // Font and asset keys are site-absolute ("/fonts/..."); fetch them relative to the page.
      p = fetch(url.replace(/^\//, ""))
        .then((r) => (r.ok ? r.arrayBuffer() : undefined))
        .catch((e) => {
          console.warn("asset failed to load:", url, e);
          return undefined;
        });
      downloads.set(url, p);
    }
    return p;
  };
  return {
    ck,
    fonts: new FontSet(ck, fetchBytes),
    images: new BrowserImages(ck, fetchBytes),
  };
}
