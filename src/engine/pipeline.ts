// Compilation and analysis pipeline: DSL file -> artboards -> laid-out trees -> diagnostics.

import { relative, resolve } from "node:path";
import { createElement, type ComponentType } from "react";
import type { Diagnostic } from "../shared/diagnostics.ts";
import type { SceneNode } from "../shared/scene.ts";
import { releaseParagraphs } from "../shared/text.ts";
import { checkFrame } from "./checks/layout-lint.ts";
import { typecheck } from "./checks/typecheck.ts";
import { loadModule } from "./dsl/loader.ts";
import { createSceneRoot, groupComponents } from "./dsl/reconciler.ts";
import { DslError } from "./dsl/schema.ts";
import { VariantContext, VariantStore, type VariantInfo } from "./dsl/variants.ts";
import { layoutTree } from "./layout.ts";
import { createEngine, type NodeEngine } from "./skia.ts";

export interface FrameEntry {
  /** Component name, falling back to the export name. */
  name: string;
  component: ComponentType;
}

export interface BuiltFrame {
  name: string;
  /** Layer tree: what inspect, lint, comments and the viewer see. */
  root: SceneNode;
  /** Host tree, owned by React; layout is written here. */
  host: SceneNode;
  /** The artboard's variants, as rendered. */
  variants: VariantStore;
  engine: NodeEngine;
  dispose(): void;
}

export interface Analysis {
  diagnostics: Diagnostic[];
  /** Artboards in file order; `error` is set when one failed to build. */
  frames: { name: string; error?: Diagnostic }[];
}

/** Every exported component of the entry file is an artboard. */
export function listFrames(file: string): FrameEntry[] {
  const exports = loadModule(file);
  const seen = new Set<unknown>();
  const frames: FrameEntry[] = [];
  for (const [key, value] of Object.entries(exports)) {
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

/**
 * Reconciles one artboard into its host tree, without initializing WASM layout
 * or fonts. React keeps the tree until `unmount`; build its layer tree with
 * `groupComponents` instead of rewiring it.
 */
export function reconcileFrame(
  frame: FrameEntry,
  opts: { variants?: VariantStore } = {},
): { host: SceneNode; variants: VariantStore; unmount(): void } {
  const variants = opts.variants ?? new VariantStore();
  const scene = createSceneRoot();
  scene.render(createElement(VariantContext.Provider, { value: variants }, createElement(frame.component)));
  const roots = scene.root.children.filter((c) => c.type !== "#text");
  if (roots.length !== 1) {
    scene.unmount();
    throw new DslError(`Artboard ${frame.name} must return exactly one root element, got ${roots.length}.`);
  }
  return { host: roots[0], variants, unmount: () => scene.unmount() };
}

/** Pass a store to read its variants back even when the build throws. */
export async function buildFrame(frame: FrameEntry, opts: { variants?: VariantStore } = {}): Promise<BuiltFrame> {
  const { host, variants, unmount } = reconcileFrame(frame, opts);
  const engine = await createEngine();
  await layoutTree(host, engine);
  return {
    name: frame.name,
    root: groupComponents(host),
    host,
    variants,
    engine,
    dispose() {
      releaseParagraphs(host);
      unmount();
    },
  };
}

/** Turns a thrown error into a diagnostic, recovering the DSL source line where possible. */
export function errorToDiagnostic(e: unknown, file: string, frame?: string): Diagnostic {
  if (e instanceof DslError) return { severity: "error", rule: "dsl", message: e.bare, source: e.source, frame };
  const err = e instanceof Error ? e : new Error(String(e));
  // DSL modules are evaluated through `new Function`, which prepends two lines.
  const abs = resolve(file);
  // Only stack frames ("    at ..."): the message itself may name the file too.
  const at = err.stack?.split("\n").filter((l) => /^\s+at /.test(l)).find((l) => l.includes(abs) || /\.(jsx|tsx)[:)]/.test(l));
  const m = at && /((?:\/|[A-Za-z]:\\)[^():]+):(\d+):\d+/.exec(at);
  return {
    severity: "error",
    rule: "runtime",
    message: `${err.name}: ${err.message}`,
    source: m ? `${relative(process.cwd(), m[1])}:${Number(m[2]) - 2}` : undefined,
    frame,
  };
}

/**
 * Type-checks the file, builds every artboard and runs the layout checks.
 * `visit` sees each successfully built artboard before it is disposed.
 */
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

export async function analyzeFile(
  file: string,
  visit?: (built: BuiltFrame, warnings: Diagnostic[]) => void,
  opts: { variants?: VariantPresets } = {},
): Promise<Analysis> {
  const diagnostics: Diagnostic[] = typecheck(file);
  const result: Analysis = { diagnostics, frames: [] };
  let frames;
  try {
    frames = listFrames(file);
  } catch (e) {
    diagnostics.push(errorToDiagnostic(e, file));
    return result;
  }
  if (frames.length === 0) {
    diagnostics.push({ severity: "error", rule: "dsl", message: "No exported components. Export each artboard.", source: relative(process.cwd(), resolve(file)) });
  }
  const presets = opts.variants ?? [];
  const seen: FrameVariants[] = [];
  for (const frame of frames) {
    const record: FrameVariants = { frame: frame.name, store: new VariantStore(presets), rendered: [] };
    seen.push(record);
    try {
      const built = await buildFrame(frame, { variants: record.store });
      record.rendered = built.variants.list();
      const warnings = checkFrame(built);
      diagnostics.push(...warnings);
      visit?.(built, warnings);
      built.dispose();
      result.frames.push({ name: frame.name });
    } catch (e) {
      const error = errorToDiagnostic(e, file, frame.name);
      diagnostics.push(error);
      result.frames.push({ name: frame.name, error });
    }
  }
  diagnostics.push(...unknownVariants(presets, seen));
  return result;
}

export async function lintFile(file: string, opts: { variants?: VariantPresets } = {}): Promise<Diagnostic[]> {
  return (await analyzeFile(file, undefined, opts)).diagnostics;
}
