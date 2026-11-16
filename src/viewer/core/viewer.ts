// The viewer's controller: coordinates the live design host, UI state, and
// stage backend.

import { resolveComment } from "../../shared/comments.ts";
import type { Diagnostic } from "../../shared/diagnostics.ts";
import type { VariantValue } from "../../shared/dsl/variants.ts";
import type { RenderEngine } from "../../shared/engine.ts";
import type { BuildPayload, Comment, ResolvedComment } from "../../shared/protocol.ts";
import type { MouseEvent, SceneNode } from "../../shared/scene.ts";
import { DesignHost } from "../runtime/host.ts";
import type { Backend } from "./backend.ts";
import { buildModel, captureTarget, describe, EMPTY_MODEL, isClickable, mouseTarget, nodeKey, scrollNode, scrollTarget, toLayer, type ViewFrame, type Model, type Point, type ViewNode } from "./model.ts";
import { createStore } from "./store.ts";

/** select: inspect layers; comment: pin a comment to a layer; play: run the design's interaction handlers. */
export type Tool = "select" | "comment" | "play";

/** A comment being written: the layer it is for and where on the canvas it was started. */
export interface Draft {
  key: string;
  /** Canvas coordinates of the click. */
  at: Point;
}

export interface ViewerState {
  ready: boolean;
  file: string;
  model: Model;
  diagnostics: Diagnostic[];
  comments: ResolvedComment[];
  selected: string | null;
  hovered: string | null;
  tool: Tool;
  /** Zoom in whole percent. */
  zoom: number;
  draft: Draft | null;
  /** In play mode, whether the pointer is over a layer with an onClick. */
  clickable: boolean;
  /** A short message shown over the canvas, e.g. why a click did nothing. */
  notice: string | null;
  /** Bumped whenever a container scrolls, so overlays anchored to layers follow. */
  scrollTick: number;
  /** Option/Alt is held: show distances from the selected layer to the hovered one. */
  measuring: boolean;
  /** Both side panels are hidden, leaving the canvas the whole window. */
  panelsHidden: boolean;
  /** "static": a site from `artboards build`; comments stay in this browser until exported. */
  mode: Backend["mode"];
}

export interface StageElements {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  overlay: HTMLElement;
}

/** Imperative stage renderer contract implemented by the CanvasKit surface. */
export interface StageBackend {
  setModel(model: Model): void;
  /** Repaints one artboard after something inside it moved, e.g. a scroll. */
  refreshFrame(frame: ViewFrame): void;
  /** `measuring`: draw the distances between the two instead of a plain hover outline. */
  setHighlight(selected: ViewNode | null, hovered: ViewNode | null, measuring: boolean): void;
  toWorld(screen: Point): Point;
  hitTest(screen: Point): ViewNode | null;
  panBy(dx: number, dy: number): void;
  zoomBy(factor: number, at?: Point): void;
  resetZoom(): void;
  fit(): void;
  reveal(node: ViewNode): void;
  dispose(): void;
}

export type StageBackendFactory = (els: StageElements, onZoom: (scale: number) => void) => StageBackend;

export class Viewer {
  readonly store = createStore<ViewerState>({
    ready: false,
    file: "",
    model: EMPTY_MODEL,
    diagnostics: [],
    comments: [],
    selected: null,
    hovered: null,
    tool: "select",
    zoom: 100,
    draft: null,
    clickable: false,
    notice: null,
    scrollTick: 0,
    measuring: false,
    panelsHidden: false,
    mode: "dev",
  });
  private backend: Backend;
  private createStage: StageBackendFactory;
  private host: DesignHost;
  private renderer: StageBackend | null = null;
  /** Whether the view has been fitted to the first scene that had artboards. */
  private fitted = false;
  private file = "";
  private loadedVersion: number | null = null;
  private buildErrors: Diagnostic[] = [];
  private typeErrors: Diagnostic[] = [];
  private rawComments: Comment[] = [];
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;
  /** Scroll offsets by layer key; viewer state only, kept across rebuilds and tools. */
  private scrolls = new Map<string, Point>();
  /** Layer key captured on primary pointerdown in Play mode. */
  private capturedKey: string | null = null;

  constructor(engine: RenderEngine, backend: Backend, createStage: StageBackendFactory) {
    this.backend = backend;
    this.createStage = createStage;
    this.store.set({ mode: backend.mode });
    this.host = new DesignHost(
      engine,
      () => this.syncScene(),
      () => {
        if (this.store.get().ready) this.store.set({ diagnostics: this.mergedDiagnostics() });
      },
    );
  }

