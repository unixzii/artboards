// Artboard discovery, reconciliation, variant validation, and runtime error
// source-mapping shared by the CLI pipeline and the browser runtime host.

import { createElement, type ComponentType } from "react";
import type { Diagnostic } from "../diagnostics.ts";
import type { SceneNode } from "../scene.ts";
import { createSceneRoot } from "./reconciler.ts";
export { flushSceneSync } from "./reconciler.ts";
import { AnimationContext, type AnimationClock } from "./animation.ts";
import { DslError } from "./schema.ts";
import { VariantContext, VariantStore, type VariantInfo } from "./variants.ts";

export interface FrameEntry {
  /** Component name, falling back to the export name. */
  name: string;
  component: ComponentType;
}

/** Every exported component of a compiled design module is an artboard, ordered by `order` when given. */
export function extractFrames(exports: Record<string, unknown>, order?: readonly string[]): FrameEntry[] {
  const keys = Object.keys(exports);
  if (order?.length) {
    const rank = new Map(order.map((k, i) => [k, i]));
    keys.sort((a, b) => (rank.get(a) ?? 1e9) - (rank.get(b) ?? 1e9));
  }
  const seen = new Set<unknown>();
  const frames: FrameEntry[] = [];
  for (const key of keys) {
    const value = exports[key];
    if (typeof value !== "function" || seen.has(value)) continue;
    seen.add(value);
    frames.push({ name: value.name && value.name !== "default" ? value.name : key, component: value as ComponentType });
  }
  return frames;
}

export function pickFrames(frames: FrameEntry[], name: string | undefined, file: string): FrameEntry[] {
  if (frames.length === 0) throw new DslError(`${file} exports no components. Export each artboard, e.g. \`export default function Home() {…}\`.`);
  if (!name) return frames;
  const hit = frames.filter((f) => f.name === name);
  if (hit.length === 0) throw new DslError(`No artboard named "${name}" in ${file}. Available: ${frames.map((f) => f.name).join(", ")}.`);
  return hit;
}

export interface ReconcileOptions {
  variants?: VariantStore;
  /** Drives `useAnimationTime` and `useSpring`. Without one, time stands still and springs show their target. */
  clock?: AnimationClock;
  onCommit?: () => void;
  onError?: (error: unknown) => void;
}

/**
 * Reconciles one artboard into its host tree, without initializing WASM layout
 * or fonts. React keeps the tree until `unmount`; build its layer tree with
 * `groupComponents` instead of rewiring it.
 */
export function reconcileFrame(
  frame: FrameEntry,
  opts: ReconcileOptions = {},
): { container: SceneNode; host: SceneNode; variants: VariantStore; unmount(): void } {
  const variants = opts.variants ?? new VariantStore();
  const scene = createSceneRoot({ onCommit: opts.onCommit, onError: opts.onError });
  const artboard = createElement(VariantContext.Provider, { value: variants }, createElement(frame.component));
  scene.render(opts.clock ? createElement(AnimationContext.Provider, { value: opts.clock }, artboard) : artboard);
  const roots = scene.root.children.filter((c) => c.type !== "#text");
  if (roots.length !== 1) {
    scene.unmount();
    throw new DslError(`Artboard ${frame.name} must return exactly one root element, got ${roots.length}.`);
  }
  return { container: scene.root, host: roots[0], variants, unmount: () => scene.unmount() };
}

/** Checks that a live container still holds a single root element after an update. */
export function currentHostRoot(frameName: string, containerRoot: SceneNode): SceneNode {
  const roots = containerRoot.children.filter((c) => c.type !== "#text");
  if (roots.length !== 1) {
    throw new DslError(`Artboard ${frameName} must return exactly one root element, got ${roots.length}.`);
  }
  return roots[0];
}

// ------------------------------------------------------------------ variants

/** `--variant name=value` pairs, applied to every artboard that declares the name. */
export type VariantPresets = [name: string, value: string][];

/** One artboard's variants, recorded before it is disposed (unmounting empties the list). */
export interface FrameVariants {
  frame: string;
  store: VariantStore;
  rendered: VariantInfo[];
}

