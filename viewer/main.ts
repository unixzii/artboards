// Browser viewer: paints the dev server's scene with CanvasKit (WebGL) and
// handles pan/zoom, selection, inspection and review comments.

import type { Canvas, CanvasKit, Paint, SkPicture, Surface } from "canvaskit-wasm";
import type { ResolvedComment } from "../src/comments.ts";
import type { Diagnostic } from "../src/lint.ts";
import { paintNode } from "../src/paint.ts";
import type { SceneNode } from "../src/scene.ts";
import type { FramePayload, ScenePayload, SerializedNode } from "../src/serialize.ts";
import { BASE_FAMILY, releaseParagraphs, type TextEngine } from "../src/text.ts";

declare const CanvasKitInit: (opts: { locateFile(file: string): string }) => Promise<CanvasKit>;

interface ViewNode extends SceneNode {
  /** "<artboard>/<path>", stable across rebuilds. */
  key: string;
  path: string;
  frame: ViewFrame;
  /** Top-left within the artboard. */
  abs: { x: number; y: number };
  children: ViewNode[];
  parent: ViewNode | null;
}

interface ViewFrame {
  name: string;
  payload: FramePayload;
  root: ViewNode | null;
  x: number;
  y: number;
  w: number;
  h: number;
  picture: SkPicture | null;
  label: HTMLElement;
}

// ------------------------------------------------------------------ DOM utils

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function h(tag: string, attrs: Record<string, any> = {}, ...children: (Node | string | null | undefined | false)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "style") Object.assign(el.style, v);
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c != null && c !== false) el.append(c);
  return el;
}

const stage = $("stage");
const canvasEl = $<HTMLCanvasElement>("canvas");
const overlay = $("overlay");
const app = $("app");

// ---------------------------------------------------------------------- state

let ck: CanvasKit;
let engine: TextEngine;
let surface: Surface | null = null;
let paints: { white: Paint; select: Paint; hover: Paint; error: Paint };

let scene: ScenePayload | null = null;
let frames: ViewFrame[] = [];
const nodes = new Map<string, ViewNode>();
const layerRows = new Map<string, HTMLElement>();
let pins: { comment: ResolvedComment; el: HTMLElement }[] = [];

const view = { s: 1, tx: 0, ty: 0 };
let selected: string | null = null;
let hovered: string | null = null;
let tool: "select" | "comment" = "select";
let popover: { el: HTMLElement; frame: ViewFrame; x: number; y: number } | null = null;
let fitted = false;
let nextId = 1;

// -------------------------------------------------------------------- loading

const fontLoads = new Map<string, Promise<void>>();

function ensureFonts(faces: ScenePayload["fonts"]) {
  return Promise.all(
    faces.map((face) => {
      let load = fontLoads.get(face.path);
      if (!load) {
        load = fetch(`/fonts/${face.path}`)
          .then((r) => r.arrayBuffer())
          .then((bytes) => engine.fonts.provider.registerFont(bytes, face.family));
        fontLoads.set(face.path, load);
      }
      return load;
    }),
  );
}

function hydrate(s: SerializedNode, frame: ViewFrame, path: string, parent: ViewNode | null): ViewNode {
  const isRoot = parent === null;
  const layout = isRoot ? { ...s.layout, x: 0, y: 0 } : s.layout;
  const node: ViewNode = {
    id: nextId++,
    type: s.type,
    props: s.props,
    layout,
    fontFamilies: s.fontFamilies,
    children: [],
    parent,
    key: `${frame.name}/${path}`,
    path,
    frame,
    abs: { x: (parent?.abs.x ?? 0) + layout.x, y: (parent?.abs.y ?? 0) + layout.y },
  };
  node.children = s.children.map((c, i) => hydrate(c, frame, path === "" ? String(i) : `${path}.${i}`, node));
  nodes.set(node.key, node);
  return node;
}

