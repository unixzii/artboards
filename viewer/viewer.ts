// The viewer's controller: owns the UI state and the renderer, and is the one
// place where the two are kept in step. Components and input handlers call it.

import type { CanvasKit } from "canvaskit-wasm";
import type { ResolvedComment } from "../src/comments.ts";
import type { Diagnostic } from "../src/lint.ts";
import type { ScenePayload } from "../src/serialize.ts";
import * as api from "./api.ts";
import { buildModel, describe, EMPTY_MODEL, nodeKey, type Model, type Point, type ViewNode } from "./model.ts";
import { Renderer, type RendererElements } from "./renderer.ts";
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
  private ck: CanvasKit;
  private renderer: Renderer | null = null;
  /** Whether the view has been fitted to the first scene that had artboards. */
  private fitted = false;
  /** Scenes are applied in arrival order, even while one is still loading fonts. */
  private queue: Promise<void> = Promise.resolve();

  constructor(ck: CanvasKit) {
    this.ck = ck;
  }

  /** Binds to the stage elements and starts receiving scenes. Returns the teardown. */
  attach(els: RendererElements): () => void {
    const renderer = new Renderer(this.ck, els, (s) => this.store.set({ zoom: Math.round(s * 100) }));
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

  get view(): Renderer | null {
    return this.renderer;
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
