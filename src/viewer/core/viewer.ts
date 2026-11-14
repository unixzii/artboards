// The viewer's controller: owns the UI state and the stage backend, and is the
// single boundary through which UI panels and canvas input coordinate.

import type { Diagnostic } from "../../shared/diagnostics.ts";
import type { ResolvedComment, ScenePayload } from "../../shared/protocol.ts";
import type { FontFace } from "../../shared/text.ts";
import * as api from "./api.ts";
import { buildModel, describe, EMPTY_MODEL, nodeKey, type Model, type Point, type ViewNode } from "./model.ts";
import { createStore } from "./store.ts";

export type Tool = "select" | "comment";

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
}

export interface StageElements {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  overlay: HTMLElement;
}

/** Imperative stage renderer contract implemented by the CanvasKit surface. */
export interface StageBackend {
  loadFonts(faces: FontFace[]): Promise<unknown>;
  setModel(model: Model): void;
  setHighlight(selected: ViewNode | null, hovered: ViewNode | null): void;
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
  });
  private createBackend: StageBackendFactory;
  private renderer: StageBackend | null = null;
  /** Whether the view has been fitted to the first scene that had artboards. */
  private fitted = false;
  /** Scenes are applied in arrival order, even while one is still loading fonts. */
  private queue: Promise<void> = Promise.resolve();

  constructor(createBackend: StageBackendFactory) {
    this.createBackend = createBackend;
  }

  /** Binds to the stage elements and starts receiving scenes. Returns the teardown. */
  attach(els: StageElements): () => void {
    const renderer = this.createBackend(els, (s) => this.store.set({ zoom: Math.round(s * 100) }));
    this.renderer = renderer;
    const apply = (scene: ScenePayload) => {
      this.queue = this.queue.then(() => this.applyScene(scene)).catch((e) => console.error(e));
    };
    api.fetchScene().then(apply);
    const unsubscribe = api.subscribeScenes(apply);
    return () => {
      unsubscribe();
      renderer.dispose();
      this.renderer = null;
    };
  }

  node(key: string | null): ViewNode | null {
    return (key && this.store.get().model.nodes.get(key)) || null;
  }

  private async applyScene(scene: ScenePayload) {
    const renderer = this.renderer;
    if (!renderer) return;
    await renderer.loadFonts(scene.fonts ?? []);
    const model = buildModel(scene);
    renderer.setModel(model);

    const prev = this.store.get();
    const first = !this.fitted && model.frames.length > 0;
    if (first) this.fitted = true;
    const keep = (key: string | null) => (key && model.nodes.has(key) ? key : null);
    // A link to a layer (#Artboard/path) selects it on first load.
    const selected = first ? keep(decodeURIComponent(location.hash.slice(1))) : keep(prev.selected);
    this.store.set({
      ready: true,
      file: scene.file ?? "",
      model,
      diagnostics: scene.diagnostics ?? [],
      comments: scene.comments ?? [],
      selected,
      hovered: null,
      draft: prev.draft && model.nodes.has(prev.draft.key) ? prev.draft : null,
    });
    this.syncHighlight();
    if (first) renderer.fit();
  }

  private syncHighlight() {
    const { selected, hovered } = this.store.get();
    this.renderer?.setHighlight(this.node(selected), this.node(hovered));
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

  hover(key: string | null) {
    this.store.set({ hovered: key });
    this.syncHighlight();
  }

  hoverAt(screen: Point) {
    this.hover(this.renderer?.hitTest(screen)?.key ?? null);
  }

  clickAt(screen: Point) {
    if (this.store.get().tool === "comment") this.startComment(screen);
    else this.select(this.renderer?.hitTest(screen)?.key ?? null);
  }

  cancel() {
    if (this.store.get().tool === "comment") this.setTool("select");
    else this.select(null);
  }

  setTool(tool: Tool) {
    this.store.set({ tool, draft: tool === "select" ? null : this.store.get().draft });
  }

  // ----------------------------------------------------------------- comments

  /** Starts a comment on the layer at a screen point, if there is one. */
  startComment(screen: Point) {
    const renderer = this.renderer;
    const node = renderer?.hitTest(screen);
    if (!renderer || !node) return;
    this.store.set({ draft: { key: node.key, at: renderer.toWorld(screen) } });
    this.select(node.key);
  }

  /** Saves the draft. Resolves to false if the server rejected it. */
  async submitComment(text: string): Promise<boolean> {
    const { draft } = this.store.get();
    const node = this.node(draft?.key ?? null);
    if (!draft || !node || !text.trim()) return false;
    const ok = await api.postComment({
      frame: node.frame.name,
      path: node.path,
      nodeType: node.type,
      hint: describe(node),
      point: { x: draft.at.x - node.frame.x, y: draft.at.y - node.frame.y },
      text,
    });
    if (ok) this.setTool("select");
    return ok;
  }

  /** Selects the layer a comment is attached to. */
  focusComment(comment: ResolvedComment) {
    if (comment.attached) this.select(nodeKey(comment.frame, comment.path), { reveal: true });
  }

  setCommentResolved = api.setCommentResolved;
  deleteComment = api.deleteComment;
}