  /** Binds to the stage elements and starts receiving builds. Returns the teardown. */
  attach(els: StageElements): () => void {
    const renderer = this.createStage(els, (s) => this.store.set({ zoom: Math.round(s * 100) }));
    this.renderer = renderer;

    const onBuild = (payload: BuildPayload) => {
      if (payload.version !== null && this.loadedVersion !== null && payload.version < this.loadedVersion) return;
      this.file = payload.file ?? "";
      this.buildErrors = payload.buildErrors ?? [];
      this.typeErrors = payload.typeErrors ?? [];
      this.rawComments = payload.comments ?? [];
      if (payload.version === null) {
        this.loadedVersion = null;
        this.host.clear();
        this.syncScene();
      } else if (payload.version !== this.loadedVersion) {
        this.loadedVersion = payload.version;
        void this.host.loadBundle(payload.version, this.file);
      } else {
        this.syncScene();
      }
    };

    const onTypecheck = (diagnostics: Diagnostic[]) => {
      this.typeErrors = diagnostics;
      if (this.store.get().ready) this.store.set({ diagnostics: this.mergedDiagnostics() });
    };

    const onComments = (comments: Comment[]) => {
      this.rawComments = comments;
      if (this.store.get().ready) this.store.set({ comments: this.resolvedComments() });
    };

    const unsubscribe = this.backend.connect({ onBuild, onTypecheck, onComments });
    return () => {
      unsubscribe();
      this.host.dispose();
      renderer.dispose();
      this.renderer = null;
    };
  }

  node(key: string | null): ViewNode | null {
    return (key && this.store.get().model.nodes.get(key)) || null;
  }

  private mergedDiagnostics(): Diagnostic[] {
    return [...this.typeErrors, ...this.buildErrors, ...this.host.diagnostics];
  }

  /**
   * Comments matched against the current trees. Comments are about an
   * artboard's initial state, so a modified artboard keeps the matches it had
   * before it was changed.
   */
  private resolvedComments(): ResolvedComment[] {
    const roots = new Map<string, SceneNode>();
    const modified = new Set<string>();
    for (const f of this.host.frames) {
      if (f.root) roots.set(f.name, f.root);
      if (f.modified) modified.add(f.name);
    }
    const before = new Map(this.store.get().comments.map((c) => [c.id, c]));
    return this.rawComments.map((c) => {
      const kept = modified.has(c.frame) ? before.get(c.id) : undefined;
      return kept ? { ...kept, ...c } : resolveComment(c, roots.get(c.frame));
    });
  }

  private syncScene() {
    const renderer = this.renderer;
    if (!renderer) return;
    const model = buildModel(this.host.frames, this.scrolls);
    renderer.setModel(model);

    const prev = this.store.get();
    const first = !this.fitted && model.frames.length > 0;
    if (first) this.fitted = true;
    const keep = (key: string | null) => (key && model.nodes.has(key) ? key : null);
    // A link to a layer (#Artboard/path) selects it on first load.
    const selected = first ? keep(decodeURIComponent(location.hash.slice(1))) : keep(prev.selected);
    this.store.set({
      ready: true,
      file: this.file,
      model,
      diagnostics: this.mergedDiagnostics(),
      comments: this.resolvedComments(),
      selected,
      hovered: keep(prev.hovered),
      draft: prev.draft && model.nodes.get(prev.draft.key)?.frame.modified === false ? prev.draft : null,
    });
    this.syncHighlight();
    if (first) renderer.fit();
  }

  private syncHighlight() {
    const { selected, hovered, measuring } = this.store.get();
    this.renderer?.setHighlight(this.node(selected), this.node(hovered), measuring);
  }

  // ----------------------------------------------------------------- viewport

  panBy(dx: number, dy: number) {
    this.renderer?.panBy(dx, dy);
  }

  zoomBy(factor: number, at?: Point) {
    this.renderer?.zoomBy(factor, at);
  }

  zoomIn() {
    this.zoomBy(1.25);
  }

  zoomOut() {
    this.zoomBy(0.8);
  }

  resetZoom() {
    this.renderer?.resetZoom();
  }

  fit() {
    this.renderer?.fit();
  }

  // ---------------------------------------------------------------- selection

  select(key: string | null, opts: { reveal?: boolean } = {}) {
    const node = this.node(key);
    this.store.set({ selected: node?.key ?? null });
    history.replaceState(null, "", node ? `#${encodeURIComponent(node.key)}` : location.pathname);
    this.syncHighlight();
    if (node && opts.reveal) this.renderer?.reveal(node);
  }

