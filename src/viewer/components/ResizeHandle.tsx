// Pointer-captured drag divider used by resizable side panels and stacked sections.

import { useRef, useState, type PointerEvent } from "react";

export interface ResizeHandleProps {
  /** "vertical" resizes left/right width; "horizontal" resizes top/bottom height. */
  orientation: "vertical" | "horizontal";
  onDelta: (deltaPx: number) => void;
  onReset?: () => void;
}

export function ResizeHandle({ orientation, onDelta, onReset }: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const lastPos = useRef(0);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    lastPos.current = orientation === "vertical" ? e.clientX : e.clientY;
    setDragging(true);
    document.body.dataset.resizing = orientation;
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const pos = orientation === "vertical" ? e.clientX : e.clientY;
    const delta = pos - lastPos.current;
    if (delta !== 0) {
      lastPos.current = pos;
      onDelta(delta);
    }
  };

  const stop = () => {
    if (!dragging) return;
    setDragging(false);
    delete document.body.dataset.resizing;
  };

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={`resize-handle resize-${orientation}${dragging ? " is-dragging" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onDoubleClick={onReset}
    />
  );
}
