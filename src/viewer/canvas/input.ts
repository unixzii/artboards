// Pointer, wheel and keyboard handling for the canvas.
//
//   drag            pan                 wheel            pan
//   click           select / comment    ctrl|cmd+wheel   zoom at cursor
//   play mode: click runs onClick; drag and wheel scroll `scroll` containers
//   two fingers     pinch zoom + pan    V C P Esc 0 !    tools, deselect, 100%, fit
//   hold Option/Alt  measure from the selected layer to the hovered one
//   cmd|ctrl+\      hide or show both side panels

import type { Point } from "../core/model.ts";
import type { Viewer } from "../core/viewer.ts";

const DRAG_THRESHOLD = 4;

export function attachInput(viewer: Viewer, stage: HTMLElement, canvas: HTMLCanvasElement): () => void {
  const pointers = new Map<number, Point>();
  let dragged = false;
  let capturedLayer = false;
  let downAt: Point = { x: 0, y: 0 };
  const abort = new AbortController();
  const on = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement | Window,
    type: K,
    handler: (e: HTMLElementEventMap[K]) => void,
    passive = true,
  ) => target.addEventListener(type, handler as EventListener, { signal: abort.signal, passive });

  const local = (e: { clientX: number; clientY: number }): Point => {
    const r = stage.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  on(stage, "pointerdown", (e) => {
    if (e.target !== canvas) return; // overlay elements handle their own clicks
    stage.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) {
      dragged = false;
      downAt = p;
      capturedLayer = e.button === 0 && viewer.pointerDownAt(p);
    } else if (pointers.size === 2 && capturedLayer) {
      capturedLayer = false;
      viewer.pointerUpAt(p, { dragged: true, canceled: true });
    }
  });

  on(stage, "pointermove", (e) => {
    viewer.setMeasuring(e.altKey); // catches a key pressed while the window was unfocused
    const p = local(e);
    const prev = pointers.get(e.pointerId);
    if (!prev) {
      if (e.target === canvas) viewer.pointerMoveAt(p, false);
      return;
    }
    if (pointers.size === 2) {
      // Pinch: zoom about the midpoint and follow it.
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)![1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(p.x - other.x, p.y - other.y);
      viewer.panBy((p.x - prev.x) / 2, (p.y - prev.y) / 2);
      if (before > 0) viewer.zoomBy(after / before, { x: (p.x + other.x) / 2, y: (p.y + other.y) / 2 });
      dragged = true;
    } else {
      if (!dragged && Math.hypot(p.x - downAt.x, p.y - downAt.y) > DRAG_THRESHOLD) {
        dragged = true;
        if (!capturedLayer) stage.classList.add("panning");
      }
      if (capturedLayer || !dragged) {
        viewer.pointerMoveAt(p, true);
      } else if (viewer.scrollAt(downAt, prev.x - p.x, prev.y - p.y)) {
        viewer.pointerMoveAt(p, true);
      } else {
        // Content follows the pointer, so it scrolls the opposite way to the drag.
        viewer.panBy(p.x - prev.x, p.y - prev.y);
      }
    }
    pointers.set(e.pointerId, p);
  });

  const release = (e: PointerEvent) => {
    if (!pointers.delete(e.pointerId)) return;
    stage.classList.remove("panning");
    if (pointers.size) return;
    const wasCaptured = capturedLayer;
    capturedLayer = false;
    const p = local(e);
    const canceled = e.type === "pointercancel";
    if (wasCaptured) {
      viewer.pointerUpAt(p, { dragged, canceled });
    } else if (!dragged && !canceled && e.button === 0) {
      viewer.clickAt(p);
    }
  };
  on(stage, "pointerup", release);
  on(stage, "pointercancel", release);
  on(stage, "pointerleave", (e) => viewer.pointerLeaveAt(local(e)));

  on(
    stage,
    "wheel",
    (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) viewer.zoomBy(Math.exp(-e.deltaY * 0.01), local(e));
      else if (!viewer.scrollAt(local(e), e.deltaX, e.deltaY)) viewer.panBy(-e.deltaX, -e.deltaY);
    },
    false,
  );

  const altKey = (e: KeyboardEvent) => {
    if (e.key === "Alt") viewer.setMeasuring(e.type === "keydown");
  };
  on(window, "keydown", altKey);
  on(window, "keyup", altKey);
  on(window, "blur", () => viewer.setMeasuring(false));

  on(
    window,
    "keydown",
    (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        viewer.togglePanels();
      }
    },
    false,
  );

  on(window, "keydown", (e) => {
    if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === "escape") viewer.cancel();
    else if (key === "v") viewer.setTool("select");
    else if (key === "c") viewer.setTool("comment");
    else if (key === "p") viewer.setTool("play");
    else if (key === "!" || (e.shiftKey && e.code === "Digit1")) viewer.fit();
    else if (key === "0") viewer.resetZoom();
  });

  return () => abort.abort();
}