  /** Option/Alt pressed or released. Measuring works with the select tool only. */
  setMeasuring(held: boolean) {
    const measuring = held && this.store.get().tool === "select";
    if (measuring === this.store.get().measuring) return;
    this.store.set({ measuring });
    this.syncHighlight();
  }

  hover(key: string | null) {
    this.store.set({ hovered: key, ...(key === null && this.store.get().clickable ? { clickable: false } : {}) });
    this.syncHighlight();
  }

  hoverAt(screen: Point) {
    this.pointerMoveAt(screen, false);
  }

  private resolveCaptured(key: string): ViewNode | null {
    const slash = key.indexOf("/");
    if (slash < 0) return null;
    const frame = key.slice(0, slash);
    let path: string | null = key.slice(slash + 1);
    while (path !== null) {
      const found = this.node(`${frame}/${path}`);
      if (found) return found;
      if (path === "") path = null;
      else {
        const dot = path.lastIndexOf(".");
        path = dot >= 0 ? path.slice(0, dot) : "";
      }
    }
    return null;
  }

  private makeMouseEvent(node: ViewNode, screen: Point, pressed: boolean): MouseEvent {
    const world = this.renderer!.toWorld(screen);
    const local = toLayer(node, { x: world.x - node.frame.x, y: world.y - node.frame.y });
    return { x: local.x, y: local.y, pressed };
  }

  /** Handles primary pointer down in Play mode; returns whether a layer captured the drag. */
  pointerDownAt(screen: Point): boolean {
    if (!this.renderer || this.store.get().tool !== "play") return false;
    const hit = this.renderer.hitTest(screen);
    const capture = captureTarget(hit);
    this.capturedKey = capture?.key ?? null;
    const target = mouseTarget(hit, "onMouseDown");
    if (target) {
      const ev = this.makeMouseEvent(target.node, screen, true);
      this.host.dispatch(target.node.frame.name, () => target.handler(ev));
    }
    return this.capturedKey !== null;
  }

  pointerMoveAt(screen: Point, pressed: boolean) {
    if (!this.renderer) return;
    if (this.store.get().tool !== "play") {
      if (!pressed) this.hover(this.renderer.hitTest(screen)?.key ?? null);
      return;
    }
    if (pressed && this.capturedKey !== null) {
      const base = this.resolveCaptured(this.capturedKey);
      const target = mouseTarget(base, "onMouseMove");
      if (target) {
        const ev = this.makeMouseEvent(target.node, screen, true);
        this.host.dispatch(target.node.frame.name, () => target.handler(ev));
      }
      return;
    }
    const hit = this.renderer.hitTest(screen);
    // Play mode shows the design as a user would see it: no outlines, a hand over clickable/pressable layers.
    const clickable = isClickable(hit);
    if (clickable !== this.store.get().clickable) this.store.set({ clickable });
    const target = mouseTarget(hit, "onMouseMove");
    if (target) {
      const ev = this.makeMouseEvent(target.node, screen, false);
      this.host.dispatch(target.node.frame.name, () => target.handler(ev));
    }
  }

  pointerUpAt(screen: Point, opts: { dragged: boolean; canceled: boolean }) {
    const key = this.capturedKey;
    this.capturedKey = null;
    if (!this.renderer || this.store.get().tool !== "play") return;
    if (!opts.canceled) {
      const base = key !== null ? this.resolveCaptured(key) : null;
      const hit = this.renderer.hitTest(screen);
      const upTarget = mouseTarget(base, "onMouseUp") ?? mouseTarget(hit, "onMouseUp");
      if (upTarget) {
        const ev = this.makeMouseEvent(upTarget.node, screen, false);
        this.host.dispatch(upTarget.node.frame.name, () => upTarget.handler(ev));
      }
      if (!opts.dragged) {
        const clickTarget = mouseTarget(hit, "onClick");
        if (clickTarget) {
          const ev = this.makeMouseEvent(clickTarget.node, screen, false);
          this.host.dispatch(clickTarget.node.frame.name, () => clickTarget.handler(ev), true);
        }
      }
      const clickable = isClickable(hit);
      if (clickable !== this.store.get().clickable) this.store.set({ clickable });
    }
  }

  clickAt(screen: Point) {
    const tool = this.store.get().tool;
    if (tool === "comment") this.startComment(screen);
    else if (tool === "play") this.play(screen);
    else this.select(this.renderer?.hitTest(screen)?.key ?? null);
  }

