// Browser entry: start CanvasKit, wire the Viewer controller, and mount React.

import type { CanvasKit } from "canvaskit-wasm";
import { createRoot } from "react-dom/client";
import { Renderer } from "./canvas/renderer.ts";
import { ViewerContext } from "./core/context.ts";
import { Viewer } from "./core/viewer.ts";
import { App } from "./ui/App.tsx";

// Provided by /canvaskit/canvaskit.js, loaded from index.html.
declare const CanvasKitInit: (opts: { locateFile(file: string): string }) => Promise<CanvasKit>;

const root = document.getElementById("root")!;

CanvasKitInit({ locateFile: (file) => `/canvaskit/${file}` }).then(
  (ck) => {
    const viewer = new Viewer((els, onZoom) => new Renderer(ck, els, onZoom));
    createRoot(root).render(
      <ViewerContext value={viewer}>
        <App />
      </ViewerContext>,
    );
  },
  (e) => {
    root.textContent = `Failed to start the renderer: ${e?.message ?? e}`;
    console.error(e);
  },
);
