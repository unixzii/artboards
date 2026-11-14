// Browser entry: start CanvasKit, then hand over to React.

import type { CanvasKit } from "canvaskit-wasm";
import { createRoot } from "react-dom/client";
import { App } from "./components/App.tsx";
import { ViewerContext } from "./components/context.ts";
import { Viewer } from "./viewer.ts";

// Provided by /canvaskit/canvaskit.js, loaded from index.html.
declare const CanvasKitInit: (opts: { locateFile(file: string): string }) => Promise<CanvasKit>;

const root = document.getElementById("root")!;

CanvasKitInit({ locateFile: (file) => `/canvaskit/${file}` }).then(
  (ck) => {
    createRoot(root).render(
      <ViewerContext value={new Viewer(ck)}>
        <App />
      </ViewerContext>,
    );
  },
  (e) => {
    root.textContent = `Failed to start the renderer: ${e?.message ?? e}`;
    console.error(e);
  },
);
