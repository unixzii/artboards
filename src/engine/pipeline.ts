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
import { layoutTree } from "./layout.ts";
import { createTextEngine, type NodeEngine } from "./skia.ts";

export interface FrameEntry {
  /** Component name, falling back to the export name. */
  name: string;
  component: ComponentType;
}

export interface BuiltFrame {
  name: string;
  root: SceneNode;
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

/** Reconciles one artboard into a SceneNode tree without initializing WASM layout or fonts. */
export function reconcileFrame(frame: FrameEntry, opts: { group?: boolean } = {}): { root: SceneNode; unmount(): void } {
  const scene = createSceneRoot();
  scene.render(createElement(frame.component));
  const roots = scene.root.children.filter((c) => c.type !== "#text");
  if (roots.length !== 1) {
    scene.unmount();
    throw new DslError(`Artboard ${frame.name} must return exactly one root element, got ${roots.length}.`);
  }
  const root = roots[0];
  if (opts.group !== false) groupComponents(root);
  return { root, unmount: () => scene.unmount() };
}

export async function buildFrame(frame: FrameEntry): Promise<BuiltFrame> {
  const { root, unmount } = reconcileFrame(frame, { group: false });
  const engine = await createTextEngine();
  await layoutTree(root, engine);
  groupComponents(root);
  return {
    name: frame.name,
    root,
    engine,
    dispose() {
      releaseParagraphs(root);
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
  const at = err.stack?.split("\n").find((l) => l.includes(abs) || /\.(jsx|tsx)[:)]/.test(l));
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
export async function analyzeFile(file: string, visit?: (built: BuiltFrame, warnings: Diagnostic[]) => void): Promise<Analysis> {
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
  for (const frame of frames) {
    try {
      const built = await buildFrame(frame);
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
  return result;
}

export async function lintFile(file: string): Promise<Diagnostic[]> {
  return (await analyzeFile(file)).diagnostics;
}