function record(root: ViewNode): SkPicture {
  const recorder = new ck.PictureRecorder();
  const canvas = recorder.beginRecording(ck.LTRBRect(0, 0, root.layout.width, root.layout.height));
  paintNode(engine, canvas, root);
  const picture = recorder.finishRecordingAsPicture();
  recorder.delete();
  return picture;
}

const GAP = 120;
const ROW_WIDTH = 6000;
const FAILED = { w: 480, h: 200 };

async function setScene(next: ScenePayload) {
  await ensureFonts(next.fonts ?? []);

  for (const f of frames) {
    f.picture?.delete();
    if (f.root) releaseParagraphs(f.root);
  }
  nodes.clear();
  overlay.querySelectorAll(".frame-label, .pin").forEach((el) => el.remove());
  scene = next;

  // Artboards are placed automatically, left to right, wrapping into rows.
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  frames = (next.frames ?? []).map((payload) => {
    const w = payload.root?.layout.width ?? FAILED.w;
    const hgt = payload.root?.layout.height ?? FAILED.h;
    if (x > 0 && x + w > ROW_WIDTH) {
      x = 0;
      y += rowHeight + GAP + 40;
      rowHeight = 0;
    }
    const frame: ViewFrame = { name: payload.name, payload, root: null, x, y, w, h: hgt, picture: null, label: h("div") };
    if (payload.root) {
      frame.root = hydrate(payload.root, frame, "", null);
      frame.picture = record(frame.root);
    }
    frame.label = h(
      "div",
      { class: `frame-label${payload.error ? " failed" : ""}`, onclick: () => frame.root && select(frame.root.key) },
      payload.error ? `⚠ ${frame.name}` : `${frame.name}  ${w} × ${hgt}`,
      payload.error ? h("span", { class: "err" }, `${payload.error.source ?? ""} ${payload.error.message}`.trim()) : null,
    );
    overlay.append(frame.label);
    x += w + GAP;
    rowHeight = Math.max(rowHeight, hgt);
    return frame;
  });

  pins = (next.comments ?? [])
    .filter((c) => !c.resolved && frames.some((f) => f.name === c.frame))
    .map((comment) => {
      const el = h(
        "button",
        { class: `pin${comment.attached ? "" : " detached"}`, title: comment.text, onclick: () => focusComment(comment) },
        String(comment.id),
      );
      overlay.append(el);
      return { comment, el };
    });

  $("file").textContent = next.file ?? "Artboards";
  document.title = `${next.file ?? "Artboards"} — Artboards`;
  renderLayers();
  renderProblems();
  renderComments();

  if (selected && !nodes.has(selected)) selected = null;
  if (!fitted && frames.length) {
    fitted = true;
    const fromHash = decodeURIComponent(location.hash.slice(1));
    if (nodes.has(fromHash)) selected = fromHash;
    fit();
  }
  applySelection();
  requestDraw();
}

// -------------------------------------------------------------------- drawing

let drawQueued = false;
function requestDraw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => {
    drawQueued = false;
    draw();
  });
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(stage.clientWidth * dpr));
  const hgt = Math.max(1, Math.round(stage.clientHeight * dpr));
  if (surface && canvasEl.width === w && canvasEl.height === hgt) return;
  surface?.delete();
  canvasEl.width = w;
  canvasEl.height = hgt;
  surface = ck.MakeWebGLCanvasSurface(canvasEl) ?? ck.MakeSWCanvasSurface(canvasEl);
  requestDraw();
}

function outline(canvas: Canvas, node: ViewNode, paint: Paint, width: number) {
  paint.setStrokeWidth(width / view.s);
  const x = node.frame.x + node.abs.x;
  const y = node.frame.y + node.abs.y;
  canvas.drawRect(ck.LTRBRect(x, y, x + node.layout.width, y + node.layout.height), paint);
}

