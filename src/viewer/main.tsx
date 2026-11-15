// Browser entry: install the DSL runtime bridge, load CanvasKit and Taffy WASM,
// wire the Viewer controller, and mount React.

import type { CanvasKit } from "canvaskit-wasm";
import { createRoot } from "react-dom/client";
import { initTaffy } from "../shared/layout.ts";
import { Renderer } from "./canvas/renderer.ts";
import { ViewerContext } from "./core/context.ts";
import { Viewer } from "./core/viewer.ts";
import { App } from "./panels/App.tsx";
import { createBrowserEngine } from "./runtime/assets.ts";
import { installRuntimeBridge } from "./runtime/bridge.ts";

// Provided by /canvaskit/canvaskit.js, loaded from index.html.
declare const CanvasKitInit: (opts: { locateFile(file: string): string }) => Promise<CanvasKit>;

installRuntimeBridge();

const root = document.getElementById("root")!;

Promise.all([
  CanvasKitInit({ locateFile: (file) => `/canvaskit/${file}` }),
  initTaffy("/taffy/taffy_wasm_bg.wasm"),
]).then(
  ([ck]) => {
    const engine = createBrowserEngine(ck);
    const viewer = new Viewer(engine, (els, onZoom) => new Renderer(ck, engine, els, onZoom));
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
