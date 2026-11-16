// Motion in the CLI: plays an artboard on a virtual clock in fixed steps, so
// any moment of an animation renders the same way every time, and samples the
// layer tree at the moments `render --at` and `inspect --at` ask for.

import { AnimationClock } from "../shared/dsl/animation.ts";
import { currentHostRoot, flushSceneSync, reconcileFrame, type FrameEntry, type VariantPresets } from "../shared/dsl/frame.ts";
import { groupComponents } from "../shared/dsl/reconciler.ts";
import type { VariantStore } from "../shared/dsl/variants.ts";
import { layoutTree } from "../shared/layout.ts";
import { layerChildren, nodePath, sourceOf, textContentOf, type SceneNode } from "../shared/scene.ts";
import { releaseParagraphs } from "../shared/text.ts";
import { createEngine, type NodeEngine } from "./skia.ts";

/** One display frame at 60 Hz: the step the clock advances by, as in the viewer. */
export const TICK = 1000 / 60;
/** How long `auto` waits for springs to settle. */
export const SETTLE_LIMIT = 5000;

/** `--at`: explicit times in ms, or `auto` (from the start until the springs settle). */
export type TimeSpec = "auto" | number[];

/** Parses `120`, `0,80,160`, `0..600:100` (start..end:step) or `auto`. */
export function parseTimes(spec: string): TimeSpec {
  const s = spec.trim();
  if (s === "auto") return "auto";
  const out: number[] = [];
  for (const part of s.split(",")) {
    const range = /^(\d+(?:\.\d+)?)\.\.(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(part.trim());
    if (range) {
      const [start, end, step] = range.slice(1).map(Number);
      if (step <= 0 || end < start) throw new Error(`"${part}" needs start <= end and a step above 0, e.g. 0..600:50.`);
      if ((end - start) / step > 200) throw new Error(`"${part}" asks for more than 200 frames; use a larger step.`);
      for (let i = 0; start + i * step <= end + 1e-9; i++) out.push(Math.round((start + i * step) * 1000) / 1000);
      continue;
    }
    const n = Number(part.trim());
    if (part.trim() === "" || !Number.isFinite(n) || n < 0) {
      throw new Error(`"${part}" is not a time. Use ms like 120, a list like 0,80,160, a range like 0..600:50, or auto.`);
    }
    out.push(n);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/** About ten evenly spaced, round times covering 0 to `end`. */
export function autoTimes(end: number): number[] {
  if (end <= 0) return [0];
  const steps = [10, 20, 25, 40, 50, 80, 100, 150, 200, 250, 300, 400, 500, 750, 1000];
  const step = steps.find((s) => end / s <= 10) ?? Math.ceil(end / 10 / 100) * 100;
  const out: number[] = [];
  for (let t = 0; t < end + step; t += step) out.push(t);
  return out;
}

export interface TimelineOptions {
  variants: VariantStore;
  /**
   * `--to`: the artboard starts in its `variants` state with every spring at rest,
   * and these variants change at time 0. Without them, the clock runs from the
   * moment the artboard mounts, so entrances and loops play.
   */
  to?: VariantPresets;
}

/** An artboard playing on its own virtual clock. Times only move forward. */
export class Timeline {
  readonly name: string;
  readonly engine: NodeEngine;
  private clock: AnimationClock;
  private container: SceneNode;
  private unmount: () => void;
  /** Errors React reports outside a synchronous render, e.g. from an effect. */
  private failure: { error?: unknown };

  private constructor(name: string, engine: NodeEngine, clock: AnimationClock, container: SceneNode, unmount: () => void, failure: { error?: unknown }) {
    this.name = name;
    this.engine = engine;
    this.clock = clock;
    this.container = container;
    this.unmount = unmount;
    this.failure = failure;
  }

  static async start(frame: FrameEntry, opts: TimelineOptions): Promise<Timeline> {
    const engine = await createEngine();
    const clock = new AnimationClock();
    const to = opts.to ?? [];
    clock.running = to.length === 0;
    const failure: { error?: unknown } = {};
    const mounted = reconcileFrame(frame, { variants: opts.variants, clock, onError: (e) => (failure.error ??= e) });
    const timeline = new Timeline(frame.name, engine, clock, mounted.container, mounted.unmount, failure);
    try {
      if (to.length) {
        timeline.run(() => {
          clock.setRunning(true);
          // Like --variant, a name applies to the artboards that declare it.
          for (const [name, raw] of to) if (opts.variants.has(name)) opts.variants.setFromText(name, raw);
        });
      }
      timeline.check();
    } catch (e) {
      timeline.dispose();
      throw e;
    }
    return timeline;
  }

  /** Milliseconds since the start. */
  get time(): number {
    return this.clock.now();
  }

  /** Whether a spring is still moving. */
  get moving(): boolean {
    return this.clock.moving;
  }

  /** Whether something reads `useAnimationTime` every frame: a loop that never settles. */
  get looping(): boolean {
    return this.clock.active && !this.clock.moving;
  }

  private run(fn: () => void) {
    flushSceneSync(fn);
    this.check();
  }

  private check() {
    if (this.failure.error) {
      const e = this.failure.error;
      this.failure.error = undefined;
      throw e;
    }
  }

  /** Plays forward to `t` in 60 Hz steps (the last one shorter when `t` falls between). */
  advanceTo(t: number) {
    while (this.clock.now() < t - 1e-9) {
      const dt = Math.min(TICK, t - this.clock.now());
      this.run(() => this.clock.advance(dt));
    }
  }

  /** Plays on until no spring moves; the time that happens, or null when they still move at `limit`. */
  settle(limit = SETTLE_LIMIT): number | null {
    while (this.clock.moving) {
      if (this.clock.now() >= limit) return null;
      this.advanceTo(Math.min(limit, this.clock.now() + TICK));
    }
    return this.clock.now();
  }

  /**
   * Plays to `t` and lays the artboard out. The layer tree reads text from the
   * live host, so use it before moving on to a later time.
   */
  async at(t: number): Promise<SceneNode> {
    this.advanceTo(t);
    const host = currentHostRoot(this.name, this.container);
    await layoutTree(host, this.engine);
    return groupComponents(host);
  }

  dispose() {
    releaseParagraphs(this.container);
    try {
      this.unmount();
    } catch {
      // A broken tree may throw on the way out.
    }
  }
}

export interface Settling {
  /** When the springs of a fresh run come to rest; null when they still move after the limit. */
  settled: number | null;
  /** Whether a `useAnimationTime` loop keeps running after that. */
  looping: boolean;
}

/** Plays a fresh copy of the artboard, without layout, to see when its motion ends. */
export async function settleTime(frame: FrameEntry, opts: TimelineOptions): Promise<Settling> {
  const probe = await Timeline.start(frame, opts);
  try {
    const settled = probe.settle();
    // Sixtieths of a second add up to 899.9999…; report the time as a person would.
    return { settled: settled === null ? null : Math.round(settled * 10) / 10, looping: probe.looping };
  } finally {
    probe.dispose();
  }
}

/** The moments `--at auto` shows: from 0 until the springs rest, or a second of a loop. */
export function autoMoments({ settled, looping }: Settling): number[] {
  if (settled === null) return autoTimes(SETTLE_LIMIT);
  if (settled === 0) return looping ? autoTimes(1000) : [0];
  return autoTimes(settled);
}

// ------------------------------------------------------------------ trace

/** Paint props a trace follows, besides each layer's box and text. */
const TRACED = ["translateX", "translateY", "scale", "rotation", "opacity", "blur", "fill", "color", "stroke"] as const;

type Sample = Record<string, number | string>;

function sampleLayer(n: SceneNode): Sample {
  const out: Sample = { x: n.layout.x, y: n.layout.y, width: n.layout.width, height: n.layout.height };
  for (const key of TRACED) {
    const v = n.props[key];
    if (key === "scale" && Array.isArray(v)) {
      out.scaleX = v[0];
      out.scaleY = v[1];
    } else if (typeof v === "number" || typeof v === "string") {
      out[key] = v;
    } else if (v != null) {
      out[key] = JSON.stringify(v);
    }
  }
  if (n.type === "Text") out.text = textContentOf(n);
  return out;
}

export interface TraceLayer {
  path: string;
  type: string;
  name?: string;
  source?: string;
  /** One value per sampled time; null where the layer did not exist or had no value. */
  values: Record<string, (number | string | null)[]>;
}

/** Collects samples of every layer over time and keeps the properties that change. */
export class Trace {
  readonly times: number[] = [];
  private layers = new Map<string, { type: string; name?: string; source?: string; samples: (Sample | undefined)[] }>();

  add(t: number, root: SceneNode) {
    const index = this.times.length;
    this.times.push(t);
    const visit = (n: SceneNode) => {
      if (!n.component) {
        const path = nodePath(n);
        let layer = this.layers.get(path);
        if (!layer) this.layers.set(path, (layer = { type: n.type, samples: [] }));
        layer.type = n.type;
        layer.name = n.props.name;
        layer.source = sourceOf(n);
        layer.samples[index] = sampleLayer(n);
      }
      for (const c of layerChildren(n)) visit(c);
      if (n.mask) visit(n.mask);
    };
    visit(root);
  }

  /** Layers with at least one property that changed between samples, in tree order. */
  changes(): TraceLayer[] {
    const out: TraceLayer[] = [];
    const round = (v: number | string) => (typeof v === "number" ? Math.round(v * 100) / 100 : v);
    for (const [path, layer] of this.layers) {
      const keys = new Set<string>();
      for (const s of layer.samples) if (s) for (const k of Object.keys(s)) keys.add(k);
      const values: TraceLayer["values"] = {};
      // A layer that comes or goes gets one row for that; its other rows only list what changes while it is there.
      const present = this.times.map((_, i) => (layer.samples[i] ? "yes" : "no"));
      if (present.some((v) => v !== present[0])) values.present = present;
      for (const key of keys) {
        const series = this.times.map((_, i) => {
          const v = layer.samples[i]?.[key];
          return v === undefined ? null : round(v);
        });
        if (new Set(series.filter((v) => v !== null)).size > 1) values[key] = series;
      }
      if (Object.keys(values).length) out.push({ path, type: layer.type, name: layer.name, source: layer.source, values });
    }
    // Layers that only come and go together with their parent add nothing: the parent's row says it.
    const presence = new Map(out.map((l) => [l.path, l.values.present?.join()]));
    const parentOf = (path: string) => (path.includes(".") ? path.slice(0, path.lastIndexOf(".")) : path === "" ? null : "");
    return out.filter((l) => {
      const keys = Object.keys(l.values);
      if (keys.length !== 1 || keys[0] !== "present") return true;
      const parent = parentOf(l.path);
      return parent === null || presence.get(parent) !== l.values.present.join();
    });
  }
}