function draw() {
  if (!surface) return;
  const dpr = window.devicePixelRatio || 1;
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const canvas = surface.getCanvas();
  canvas.clear(dark ? ck.Color(30, 30, 33) : ck.Color(236, 236, 239));
  canvas.save();
  canvas.scale(dpr, dpr);
  canvas.translate(view.tx, view.ty);
  canvas.scale(view.s, view.s);

  // Only artboards that intersect the viewport are replayed.
  const left = -view.tx / view.s;
  const top = -view.ty / view.s;
  const right = left + stage.clientWidth / view.s;
  const bottom = top + stage.clientHeight / view.s;
  for (const f of frames) {
    if (f.x > right || f.y > bottom || f.x + f.w < left || f.y + f.h < top) continue;
    const rect = ck.LTRBRect(f.x, f.y, f.x + f.w, f.y + f.h);
    if (f.picture) {
      canvas.drawRect(rect, paints.white);
      canvas.save();
      canvas.translate(f.x, f.y);
      canvas.drawPicture(f.picture);
      canvas.restore();
    } else {
      paints.error.setStrokeWidth(1.5 / view.s);
      canvas.drawRect(rect, paints.error);
    }
  }

  const hoverNode = hovered && hovered !== selected ? nodes.get(hovered) : null;
  if (hoverNode) outline(canvas, hoverNode, paints.hover, 1.5);
  const selectedNode = selected ? nodes.get(selected) : null;
  if (selectedNode) outline(canvas, selectedNode, paints.select, 2);

  canvas.restore();
  surface.flush();
  positionOverlay();
}

function positionOverlay() {
  const at = (el: HTMLElement, wx: number, wy: number, extra = "") => {
    el.style.transform = `translate(${wx * view.s + view.tx}px, ${wy * view.s + view.ty}px) ${extra}`;
  };
  for (const f of frames) {
    at(f.label, f.x, f.y, f.payload.error ? "" : "translateY(-100%)");
    if (f.payload.error) {
      // The error text lives inside the placeholder box, whatever the zoom.
      f.label.style.width = `${f.w * view.s}px`;
      f.label.style.height = `${f.h * view.s}px`;
    }
  }
  for (const { comment, el } of pins) {
    const f = frames.find((fr) => fr.name === comment.frame)!;
    // Stay where the reviewer clicked while that is still on the layer; follow the layer if it moved.
    const n = comment.attached ? nodes.get(`${comment.frame}/${comment.path}`) : null;
    let { x, y } = comment.point;
    if (n && (x < n.abs.x || y < n.abs.y || x > n.abs.x + n.layout.width || y > n.abs.y + n.layout.height)) {
      x = n.abs.x + n.layout.width / 2;
      y = n.abs.y + n.layout.height / 2;
    }
    at(el, f.x + x, f.y + y);
  }
  if (popover) at(popover.el, popover.frame.x + popover.x, popover.frame.y + popover.y, "translate(8px, 8px)");
  $("zoom").textContent = `${Math.round(view.s * 100)}%`;
}

// ------------------------------------------------------------------- viewport

function zoomAt(sx: number, sy: number, factor: number) {
  const s = Math.min(64, Math.max(0.02, view.s * factor));
  view.tx = sx - ((sx - view.tx) * s) / view.s;
  view.ty = sy - ((sy - view.ty) * s) / view.s;
  view.s = s;
  requestDraw();
}

function fit() {
  if (!frames.length) return;
  const x0 = Math.min(...frames.map((f) => f.x));
  const y0 = Math.min(...frames.map((f) => f.y));
  const x1 = Math.max(...frames.map((f) => f.x + f.w));
  const y1 = Math.max(...frames.map((f) => f.y + f.h));
  const pad = stage.clientWidth < 600 ? 24 : 64;
  const s = Math.min(1, (stage.clientWidth - pad * 2) / (x1 - x0), (stage.clientHeight - pad * 2 - 24) / (y1 - y0));
  view.s = Math.max(0.02, s);
  view.tx = (stage.clientWidth - (x1 - x0) * view.s) / 2 - x0 * view.s;
  view.ty = (stage.clientHeight - (y1 - y0) * view.s) / 2 - y0 * view.s + 12;
  requestDraw();
}

