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
  flushSceneSync,
  reconcileFrame,
  type BundleMeta,
  type FrameEntry,
  type SourceMapper,
} from "../../shared/dsl/frame.ts";
import { AnimationClock } from "../../shared/dsl/animation.ts";
import { groupComponents } from "../../shared/dsl/reconciler.ts";
import { VariantStore, type VariantValue } from "../../shared/dsl/variants.ts";
import { prepareTree, type RenderEngine } from "../../shared/engine.ts";
import { resetCustomFonts } from "../../shared/fonts.ts";
import { checkFrame } from "../../shared/layout-lint.ts";
import { layoutPreparedTree, layoutTree } from "../../shared/layout.ts";
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
  /** Animation time of this artboard; runs only in Play mode. */
  clock: AnimationClock;
  /** rAF timestamp the clock was last advanced at. */
  lastTick?: number;
  /** Set once an interaction handler commits state, is clicked, or throws; only a reset or a new bundle clears it. */
  clicked: boolean;
  /** The last interaction handler that threw. */
  clickError?: Diagnostic;
  pendingInteraction?: boolean;
  relayoutQueued?: boolean;
  /** A commit since the last layout changed more than paint-only props. */
  layoutStale?: boolean;
  lintDebounce?: ReturnType<typeof setTimeout>;
}

