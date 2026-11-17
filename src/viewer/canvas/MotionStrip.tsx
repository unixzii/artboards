// The floating control strip at the bottom of the canvas, shown while the
// selection is in an artboard that uses motion: replay, pause, step a frame,
// and a speed for slow motion.

import { Pause, Play, SkipBack, StepForward } from "lucide-react";
import type { ReactNode } from "react";
import { useViewer, useViewerState } from "../core/context.ts";

const SPEEDS = [
  { value: 1, label: "1×" },
  { value: 0.5, label: "0.5×" },
  { value: 0.25, label: "0.25×" },
  { value: 0.1, label: "0.1×" },
];

function StripButton(props: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="strip-button" title={props.title} aria-label={props.title} onClick={props.onClick}>
      {props.children}
    </button>
  );
}

export function MotionStrip() {
  const viewer = useViewer();
  const selected = useViewerState((s) => s.selected);
  useViewerState((s) => s.model); // the selected artboard can start or stop using motion on a rebuild
  const tool = useViewerState((s) => s.tool);
  const paused = useViewerState((s) => s.paused);
  const speed = useViewerState((s) => s.speed);
  const frame = viewer.node(selected)?.frame;
  if (!frame?.animated) return null;

  const running = tool === "play" && !paused;
  return (
    // Pointer and wheel events stay on the strip instead of panning the canvas.
    <div id="motion-strip" role="toolbar" aria-label="Motion" onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
      <StripButton title={`Replay ${frame.name} from the start`} onClick={() => viewer.replay(frame.name)}>
        <SkipBack size={18} />
      </StripButton>
      <StripButton title={running ? "Pause" : "Play"} onClick={() => viewer.togglePaused()}>
        {running ? <Pause size={18} /> : <Play size={18} />}
      </StripButton>
      <StripButton title="Step one frame" onClick={() => viewer.stepFrame()}>
        <StepForward size={18} />
      </StripButton>
      <span className="strip-divider" />
      <div className="group segmented strip-speed" role="group" aria-label="Speed">
        {SPEEDS.map((s) => (
          <button
            key={s.value}
            type="button"
            className={s.value === speed ? "on" : undefined}
            aria-pressed={s.value === speed}
            title={s.value === 1 ? "Real time" : `${s.label} speed`}
            onClick={() => viewer.setSpeed(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