/** Pans so the node is on screen, without changing zoom. */
function reveal(node: ViewNode) {
  const x = (node.frame.x + node.abs.x) * view.s + view.tx;
  const y = (node.frame.y + node.abs.y) * view.s + view.ty;
  const w = node.layout.width * view.s;
  const hgt = node.layout.height * view.s;
  if (x + w < 40 || x > stage.clientWidth - 40) view.tx += stage.clientWidth / 2 - (x + w / 2);
  if (y + hgt < 40 || y > stage.clientHeight - 40) view.ty += stage.clientHeight / 2 - (y + hgt / 2);
}

const toWorld = (sx: number, sy: number) => ({ x: (sx - view.tx) / view.s, y: (sy - view.ty) / view.s });

function hitNode(n: ViewNode, px: number, py: number): ViewNode | null {
  const lx = px - n.layout.x;
  const ly = py - n.layout.y;
  const inside = lx >= 0 && ly >= 0 && lx <= n.layout.width && ly <= n.layout.height;
  if (n.props.clip && !inside) return null;
  for (let i = n.children.length - 1; i >= 0; i--) {
    const hit = hitNode(n.children[i], lx, ly);
    if (hit) return hit;
  }
  return inside ? n : null;
}

function hitTest(sx: number, sy: number): ViewNode | null {
  const p = toWorld(sx, sy);
  for (let i = frames.length - 1; i >= 0; i--) {
    const f = frames[i];
    if (!f.root || p.x < f.x || p.y < f.y || p.x > f.x + f.w || p.y > f.y + f.h) continue;
    return hitNode(f.root, p.x - f.x, p.y - f.y);
  }
  return null;
}

// ------------------------------------------------------------------ selection

function select(key: string | null, opts: { reveal?: boolean } = {}) {
  selected = key && nodes.has(key) ? key : null;
  const node = selected ? nodes.get(selected)! : null;
  if (node && opts.reveal) reveal(node);
  history.replaceState(null, "", selected ? `#${encodeURIComponent(selected)}` : location.pathname);
  applySelection();
  requestDraw();
}

function applySelection() {
  for (const [key, row] of layerRows) row.classList.toggle("selected", key === selected);
  for (const f of frames) f.label.classList.toggle("selected", !!f.root && f.root.key === selected);
  app.classList.toggle("has-selection", !!selected);
  if (selected) layerRows.get(selected)?.scrollIntoView({ block: "nearest" });
  renderProps();
}

function setHover(key: string | null) {
  if (hovered === key) return;
  if (hovered) layerRows.get(hovered)?.classList.remove("hover");
  hovered = key;
  if (hovered) layerRows.get(hovered)?.classList.add("hover");
  requestDraw();
}

function setTool(next: "select" | "comment") {
  tool = next;
  $("tool-select").classList.toggle("on", tool === "select");
  $("tool-comment").classList.toggle("on", tool === "comment");
  stage.classList.toggle("commenting", tool === "comment");
  if (tool === "select") closePopover();
}

// --------------------------------------------------------------------- panels

function describe(n: ViewNode): string {
  if (n.type === "Text") return String(n.props.children ?? "");
  return n.props.name ?? "";
}