function managed(entry: FrameEntry, variants: VariantStore, playing: boolean): ManagedArtboard {
  const clock = new AnimationClock();
  clock.running = playing;
  const item: ManagedArtboard = {
    clock,
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
  private onDiagnostics: () => void;
  private managed: ManagedArtboard[] = [];
  private moduleDiagnostics: Diagnostic[] = [];
  private mapSource: SourceMapper | undefined;
  private queue: Promise<void> = Promise.resolve();
  /** Jobs in `queue` not finished yet; animation frames wait for relayouts to catch up. */
  private pendingJobs = 0;
  /** Play mode: animation clocks run and a frame loop advances them. */
  private playing = false;
  private frameRequest: number | null = null;
  private loadSeq = 0;
  private lintTimer: ReturnType<typeof setTimeout> | undefined;
  /** Variant values picked per artboard, carried into the next bundle. */
  private remembered = new Map<string, [string, VariantValue][]>();

  constructor(engine: RenderEngine, onChange: () => void, onDiagnostics: () => void = onChange) {
    this.engine = engine;
    this.onChange = onChange;
    this.onDiagnostics = onDiagnostics;
  }

  dispose() {
    this.setPlaying(false);
    this.clear();
  }

  clear() {
    this.loadSeq++;
    clearTimeout(this.lintTimer);
    this.lintTimer = undefined;
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
    clearTimeout(f.lintDebounce);
    f.lintDebounce = undefined;
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
    this.pendingJobs++;
    this.queue = this.queue
      .then(fn)
      .catch((e) => console.error(e))
      .finally(() => {
        this.pendingJobs--;
      });
    return this.queue;
  }

  /**
   * Starts or stops animation time. Stopping settles every spring, so outside
   * Play mode artboards show the state where their motion ends.
   */
  setPlaying(playing: boolean) {
    if (this.playing === playing) return;
    this.playing = playing;
    for (const item of this.managed) {
      if (item.disposed) continue;
      item.lastTick = undefined;
      this.runClock(item, () => item.clock.setRunning(playing));
    }
    if (playing) this.requestFrame();
    else if (this.frameRequest !== null) {
      cancelAnimationFrame(this.frameRequest);
      this.frameRequest = null;
    }
  }

  private requestFrame() {
    if (this.frameRequest === null) this.frameRequest = requestAnimationFrame(this.tick);
  }

  /** Advances the clocks of artboards that are animating, one display frame at a time. */
  private tick = (now: number) => {
    this.frameRequest = null;
    if (!this.playing) return;
    // Let the previous frame's relayout land before rendering the next one.
    if (this.pendingJobs === 0) {
      for (const item of this.managed) {
        if (item.disposed || !item.clock.active) {
          item.lastTick = undefined;
          continue;
        }
        // Long stalls (a hidden tab) don't fast-forward motion.
        const dt = item.lastTick === undefined ? 1000 / 60 : Math.min(now - item.lastTick, 100);
        item.lastTick = now;
        this.runClock(item, () => item.clock.advance(dt));
      }
    }
    this.requestFrame();
  };

  /** Runs a clock change and commits the re-renders it causes in one go. */
  private runClock(item: ManagedArtboard, fn: () => void) {
    try {
      flushSceneSync(fn);
    } catch (e) {
      this.handleAsyncError(item, e);
    }
  }

  /** Imports a newly built `design.js?v=<version>` bundle and mounts all artboards. */
  loadBundle(version: number, file: string): Promise<void> {
    return this.enqueue(async () => {
      this.clear();
      const seq = ++this.loadSeq;
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

      const reconciled: { item: ManagedArtboard; host: SceneNode }[] = [];
      for (const entry of entries) {
        const item = managed(entry, new VariantStore([], this.remembered.get(entry.name)), this.playing);
        this.managed.push(item);
        try {
          const mounted = reconcileFrame(item.entry, {
            variants: item.variants,
            clock: item.clock,
            onCommit: (layout) => {
              if (item.pendingInteraction) item.clicked = true;
              this.scheduleRelayout(item, layout);
            },
            onError: (err) => this.handleAsyncError(item, err),
          });
          item.container = mounted.container;
          item.unmount = mounted.unmount;
          reconciled.push({ item, host: mounted.host });
        } catch (e) {
          this.teardown(item);
          item.error = this.toDiagnostic(e, item.name);
        }
      }

      await Promise.all(
        reconciled.map(({ item, host }) =>
          prepareTree(host, this.engine).catch((e) => {
            this.teardown(item);
            item.error = this.toDiagnostic(e, item.name);
          }),
        ),
      );
      if (this.loadSeq !== seq) return;

      for (const { item, host } of reconciled) {
        if (item.disposed || item.error) continue;
        try {
          layoutPreparedTree(host, this.engine);
          item.root = groupComponents(host);
        } catch (e) {
          this.teardown(item);
          item.error = this.toDiagnostic(e, item.name);
        }
      }

      this.syncDiagnostics();
      this.onChange();
      if (this.managed.length > 0) this.runDeferredLint(seq);
    });
  }

  private runDeferredLint(seq: number) {
    let idx = 0;
    let changed = false;
    const step = () => {
      if (this.loadSeq !== seq) return;
      const deadline = performance.now() + 8;
      while (idx < this.managed.length) {
        const item = this.managed[idx++];
        if (item.disposed || !item.root || item.error) continue;
        const warnings = checkFrame({ name: item.name, root: item.root, engine: this.engine });
        if (warnings.length > 0) {
          item.warnings = warnings;
          changed = true;
        }
        if (performance.now() >= deadline) break;
      }
      if (idx < this.managed.length) {
        this.lintTimer = setTimeout(step, 0);
      } else {
        this.lintTimer = undefined;
        if (changed) {
          this.syncDiagnostics();
          this.onDiagnostics();
        }
      }
    };
    this.lintTimer = setTimeout(step, 0);
  }

  private async mount(item: ManagedArtboard) {
    try {
      const mounted = reconcileFrame(item.entry, {
        variants: item.variants,
        clock: item.clock,
        onCommit: (layout) => {
          if (item.pendingInteraction) item.clicked = true;
          this.scheduleRelayout(item, layout);
        },
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
      const item = managed(this.managed[i].entry, new VariantStore(), this.playing);
      this.managed[i] = item;
      await this.mount(item);
      this.syncDiagnostics();
      this.onChange();
    });
  }

  /** Runs a layer interaction handler on behalf of the reviewer. Marks the artboard modified when clicked, when state commits, or on error. */
  dispatch(name: string, run: () => void, markModified = false) {
    const item = this.managed.find((f) => f.name === name);
    if (!item || item.disposed) return;
    const wasModified = item.modified;
    const hadError = !!item.clickError;
    if (markModified) item.clicked = true;
    item.pendingInteraction = true;
    try {
      flushSceneSync(run);
      item.clickError = undefined;
    } catch (e) {
      item.clicked = true;
      item.clickError = this.toDiagnostic(e, item.name);
    } finally {
      item.pendingInteraction = false;
    }
    // A state change schedules relayout through onCommit; this covers immediate flags and handler errors.
    if (item.modified !== wasModified || hadError || item.clickError) {
      this.syncDiagnostics();
      this.onChange();
    }
  }

  /**
   * Rebuilds an artboard's layer tree after a commit. Layout runs only when a
   * commit since the last one changed more than paint-only props (an animated
   * `translateX`, `opacity` or color), which keeps motion cheap.
   */
  private scheduleRelayout(item: ManagedArtboard, layout = true) {
    if (layout) item.layoutStale = true;
    if (item.relayoutQueued) return;
    item.relayoutQueued = true;
    void this.enqueue(async () => {
      item.relayoutQueued = false;
      if (item.disposed || !item.container) return;
      try {
        const host = currentHostRoot(item.name, item.container);
        if (item.layoutStale) {
          item.layoutStale = false;
          await layoutTree(host, this.engine);
        }
        item.root = groupComponents(host);
        item.error = undefined;
        this.scheduleFrameLint(item);
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

  private scheduleFrameLint(item: ManagedArtboard) {
    clearTimeout(item.lintDebounce);
    item.lintDebounce = setTimeout(() => {
      item.lintDebounce = undefined;
      if (item.disposed || !item.root || item.error) return;
      item.warnings = checkFrame({ name: item.name, root: item.root, engine: this.engine });
      this.syncDiagnostics();
      this.onDiagnostics();
    }, 120);
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
