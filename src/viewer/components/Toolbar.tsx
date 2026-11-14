import { ButtonGroup, GroupButton } from "./ui.tsx";
import { useViewer, useViewerState } from "./context.ts";

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function Toolbar() {
  const viewer = useViewer();
  const file = useViewerState((s) => s.file);
  const tool = useViewerState((s) => s.tool);
  const zoom = useViewerState((s) => s.zoom);
  const diagnostics = useViewerState((s) => s.diagnostics);
  const errors = diagnostics.filter((d) => d.severity === "error").length;

  return (
    <header id="bar">
      <strong id="file">{file || "Artboards"}</strong>
      <ButtonGroup label="Tool">
        <GroupButton id="tool-select" title="Select and pan (V)" active={tool === "select"} onClick={() => viewer.setTool("select")}>
          Select
        </GroupButton>
        <GroupButton id="tool-comment" title="Add a comment (C)" active={tool === "comment"} onClick={() => viewer.setTool("comment")}>
          Comment
        </GroupButton>
      </ButtonGroup>
      <span className="spacer" />
      <span id="status" className={errors ? "bad" : undefined}>
        {diagnostics.length ? `${plural(errors, "error")}, ${plural(diagnostics.length - errors, "warning")}` : "No problems"}
      </span>
      <ButtonGroup label="Zoom">
        <GroupButton id="zoom-out" title="Zoom out" onClick={() => viewer.view?.zoomBy(0.8)}>
          −
        </GroupButton>
        <GroupButton id="zoom" title="Reset to 100% (0)" onClick={() => viewer.view?.resetZoom()}>
          {zoom}%
        </GroupButton>
        <GroupButton id="zoom-in" title="Zoom in" onClick={() => viewer.view?.zoomBy(1.25)}>
          +
        </GroupButton>
        <GroupButton id="fit" title="Fit all artboards (Shift+1)" onClick={() => viewer.view?.fit()}>
          Fit
        </GroupButton>
      </ButtonGroup>
    </header>
  );
}
