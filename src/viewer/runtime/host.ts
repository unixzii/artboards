// Browser artboard host: dynamically imports `/design.js`, mounts every
// exported React component into the shared reconciler, lays out with Taffy,
// runs layout lint, and re-runs affected artboards when state/variants commit.
//
// Variant values a reviewer picked are kept by artboard and variant name
// across code edits; click state (useState) starts over with each bundle.

import type { Diagnostic } from "../../shared/diagnostics.ts";
import {
  BUNDLE_META_GLOBAL,
  createSourceMapper,
  currentHostRoot,
  errorToDiagnostic,
  extractFrames,
  reconcileFrame,
  type BundleMeta,
  type FrameEntry,
  type SourceMapper,
} from "../../shared/dsl/frame.ts";
import { groupComponents } from "../../shared/dsl/reconciler.ts";
import { VariantStore, type VariantValue } from "../../shared/dsl/variants.ts";
import type { RenderEngine } from "../../shared/engine.ts";
import { resetCustomFonts } from "../../shared/fonts.ts";
import { checkFrame } from "../../shared/layout-lint.ts";
import { layoutTree } from "../../shared/layout.ts";
import type { SceneNode } from "../../shared/scene.ts";
import { releaseParagraphs } from "../../shared/text.ts";

export interface MountedArtboard {
  name: string;
  /** Grouped layer tree consumed by the viewer model, comments and inspector. */
  root: SceneNode | null;
  variants: VariantStore;
  /** Whether the artboard is no longer in its initial state: a variant was changed or a layer clicked. */
  modified: boolean;
  warnings: Diagnostic[];
  error?: Diagnostic;
}

interface ManagedArtboard extends MountedArtboard {
  entry: FrameEntry;
  disposed: boolean;
  container: SceneNode | null;
  unmount?: () => void;
  /** Set once a click handler ran; only a reset or a new bundle clears it. */
  clicked: boolean;
  /** The last click handler that threw. */
  clickError?: Diagnostic;
}

function managed(entry: FrameEntry, variants: VariantStore): ManagedArtboard {
  const item: ManagedArtboard = {
    name: entry.name,
    entry,
    root: null,
    variants,
    modified: false,
    warnings: [],
    disposed: false,
    container: null,
    clicked: false,
  };
  Object.defineProperty(item, "modified", { enumerable: true, get: () => item.clicked || item.variants.overrides().length > 0 });
  return item;
}

export class DesignHost {
  frames: MountedArtboard[] = [];
  diagnostics: Diagnostic[] = [];

  private engine: RenderEngine;
  private onChange: () => void;
  private managed: ManagedArtboard[] = [];
  private moduleDiagnostics: Diagnostic[] = [];
  private mapSource: SourceMapper | undefined;
  private queue: Promise<void> = Promise.resolve();
  /** Variant values picked per artboard, carried into the next bundle. */
  private remembered = new Map<string, [string, VariantValue][]>();

  constructor(engine: RenderEngine, onChange: () => void) {
    this.engine = engine;
    this.onChange = onChange;
  }

  dispose() {
    this.clear();
  }

  clear() {
    this.remember();
    for (const f of this.managed) this.teardown(f);
    this.managed = [];
    this.frames = [];
    this.moduleDiagnostics = [];
    this.diagnostics = [];
  }

  /** Records the variant values of artboards that rendered; failed ones keep what they had. */
  private remember() {
    for (const f of this.managed) if (f.root) this.remembered.set(f.name, f.variants.overrides());
  }

  private teardown(f: ManagedArtboard) {
    if (f.disposed) return;
    f.disposed = true;
    if (f.container) releaseParagraphs(f.container);
    const unmount = f.unmount;
    f.container = null;
    f.unmount = undefined;
    try {
      unmount?.();
    } catch {
      // Unmount errors on broken trees are ignored during cleanup.
    }
  }

  private toDiagnostic(e: unknown, frame?: string): Diagnostic {
    return errorToDiagnostic(e, { frame, bundleTag: "/design.js", lineOffset: 0, mapSource: this.mapSource });
  }

  private syncDiagnostics() {
    const out: Diagnostic[] = [...this.moduleDiagnostics];
    for (const f of this.managed) {
      if (f.error) out.push(f.error);
      else out.push(...f.warnings);
      if (f.clickError) out.push(f.clickError);
    }
    this.frames = this.managed;
    this.diagnostics = out;
  }