function renderLayers() {
  const box = $("layers");
  box.replaceChildren();
  layerRows.clear();
  const add = (n: ViewNode, depth: number) => {
    const row = h(
      "div",
      {
        class: `layer${depth === 0 ? " artboard" : ""}`,
        style: { paddingLeft: `${12 + depth * 14}px` },
        onclick: () => select(n.key, { reveal: true }),
        onmouseenter: () => setHover(n.key),
        onmouseleave: () => setHover(null),
      },
      h("span", { class: "type" }, depth === 0 ? n.frame.name : n.type),
      h("span", { class: "detail" }, depth === 0 ? n.type : describe(n)),
    );
    layerRows.set(n.key, row);
    box.append(row);
    for (const c of n.children) add(c, depth + 1);
  };
  for (const f of frames) {
    if (f.root) add(f.root, 0);
    else box.append(h("div", { class: "layer artboard failed" }, h("span", { class: "type" }, `⚠ ${f.name}`), h("span", { class: "detail" }, "failed to render")));
  }
  if (!frames.length) box.append(h("div", { class: "empty" }, "No artboards."));
}

function problemItem(d: Diagnostic): HTMLElement {
  const key = d.frame != null && d.node != null ? `${d.frame}/${d.node}` : null;
  return h(
    "div",
    { class: `item ${d.severity}`, onclick: () => key && select(key, { reveal: true }) },
    h("div", { class: "head" }, h("span", { class: "rule" }, d.rule), h("span", {}, d.source ?? "")),
    h("div", { class: "body" }, d.message),
  );
}

function renderProblems() {
  const list = scene?.diagnostics ?? [];
  const errors = list.filter((d) => d.severity === "error").length;
  $("problems").replaceChildren(...(list.length ? list.map(problemItem) : [h("div", { class: "empty" }, "No problems.")]));
  $("problem-count").textContent = list.length ? `(${list.length})` : "";
  const status = $("status");
  status.textContent = list.length ? `${errors} error${errors === 1 ? "" : "s"}, ${list.length - errors} warning${list.length - errors === 1 ? "" : "s"}` : "No problems";
  status.classList.toggle("bad", errors > 0);
}