  cancel() {
    if (this.store.get().tool !== "select") this.setTool("select");
    else this.select(null);
  }

  setTool(tool: Tool) {
    this.capturedKey = null;
    this.store.set({ tool, draft: tool === "comment" ? this.store.get().draft : null, clickable: false, measuring: false });
    if (tool === "play") this.hover(null);
  }

  /** Hides or shows both side panels at once. */
  togglePanels() {
    this.store.set({ panelsHidden: !this.store.get().panelsHidden });
  }

  /** Shows a short message over the canvas for a few seconds. */
  notify(notice: string) {
    clearTimeout(this.noticeTimer);
    this.store.set({ notice });
    this.noticeTimer = setTimeout(() => this.store.set({ notice: null }), 3500);
  }

  // ------------------------------------------------------------------- states

  /** Runs the onClick of the innermost clickable layer at a screen point. */
  private play(screen: Point) {
    if (!this.renderer) return;
    const hit = this.renderer.hitTest(screen);
    const target = mouseTarget(hit, "onClick");
    if (target) {
      const ev = this.makeMouseEvent(target.node, screen, false);
      this.host.dispatch(target.node.frame.name, () => target.handler(ev), true);
    }
  }

  /** Switches one of an artboard's variants; the artboard re-renders through React. */
  setVariant(frame: string, name: string, value: VariantValue) {
    const f = this.host.frames.find((f) => f.name === frame);
    try {
      f?.variants.set(name, value);
    } catch (e) {
      console.error(e);
    }
  }

  /** Puts an artboard back in its initial state, scrolled to the start. */
  resetFrame(frame: string) {
    this.capturedKey = null;
    for (const key of this.scrolls.keys()) if (key.startsWith(`${frame}/`)) this.scrolls.delete(key);
    void this.host.reset(frame);
  }

  /**
   * In Play mode, scrolls the innermost scroll container under `screen` by a
   * screen-pixel delta. Returns false when there is none, so the caller can
   * pan the canvas instead; a container already at its end still takes the
   * gesture, so the canvas does not jump.
   */
  scrollAt(screen: Point, dx: number, dy: number): boolean {
    const renderer = this.renderer;
    if (!renderer || this.store.get().tool !== "play") return false;
    const a = renderer.toWorld(screen);
    const b = renderer.toWorld({ x: screen.x + dx, y: screen.y + dy });
    const wx = b.x - a.x;
    const wy = b.y - a.y;
    const target = scrollTarget(renderer.hitTest(screen), wx, wy);
    if (!target) return false;
    if (scrollNode(target, wx, wy)) {
      this.scrolls.set(target.key, { ...target.scroll! });
      renderer.refreshFrame(target.frame);
      this.store.set({ scrollTick: this.store.get().scrollTick + 1 });
    }
    return true;
  }

  // ----------------------------------------------------------------- comments

  /** Starts a comment on the layer at a screen point, if there is one. */
  startComment(screen: Point) {
    const renderer = this.renderer;
    const node = renderer?.hitTest(screen);
    if (!renderer || !node) return;
    if (node.frame.modified) {
      this.notify(`${node.frame.name} is not in its initial state. Reset it to comment.`);
      return;
    }
    this.store.set({ draft: { key: node.key, at: renderer.toWorld(screen) } });
    this.select(node.key);
  }

  /** Saves the draft. Resolves to false if the server rejected it. */
  async submitComment(text: string): Promise<boolean> {
    const { draft } = this.store.get();
    const node = this.node(draft?.key ?? null);
    if (!draft || !node || !text.trim()) return false;
    const ok = await this.backend.addComment({
      frame: node.frame.name,
      path: node.path,
      nodeType: node.type,
      hint: describe(node),
      point: toLayer(node, { x: draft.at.x - node.frame.x, y: draft.at.y - node.frame.y }),
      text,
    });
    if (ok) this.setTool("select");
    return ok;
  }

  /** Selects the layer a comment is attached to. */
  focusComment(comment: ResolvedComment) {
    if (comment.attached) this.select(nodeKey(comment.frame, comment.path), { reveal: true });
  }

  setCommentResolved(id: number, resolved: boolean) {
    void this.backend.setCommentResolved(id, resolved);
  }

  deleteComment(id: number) {
    void this.backend.deleteComment(id);
  }

  /** Static sites only: downloads the comments to send back to the designer. */
  exportComments() {
    this.backend.exportComments?.();
  }
}
