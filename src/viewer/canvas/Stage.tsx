// The canvas and the DOM overlay drawn over it (artboard titles, comment pins,
// the comment box). Overlay elements are anchored to canvas points with CSS
// variables, so they follow pan and zoom without React re-rendering.

import { ChevronRight, Component, RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useViewer, useViewerState } from "../core/context.ts";
import { measure } from "../core/measure.ts";
import { bottomCenter, canvasBox, describe, pinPosition, sizing, type ViewFrame, type ViewNode } from "../core/model.ts";
import { anchor } from "./anchor.ts";
import { attachInput } from "./input.ts";
import { MotionStrip } from "./MotionStrip.tsx";

/** "Modified" with a reset button, on an artboard that is not in its initial state. */
function ModifiedBadge({ frame }: { frame: ViewFrame }) {
  const viewer = useViewer();
  if (!frame.modified) return null;
  return (
    <span className="modified">
      Modified
      <button
        type="button"
        title="Reset to the initial state"
        onClick={(e) => {
          e.stopPropagation();
          viewer.resetFrame(frame.name);
        }}
      >
        <RotateCcw size={11} />
      </button>
    </span>
  );
}

function FrameLabel({ frame }: { frame: ViewFrame }) {
  const viewer = useViewer();
  const selected = useViewerState((s) => s.selected);
  const animating = useViewerState((s) => s.animating.has(frame.name));
  const error = frame.error;
  if (error) {
    // Fills the placeholder box the renderer draws for a failed artboard.
    return (
      <div className="anchored frame-label failed" style={anchor(frame, { w: frame.w, h: frame.h })}>
        <span className="failed-head">
          <TriangleAlert size={13} />
          <span>{frame.name}</span>
          <ModifiedBadge frame={frame} />
        </span>
        <span className="err">
          {error.source} {error.message}
        </span>
      </div>
    );
  }
  const root = frame.root!;
  // No wider than the artboard on screen: the name stays (cut with an ellipsis),
  // then "Modified", then the size, then "Animating", each dropped whole when it no longer fits.
  return (
    <div
      className={`anchored frame-label above${root.key === selected ? " selected" : ""}`}
      style={anchor(frame, { w: frame.w })}
      title={`${frame.name}  ${frame.w} × ${frame.h}${frame.modified ? "  (modified)" : ""}`}
      onClick={() => viewer.select(root.key)}
    >
      <span className="frame-name">{frame.name}</span>
      <ModifiedBadge frame={frame} />
      <span className="frame-size">
        {frame.w} × {frame.h}
      </span>
      {animating && <span className="animating">Animating</span>}
    </div>
  );
}

function Pins() {
  const viewer = useViewer();
  const model = useViewerState((s) => s.model);
  useViewerState((s) => s.scrollTick); // pins follow layers that scroll
  useViewerState((s) => s.hiddenLayers); // and hide with them
  const comments = useViewerState((s) => s.comments);
  return comments
    .filter((c) => !c.resolved && !model.frames.find((f) => f.name === c.frame)?.modified)
    .map((comment) => {
      const at = pinPosition(comment, model);
      return (
        at && (
          <button
            key={comment.id}
            className={`anchored pin${comment.attached ? "" : " detached"}`}
            style={anchor(at)}
            title={comment.text}
            onClick={() => viewer.focusComment(comment)}
          >
            {comment.id}
          </button>
        )
      );
    });
}

function sizeText(node: ViewNode, axis: "width" | "height") {
  const mode = sizing(node, axis);
  const value = Math.round(node.layout[axis] * 100) / 100;
  return mode && mode !== "Fixed" ? `${value} ${mode}` : String(value);
}