/** An error for each preset no artboard declared, listing the variants there are. */
export function unknownVariants(presets: VariantPresets, frames: FrameVariants[]): Diagnostic[] {
  const unknown = [...new Set(presets.map(([name]) => name))].filter((name) => !frames.some((f) => f.store.declares(name)));
  if (unknown.length === 0) return [];
  const available = frames.flatMap((f) => f.rendered.map((v) => `${v.name} (${f.frame})`));
  const list = available.length ? `Available: ${available.join(", ")}.` : "None of the artboards declares a variant.";
  return unknown.map((name) => ({ severity: "error", rule: "variant", message: `No artboard declares a variant named ${JSON.stringify(name)}. ${list}` }));
}

// -------------------------------------------------------------- source mapping

export interface SourceMapData {
  sources: string[];
  mappings: string;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_DEC = new Int8Array(128).fill(-1);
for (let i = 0; i < B64.length; i++) B64_DEC[B64.charCodeAt(i)] = i;

export type SourceMapper = (line1: number, col1: number) => string | undefined;

/** Decodes a v3 source map into a `(line, col) -> "file:line"` lookup. */
export function createSourceMapper(map: SourceMapData): SourceMapper {
  type Seg = [genCol: number, src: number, line: number];
  const lines: Seg[][] = [];
  let src = 0;
  let origLine = 0;
  let origCol = 0;
  for (const rawLine of map.mappings.split(";")) {
    const segs: Seg[] = [];
    let genCol = 0;
    if (rawLine) {
      for (const part of rawLine.split(",")) {
        const fields: number[] = [];
        let shift = 0;
        let value = 0;
        for (let i = 0; i < part.length; i++) {
          const digit = B64_DEC[part.charCodeAt(i)];
          if (digit < 0) break;
          value += (digit & 31) << shift;
          shift += 5;
          if ((digit & 32) === 0) {
            fields.push(value & 1 ? -(value >> 1) : value >> 1);
            value = 0;
            shift = 0;
          }
        }
        genCol += fields[0] ?? 0;
        if (fields.length >= 4) {
          src += fields[1];
          origLine += fields[2];
          origCol += fields[3];
          segs.push([genCol, src, origLine]);
        }
      }
    }
    lines.push(segs);
  }
  return (line1, col1) => {
    const segs = lines[line1 - 1];
    if (!segs?.length) return undefined;
    let chosen = segs[0];
    for (const s of segs) {
      if (s[0] <= col1 - 1) chosen = s;
      else break;
    }
    const file = map.sources[chosen[1]];
    return file ? `${file}:${chosen[2] + 1}` : undefined;
  };
}

export interface BundleMeta {
  map: SourceMapData;
  exports: string[];
}

export const BUNDLE_META_GLOBAL = "__ARTBOARDS_BUNDLE_META__";

export interface ErrorDiagnosticOptions {
  frame?: string;
  /** Substring identifying stack frames from the compiled design bundle. */
  bundleTag?: string;
  /** Offset applied to V8's 1-based stack line (e.g. -2 for `new Function`). */
  lineOffset?: number;
  mapSource?: SourceMapper;
}

/** The DSL source line of the innermost stack frame inside the compiled design bundle. */
function sourceFromStack(err: Error, opts: ErrorDiagnosticOptions): string | undefined {
  if (!opts.bundleTag || !opts.mapSource || !err.stack) return undefined;
  const at = err.stack
    .split("\n")
    .filter((l) => /^\s*(?:at |@)/.test(l) || l.includes("@"))
    .find((l) => l.includes(opts.bundleTag!));
  const m = at && /:(\d+):(\d+)\)?\s*$/.exec(at);
  return m ? opts.mapSource(Number(m[1]) + (opts.lineOffset ?? 0), Number(m[2])) : undefined;
}

/**
 * Turns a thrown error into a diagnostic, mapping bundle stack frames back to
 * the DSL source line. A DslError that names no element (e.g. one thrown by a
 * hook like useVariant) points at the design code that called into the DSL.
 */
export function errorToDiagnostic(e: unknown, opts: ErrorDiagnosticOptions = {}): Diagnostic {
  if (e instanceof DslError) {
    return { severity: "error", rule: "dsl", message: e.bare, source: e.source ?? sourceFromStack(e, opts), frame: opts.frame };
  }
  const err = e instanceof Error ? e : new Error(String(e));
  return {
    severity: "error",
    rule: "runtime",
    message: `${err.name}: ${err.message}`,
    source: sourceFromStack(err, opts),
    frame: opts.frame,
  };
}
