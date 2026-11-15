import { useEffect } from "react";
import { Stage } from "../canvas/Stage.tsx";
import { SidePanel } from "../components/SidePanel.tsx";
import { useViewerState } from "../core/context.ts";
import { Comments } from "./Comments.tsx";
import { LayerTree } from "./LayerTree.tsx";
import { Problems } from "./Problems.tsx";
import { Properties } from "./Properties.tsx";
import { Toolbar } from "./Toolbar.tsx";

export function App() {
  const file = useViewerState((s) => s.file);
  const hasSelection = useViewerState((s) => s.selected !== null);
  const ready = useViewerState((s) => s.ready);
  const panelsHidden = useViewerState((s) => s.panelsHidden);

  useEffect(() => {
    document.title = file ? `${file} — Artboards` : "Artboards";
  }, [file]);
  // Lets automation wait for the first scene.
  useEffect(() => {
    if (ready) document.documentElement.dataset.ready = "true";
  }, [ready]);

  return (
    // On narrow screens the right panel is a bottom sheet shown only with a selection.
    <div id="app" className={[hasSelection && "has-selection", panelsHidden && "panels-hidden"].filter(Boolean).join(" ") || undefined}>
      <Toolbar />
      <SidePanel id="left" side="left" defaultWidth={320} minWidth={180} maxWidth={480}>
        <LayerTree />
        <Problems />
      </SidePanel>
      <Stage />
      <SidePanel id="right" side="right" defaultWidth={320} minWidth={220} maxWidth={520}>
        <Properties />
        <Comments />
      </SidePanel>
    </div>
  );
}
