import { useEffect } from "react";
import { Comments } from "./Comments.tsx";
import { useViewerState } from "./context.ts";
import { LayerTree } from "./LayerTree.tsx";
import { Problems } from "./Problems.tsx";
import { Properties } from "./Properties.tsx";
import { Stage } from "./Stage.tsx";
import { Toolbar } from "./Toolbar.tsx";

export function App() {
  const file = useViewerState((s) => s.file);
  const hasSelection = useViewerState((s) => s.selected !== null);
  const ready = useViewerState((s) => s.ready);

  useEffect(() => {
    document.title = file ? `${file} — Artboards` : "Artboards";
  }, [file]);
  // Lets automation wait for the first scene.
  useEffect(() => {
    if (ready) document.documentElement.dataset.ready = "true";
  }, [ready]);

  return (
    // On narrow screens the right panel is a bottom sheet shown only with a selection.
    <div id="app" className={hasSelection ? "has-selection" : undefined}>
      <Toolbar />
      <aside id="left">
        <LayerTree />
        <Problems />
      </aside>
      <Stage />
      <aside id="right">
        <Properties />
        <Comments />
      </aside>
    </div>
  );
}