function commentItem(c: ResolvedComment): HTMLElement {
  const patch = (body: object | null) =>
    fetch(`/api/comments/${c.id}`, {
      method: body ? "PATCH" : "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  const stop = (fn: () => void) => (e: Event) => {
    e.stopPropagation();
    fn();
  };
  return h(
    "div",
    { class: `item${c.resolved ? " resolved" : ""}`, onclick: () => focusComment(c) },
    h(
      "div",
      { class: "head" },
      h("span", { class: "num" }, String(c.id)),
      h("span", {}, `${c.frame} ${c.target ?? ""}`),
      !c.attached && h("span", { class: "badge" }, "layer changed"),
    ),
    h("div", { class: "body" }, c.text),
    h(
      "div",
      { class: "actions" },
      h("button", { class: "link", onclick: stop(() => patch({ resolved: !c.resolved })) }, c.resolved ? "Reopen" : "Resolve"),
      h("button", { class: "link", onclick: stop(() => patch(null)) }, "Delete"),
    ),
  );
}

function renderComments() {
  const list = [...(scene?.comments ?? [])].sort((a, b) => Number(a.resolved) - Number(b.resolved) || a.id - b.id);
  const open = list.filter((c) => !c.resolved).length;
  $("comments").replaceChildren(
    ...(list.length ? list.map(commentItem) : [h("div", { class: "empty" }, "No comments. Press C, then click a layer.")]),
  );
  $("comment-count").textContent = list.length ? `(${open} open)` : "";
}

function focusComment(c: ResolvedComment) {
  const key = `${c.frame}/${c.path}`;
  if (c.attached && nodes.has(key)) select(key, { reveal: true });
}

const COLOR_PROPS = new Set(["fill", "stroke", "color"]);
const HIDDEN_PROPS = new Set(["$source", "children", "name"]);

function renderProps() {
  const box = $("props");
  const n = selected ? nodes.get(selected) : null;
  if (!n) {
    box.replaceChildren(h("div", { class: "empty" }, "Click a layer to inspect it."));
    return;
  }
  const source: string = n.props.$source ?? "";
  const metric = (k: string, v: number) => h("div", { class: "metric" }, h("span", {}, k), h("span", {}, String(Math.round(v * 100) / 100)));
  const rows = Object.entries(n.props)
    .filter(([k]) => !HIDDEN_PROPS.has(k))
    .map(([k, v]) =>
      h(
        "div",
        { class: "row" },
        h("span", { class: "k" }, k),
        h(
          "span",
          { class: "v" },
          COLOR_PROPS.has(k) && typeof v === "string" && h("span", { class: "swatch", style: { background: v } }),
          typeof v === "string" ? v : JSON.stringify(v),
        ),
      ),
    );
  const mine = (scene?.diagnostics ?? []).filter((d) => d.frame === n.frame.name && d.node === n.path);
  const parts = [
    h(
      "div",
      { class: "prop-head" },
      h("div", { class: "title" }, n.type, n.props.name ? ` “${n.props.name}”` : ""),
      h("div", { class: "source" }, source ? h("button", { class: "link", title: "Copy", onclick: () => navigator.clipboard?.writeText(source) }, source) : n.frame.name),
    ),
    h("div", { class: "metrics" }, metric("X", n.abs.x), metric("Y", n.abs.y), metric("W", n.layout.width), metric("H", n.layout.height)),
    n.type === "Text" && h("div", { class: "text-content" }, String(n.props.children ?? "")),
    rows.length ? h("div", { class: "rows" }, ...rows) : null,
    ...mine.map(problemItem),
  ];
  box.replaceChildren(...parts.filter((part): part is HTMLElement => !!part));
}

// ------------------------------------------------------------------- comments

function closePopover() {
  popover?.el.remove();
  popover = null;
}

function openPopover(node: ViewNode, sx: number, sy: number) {
  closePopover();
  const world = toWorld(sx, sy);
  const point = { x: world.x - node.frame.x, y: world.y - node.frame.y };
  const input = h("textarea", { placeholder: "What should change?" }) as HTMLTextAreaElement;
  const save = h("button", { class: "btn primary" }, "Comment") as HTMLButtonElement;
  const submit = async () => {
    if (!input.value.trim()) return;
    save.disabled = true;
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ frame: node.frame.name, path: node.path, nodeType: node.type, hint: describe(node), point, text: input.value }),
    });
    if (res.ok) setTool("select");
    else save.disabled = false;
  };
  save.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
    if (e.key === "Escape") setTool("select");
  });
  const el = h(
    "div",
    { class: "popover", onpointerdown: (e: Event) => e.stopPropagation(), onwheel: (e: Event) => e.stopPropagation() },
    h("div", { class: "target" }, `${node.frame.name} · ${node.type} ${describe(node)}`),
    input,
    h("div", { class: "actions" }, h("button", { class: "btn", onclick: () => setTool("select") }, "Cancel"), save),
  );
  overlay.append(el);
  popover = { el, frame: node.frame, x: point.x, y: point.y };
  select(node.key);
  positionOverlay();
  input.focus();
}

// ---------------------------------------------------------------------- input

const pointers = new Map<number, { x: number; y: number }>();
let dragged = false;
let downAt = { x: 0, y: 0 };

const local = (e: { clientX: number; clientY: number }) => {
  const r = stage.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};

stage.addEventListener("pointerdown", (e) => {
  if (e.target !== canvasEl) return;
  stage.setPointerCapture(e.pointerId);
  const p = local(e);
  pointers.set(e.pointerId, p);
  if (pointers.size === 1) {
    dragged = false;
    downAt = p;
  }
});

