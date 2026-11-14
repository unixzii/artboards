// The canvas and the DOM overlay drawn over it (artboard titles, comment pins,
// the comment box). Overlay elements are anchored to canvas points with CSS
// variables, so they follow pan and zoom without React re-rendering.

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { attachInput } from "../input.ts";
import { describe, pinPosition, type ViewFrame } from "../model.ts";
import { useViewer, useViewerState } from "./context.ts";
import { anchor } from "./ui.tsx";

function FrameLabel({ frame }: { frame: ViewFrame }) {
  const viewer = useViewer();
  const selected = useViewerState((s) => s.selected);
  const error = frame.payload.error;
  if (error) {
    // Fills the placeholder box the renderer draws for a failed artboard.
    return (
      <div className="anchored frame-label failed" style={anchor(frame, { w: frame.w, h: frame.h })}>
        ⚠ {frame.name}
        <span className="err">
          {error.source} {error.message}
        </span>
      </div>
    );
  }
  const root = frame.root!;
  return (
    <div
      className={`anchored frame-label above${root.key === selected ? " selected" : ""}`}
      style={anchor(frame)}
      onClick={() => viewer.select(root.key)}
    >
      {frame.name}&nbsp;&nbsp;{frame.w} × {frame.h}
    </div>
  );
}

function Pins() {
  const viewer = useViewer();
  const model = useViewerState((s) => s.model);
  const comments = useViewerState((s) => s.comments);
  return comments
    .filter((c) => !c.resolved)
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
        {node.frame.name} · {node.type} {describe(node)}
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
    <main id="stage" ref={stage} className={tool === "comment" ? "commenting" : undefined}>
      <canvas id="canvas" ref={canvas} />
      <div id="overlay" ref={overlay}>
        {frames.map((frame) => (
          <FrameLabel key={frame.name} frame={frame} />
        ))}
        <Pins />
        <CommentBox />
      </div>
      {!ready && <div id="boot">Loading…</div>}
    </main>
  );
}
