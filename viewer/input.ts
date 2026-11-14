// Pointer, wheel and keyboard handling for the canvas.
//
//   drag            pan                 wheel            pan
//   click           select / comment    ctrl|cmd+wheel   zoom at cursor
//   two fingers     pinch zoom + pan    V C Esc 0 !      tools, deselect, 100%, fit

import type { Point } from "./model.ts";
import type { Viewer } from "./viewer.ts";

const DRAG_THRESHOLD = 4;

export function attachInput(viewer: Viewer, stage: HTMLElement, canvas: HTMLCanvasElement): () => void {
  const pointers = new Map<number, Point>();
  let dragged = false;
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
    }
  });

  on(stage, "pointermove", (e) => {
    const view = viewer.view;
    if (!view) return;
    const p = local(e);
    const prev = pointers.get(e.pointerId);
    if (!prev) {
      if (e.target === canvas) viewer.hover(view.hitTest(p)?.key ?? null);
      return;
    }
    if (pointers.size === 2) {
      // Pinch: zoom about the midpoint and follow it.
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)![1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(p.x - other.x, p.y - other.y);
      view.panBy((p.x - prev.x) / 2, (p.y - prev.y) / 2);
      if (before > 0) view.zoomBy(after / before, { x: (p.x + other.x) / 2, y: (p.y + other.y) / 2 });
      dragged = true;
    } else {
      if (!dragged && Math.hypot(p.x - downAt.x, p.y - downAt.y) > DRAG_THRESHOLD) {
        dragged = true;
        stage.classList.add("panning");
      }
      if (dragged) view.panBy(p.x - prev.x, p.y - prev.y);
    }
    pointers.set(e.pointerId, p);
  });

  const release = (e: PointerEvent) => {
    if (!pointers.delete(e.pointerId)) return;
    stage.classList.remove("panning");
    if (dragged || e.type === "pointercancel" || pointers.size) return;
    const p = local(e);
    if (viewer.store.get().tool === "comment") viewer.startComment(p);
    else viewer.select(viewer.view?.hitTest(p)?.key ?? null);
  };
  on(stage, "pointerup", release);
  on(stage, "pointercancel", release);
  on(stage, "pointerleave", () => viewer.hover(null));

  on(
    stage,
    "wheel",
    (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) viewer.view?.zoomBy(Math.exp(-e.deltaY * 0.01), local(e));
      else viewer.view?.panBy(-e.deltaX, -e.deltaY);
    },
    false,
  );

  on(window, "keydown", (e) => {
    if (e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === "escape") {
      if (viewer.store.get().tool === "comment") viewer.setTool("select");
      else viewer.select(null);
    } else if (key === "v") viewer.setTool("select");
    else if (key === "c") viewer.setTool("comment");
    else if (key === "!" || (e.shiftKey && e.code === "Digit1")) viewer.view?.fit();
    else if (key === "0") viewer.view?.resetZoom();
  });

  return () => abort.abort();
}
