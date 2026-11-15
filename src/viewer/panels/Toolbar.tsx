import {
  CheckCircle2,
  CircleAlert,
  Maximize2,
  MessageSquarePlus,
  Minus,
  MousePointer2,
  PanelLeft,
  Play,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { ButtonGroup, GroupButton } from "../components/primitives.tsx";
import { useViewer, useViewerState } from "../core/context.ts";

const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function Toolbar() {
  const viewer = useViewer();
  const file = useViewerState((s) => s.file);
  const tool = useViewerState((s) => s.tool);
  const zoom = useViewerState((s) => s.zoom);
  const diagnostics = useViewerState((s) => s.diagnostics);
  const panelsHidden = useViewerState((s) => s.panelsHidden);
  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.length - errors;

  return (
    <header id="bar">
      <ButtonGroup label="Panels" look="plain">
        <GroupButton id="toggle-panels" title={`${panelsHidden ? "Show" : "Hide"} side panels (${MOD}\\)`} onClick={() => viewer.togglePanels()}>
          <PanelLeft size={16} />
        </GroupButton>
      </ButtonGroup>
      <strong id="file">{file || "Artboards"}</strong>
      <ButtonGroup label="Tool" look="plain">
        <GroupButton id="tool-select" title="Select and pan (V)" active={tool === "select"} onClick={() => viewer.setTool("select")}>
          <MousePointer2 size={16} />
        </GroupButton>
        <GroupButton id="tool-comment" title="Add a comment (C)" active={tool === "comment"} onClick={() => viewer.setTool("comment")}>
          <MessageSquarePlus size={16} />
        </GroupButton>
        <GroupButton id="tool-play" title="Play: click layers to run their onClick (P)" active={tool === "play"} onClick={() => viewer.setTool("play")}>
          <Play size={16} />
        </GroupButton>
      </ButtonGroup>
      <span className="spacer" />
      <span id="status" className={errors ? "bad" : warnings ? "warn" : undefined}>
        {errors > 0 ? <CircleAlert size={13} /> : warnings > 0 ? <TriangleAlert size={13} /> : <CheckCircle2 size={13} />}
        <span>{diagnostics.length ? `${plural(errors, "error")}, ${plural(warnings, "warning")}` : "No problems"}</span>
      </span>
      <ButtonGroup label="Zoom">
        <GroupButton id="zoom-out" title="Zoom out" onClick={() => viewer.zoomOut()}>
          <Minus size={13} />
        </GroupButton>
        <GroupButton id="zoom" title="Reset to 100% (0)" onClick={() => viewer.resetZoom()}>
          {zoom}%
        </GroupButton>
        <GroupButton id="zoom-in" title="Zoom in" onClick={() => viewer.zoomIn()}>
          <Plus size={13} />
        </GroupButton>
        <GroupButton id="fit" title="Fit all artboards (Shift+1)" onClick={() => viewer.fit()}>
          <Maximize2 size={13} />
        </GroupButton>
      </ButtonGroup>
    </header>
  );
}
