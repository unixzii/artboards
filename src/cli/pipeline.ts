// CLI compilation and analysis pipeline: DSL file -> artboards -> laid-out trees -> diagnostics.

import { relative, resolve } from "node:path";
import type { Diagnostic } from "../shared/diagnostics.ts";
import {
  errorToDiagnostic,
  extractFrames,
  pickFrames,
  reconcileFrame,
  unknownVariants,
  type FrameEntry,
  type FrameVariants,
  type VariantPresets,
} from "../shared/dsl/frame.ts";
import { groupComponents } from "../shared/dsl/reconciler.ts";
import { VariantStore } from "../shared/dsl/variants.ts";
import { checkFrame } from "../shared/layout-lint.ts";
import { layoutTree } from "../shared/layout.ts";
import type { SceneNode } from "../shared/scene.ts";
import { releaseParagraphs } from "../shared/text.ts";
import { DesignCompileError, loadDesign, type LoadedDesign } from "./bundler.ts";
import { createEngine, type NodeEngine } from "./skia.ts";
import { typecheck } from "./typecheck.ts";

export { pickFrames, unknownVariants, type FrameEntry, type FrameVariants, type VariantPresets };

export interface BuiltFrame {
  name: string;
  /** Layer tree: what inspect, lint, and comments see. */
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

export async function loadFrames(file: string): Promise<{ frames: FrameEntry[]; design: LoadedDesign }> {
  const design = await loadDesign(file);
  return { frames: extractFrames(design.exports, design.exportOrder), design };
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

export function cliErrorToDiagnostics(e: unknown, design?: LoadedDesign, frame?: string): Diagnostic[] {
  if (e instanceof DesignCompileError) return e.diagnostics;
  return [design ? design.toDiagnostic(e, frame) : errorToDiagnostic(e, { frame })];
}

/**
 * Type-checks the file, builds every artboard and runs the layout checks.
 * `visit` sees each successfully built artboard before it is disposed.
 */
export async function analyzeFile(
  file: string,
  visit?: (built: BuiltFrame, warnings: Diagnostic[]) => void,
  opts: { variants?: VariantPresets } = {},
): Promise<Analysis> {
  const [typeDiagnostics, loaded] = await Promise.all([
    typecheck(file),
    loadFrames(file).then(
      (ok) => ({ ok, err: undefined }),
      (err) => ({ ok: undefined, err }),
    ),
  ]);
  const diagnostics: Diagnostic[] = [...typeDiagnostics];
  const result: Analysis = { diagnostics, frames: [] };
  if (!loaded.ok) {
    diagnostics.push(...cliErrorToDiagnostics(loaded.err));
    return result;
  }
  const { frames, design } = loaded.ok;
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
      const [error] = cliErrorToDiagnostics(e, design, frame.name);
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