/** "182 Fill × 20 Hug" under the selected layer. Artboards show their size in the title instead. */
function SizeBadge() {
  const viewer = useViewer();
  const selected = useViewerState((s) => s.selected);
  useViewerState((s) => s.model); // the selected key can point at a new node after a rebuild
  useViewerState((s) => s.scrollTick); // follows layers that scroll
  const node = viewer.node(selected);
  if (!node?.parent) return null;
  return (
    <div className={`anchored size-badge${node.component ? " comp" : ""}`} style={anchor(bottomCenter(node))}>
      {sizeText(node, "width")} × {sizeText(node, "height")}
    </div>
  );
}

/** While Option/Alt is held: the length of each line the renderer draws between the selected and hovered layers. */
function Measurements() {
  const viewer = useViewer();
  const measuring = useViewerState((s) => s.measuring);
  const selectedKey = useViewerState((s) => s.selected);
  const hovered = useViewerState((s) => s.hovered);
  useViewerState((s) => s.model); // keys can point at new nodes after a rebuild
  useViewerState((s) => s.scrollTick); // follows layers that scroll
  const selected = viewer.node(selectedKey);
  const target = viewer.node(hovered);
  if (!measuring || !selected || !target || target === selected) return null;
  return measure(canvasBox(selected), canvasBox(target)).gaps.map((g, i) => (
    <div
      key={i}
      className={`anchored measure-label ${g.axis}`}
      style={anchor({ x: (g.from.x + g.to.x) / 2, y: (g.from.y + g.to.y) / 2 })}
    >
      {Math.round(g.length * 100) / 100}
    </div>
  ));
}

function Notice() {
  const notice = useViewerState((s) => s.notice);
  return notice ? <div id="notice">{notice}</div> : null;
}

function CommentBox() {
  const viewer = useViewer();
  const draft = useViewerState((s) => s.draft);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    setText("");
    setSaving(false);
    input.current?.focus();
  }, [draft]);

  const node = viewer.node(draft?.key ?? null);
  if (!draft || !node) return null;

  const submit = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    if (!(await viewer.submitComment(text))) setSaving(false);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
    if (e.key === "Escape") viewer.setTool("select");
  };
  return (
    // Pointer and wheel events stay in the box instead of panning the canvas.
    <div className="anchored popover" style={anchor(draft.at)} onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
      <div className="target">
        <span className="target-frame">{node.frame.name}</span>
        <ChevronRight size={11} />
        {node.component && <Component size={11} className="target-icon" />}
        <span className="target-node">
          {node.component ? node.component.name : node.type} {describe(node)}
        </span>
      </div>
      <textarea ref={input} placeholder="What should change?" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} />
      <div className="actions">
        <button className="btn" onClick={() => viewer.setTool("select")}>
          Cancel
        </button>
        <button className="btn primary" disabled={saving || !text.trim()} onClick={submit}>
          Comment
        </button>
      </div>
    </div>
  );
}

export function Stage() {
  const viewer = useViewer();
  const ready = useViewerState((s) => s.ready);
  const tool = useViewerState((s) => s.tool);
  const clickable = useViewerState((s) => s.clickable);
  const frames = useViewerState((s) => s.model.frames);
  const stage = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const els = { stage: stage.current!, canvas: canvas.current!, overlay: overlay.current! };
    const detachViewer = viewer.attach(els);
    const detachInput = attachInput(viewer, els.stage, els.canvas);
    return () => {
      detachInput();
      detachViewer();
    };
  }, [viewer]);

  return (
    <main id="stage" ref={stage} className={tool === "comment" ? "commenting" : tool === "play" ? `playing${clickable ? " clickable" : ""}` : undefined}>
      <canvas id="canvas" ref={canvas} />
      <div id="overlay" ref={overlay}>
        {frames.map((frame) => (
          <FrameLabel key={frame.name} frame={frame} />
        ))}
        <SizeBadge />
        <Measurements />
        <Pins />
        <CommentBox />
      </div>
      <MotionStrip />
      <Notice />
      {!ready && <div id="boot">Loading…</div>}
    </main>
  );
}