stage.addEventListener("pointermove", (e) => {
  const p = local(e);
  const prev = pointers.get(e.pointerId);
  if (!prev) {
    if (e.target === canvasEl) setHover(hitTest(p.x, p.y)?.key ?? null);
    return;
  }
  if (pointers.size === 2) {
    // Pinch: zoom about the midpoint and follow it.
    const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)![1];
    const before = Math.hypot(prev.x - other.x, prev.y - other.y);
    const after = Math.hypot(p.x - other.x, p.y - other.y);
    const mid = { x: (p.x + other.x) / 2, y: (p.y + other.y) / 2 };
    view.tx += (p.x - prev.x) / 2;
    view.ty += (p.y - prev.y) / 2;
    if (before > 0) zoomAt(mid.x, mid.y, after / before);
    dragged = true;
  } else {
    if (!dragged && Math.hypot(p.x - downAt.x, p.y - downAt.y) > 4) {
      dragged = true;
      stage.classList.add("panning");
    }
    if (dragged) {
      view.tx += p.x - prev.x;
      view.ty += p.y - prev.y;
      requestDraw();
    }
  }
  pointers.set(e.pointerId, p);
});

const release = (e: PointerEvent) => {
  if (!pointers.delete(e.pointerId)) return;
  stage.classList.remove("panning");
  if (dragged || e.type === "pointercancel" || pointers.size) return;
  const p = local(e);
  const hit = hitTest(p.x, p.y);
  if (tool === "comment") {
    if (hit) openPopover(hit, p.x, p.y);
  } else {
    select(hit?.key ?? null);
  }
};
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);
stage.addEventListener("pointerleave", () => setHover(null));

stage.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const p = local(e);
    if (e.ctrlKey || e.metaKey) {
      zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.01));
    } else {
      view.tx -= e.deltaX;
      view.ty -= e.deltaY;
      requestDraw();
    }
  },
  { passive: false },
);

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "Escape") {
    if (tool === "comment") setTool("select");
    else select(null);
  } else if (e.key === "v" || e.key === "V") setTool("select");
  else if (e.key === "c" || e.key === "C") setTool("comment");
  else if (e.key === "!" || (e.shiftKey && e.code === "Digit1")) fit();
  else if (e.key === "0") zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 1 / view.s);
});

$("tool-select").addEventListener("click", () => setTool("select"));
$("tool-comment").addEventListener("click", () => setTool("comment"));
$("fit").addEventListener("click", fit);
$("zoom").addEventListener("click", () => zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 1 / view.s));
$("zoom-in").addEventListener("click", () => zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 1.25));
$("zoom-out").addEventListener("click", () => zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 0.8));

// ----------------------------------------------------------------------- boot

async function main() {
  ck = await CanvasKitInit({ locateFile: (f) => `/canvaskit/${f}` });
  engine = {
    ck,
    fonts: {
      provider: ck.TypefaceFontProvider.Make(),
      // Nodes arrive with their families resolved by the server.
      resolve: () => ({ families: [BASE_FAMILY], missing: [] }),
    },
  };
  const stroke = (r: number, g: number, b: number, a = 1) => {
    const p = new ck.Paint();
    p.setAntiAlias(true);
    p.setStyle(ck.PaintStyle.Stroke);
    p.setColor(ck.Color(r, g, b, a));
    return p;
  };
  const white = new ck.Paint();
  white.setColor(ck.WHITE);
  paints = { white, select: stroke(37, 99, 235), hover: stroke(37, 99, 235, 0.55), error: stroke(220, 38, 38) };

  resize();
  new ResizeObserver(resize).observe(stage);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", requestDraw);

  // Scenes are applied in order even if one is still loading fonts.
  let queue = Promise.resolve();
  const apply = (payload: ScenePayload) => {
    queue = queue.then(() => setScene(payload)).catch((e) => console.error(e));
    return queue;
  };
  await apply(await (await fetch("/api/scene")).json());
  $("boot").hidden = true;
  document.documentElement.dataset.ready = "true";

  const events = new EventSource("/api/events");
  events.addEventListener("scene", (e) => apply(JSON.parse((e as MessageEvent).data)));
}

main().catch((e) => {
  $("boot").textContent = `Failed to start: ${e?.message ?? e}`;
  console.error(e);
});