  private enqueue(fn: () => Promise<void>): Promise<void> {
    this.queue = this.queue.then(fn).catch((e) => console.error(e));
    return this.queue;
  }

  /** Imports a newly built `design.js?v=<version>` bundle and mounts all artboards. */
  loadBundle(version: number, file: string): Promise<void> {
    return this.enqueue(async () => {
      this.clear();
      resetCustomFonts();
      (globalThis as any)[BUNDLE_META_GLOBAL] = undefined;

      let exports: Record<string, unknown>;
      try {
        const url = new URL(`design.js?v=${version}`, document.baseURI).href;
        exports = await import(url);
      } catch (e) {
        const meta = (globalThis as any)[BUNDLE_META_GLOBAL] as BundleMeta | undefined;
        this.mapSource = meta ? createSourceMapper(meta.map) : undefined;
        this.moduleDiagnostics = [this.toDiagnostic(e)];
        this.syncDiagnostics();
        this.onChange();
        return;
      }

      const meta = (globalThis as any)[BUNDLE_META_GLOBAL] as BundleMeta | undefined;
      this.mapSource = meta ? createSourceMapper(meta.map) : undefined;

      const entries = extractFrames(exports, meta?.exports);
      if (entries.length === 0) {
        this.moduleDiagnostics = [{ severity: "error", rule: "dsl", message: "No exported components. Export each artboard.", source: file }];
      }

      for (const entry of entries) {
        const item = managed(entry, new VariantStore([], this.remembered.get(entry.name)));
        this.managed.push(item);
        await this.mount(item);
      }
      this.syncDiagnostics();
      this.onChange();
    });
  }

  private async mount(item: ManagedArtboard) {
    try {
      const mounted = reconcileFrame(item.entry, {
        variants: item.variants,
        onCommit: () => this.scheduleRelayout(item),
        onError: (err) => this.handleAsyncError(item, err),
      });
      item.container = mounted.container;
      item.unmount = mounted.unmount;
      await layoutTree(mounted.host, this.engine);
      item.root = groupComponents(mounted.host);
      item.warnings = checkFrame({ name: item.name, root: item.root, engine: this.engine });
    } catch (e) {
      this.teardown(item);
      item.error = this.toDiagnostic(e, item.name);
    }
  }

  /** Remounts an artboard in its initial state: every variant at its initial value, click state gone. */
  reset(name: string): Promise<void> {
    return this.enqueue(async () => {
      const i = this.managed.findIndex((f) => f.name === name);
      if (i < 0) return;
      this.teardown(this.managed[i]);
      this.remembered.delete(name);
      const item = managed(this.managed[i].entry, new VariantStore());
      this.managed[i] = item;
      await this.mount(item);
      this.syncDiagnostics();
      this.onChange();
    });
  }

  /** Runs a layer's onClick on behalf of the reviewer. The artboard counts as modified from now on. */
  click(name: string, handler: () => void) {
    const item = this.managed.find((f) => f.name === name);
    if (!item || item.disposed) return;
    const wasModified = item.modified;
    const hadError = !!item.clickError;
    item.clicked = true;
    try {
      handler();
      item.clickError = undefined;
    } catch (e) {
      item.clickError = this.toDiagnostic(e, item.name);
    }
    // The state change, if any, arrives through the commit; this covers the flag and errors.
    if (!wasModified || hadError || item.clickError) {
      this.syncDiagnostics();
      this.onChange();
    }
  }

  private scheduleRelayout(item: ManagedArtboard) {
    void this.enqueue(async () => {
      if (item.disposed || !item.container) return;
      try {
        const host = currentHostRoot(item.name, item.container);
        await layoutTree(host, this.engine);
        item.root = groupComponents(host);
        item.warnings = checkFrame({ name: item.name, root: item.root, engine: this.engine });
        item.error = undefined;
      } catch (e) {
        this.teardown(item);
        item.root = null;
        item.warnings = [];
        item.error = this.toDiagnostic(e, item.name);
      }
      this.syncDiagnostics();
      this.onChange();
    });
  }

  private handleAsyncError(item: ManagedArtboard, err: unknown) {
    void this.enqueue(async () => {
      if (item.disposed) return;
      this.teardown(item);
      item.root = null;
      item.warnings = [];
      item.error = this.toDiagnostic(err, item.name);
      this.syncDiagnostics();
      this.onChange();
    });
  }
}
