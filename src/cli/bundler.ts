// Unified esbuild compiler for DSL design files: evaluates modules in-memory
// for CLI commands (`loadDesign`) and produces ESM bundles for the browser
// viewer (`bundleDesign`).

import { existsSync, readFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { build, type Plugin } from "esbuild";
import type { Diagnostic } from "../shared/diagnostics.ts";
import {
  BUNDLE_META_GLOBAL,
  createSourceMapper,
  errorToDiagnostic,
  type BundleMeta,
  type SourceMapData,
  type SourceMapper,
} from "../shared/dsl/frame.ts";
import { BUILTIN_MODULES, RUNTIME_GLOBAL } from "../shared/dsl/runtime.ts";
import { resetCustomFonts } from "../shared/fonts.ts";
import { ASSET_KINDS, importAsset } from "./assets.ts";

const EXTENSIONS = ["", ".jsx", ".tsx", ".ts", ".js"];
const NODE_BUNDLE_TAG = "__artboards_design__.cjs";

export class DesignCompileError extends Error {
  diagnostics: Diagnostic[];
  constructor(diagnostics: Diagnostic[]) {
    super(diagnostics.map((d) => d.message).join("\n"));
    this.name = "DesignCompileError";
    this.diagnostics = diagnostics;
  }
}

function dslPlugin(format: "cjs" | "esm"): Plugin {
  return {
    name: "artboards-dsl",
    setup(b) {
      b.onResolve({ filter: /.*/ }, (args) => {
        if (args.kind === "entry-point") return null;
        if (args.path in BUILTIN_MODULES) {
          return format === "cjs" ? { path: args.path, external: true } : { path: args.path, namespace: "artboards-runtime" };
        }
        if (args.path.startsWith(".")) {
          const base = resolve(args.resolveDir, args.path);
          const ext = extname(base).toLowerCase();
          if (ASSET_KINDS[ext]) {
            if (!existsSync(base)) return { errors: [{ text: `cannot find "${args.path}"` }] };
            return { path: base, namespace: "artboards-asset" };
          }
          const found = EXTENSIONS.map((e) => base + e).find((p) => existsSync(p));
          if (!found) {
            const hint =
              ext && !EXTENSIONS.includes(ext)
                ? ` Importable files: code (.jsx/.tsx/.ts/.js), images and fonts (${Object.keys(ASSET_KINDS).join(" ")}).`
                : "";
            return { errors: [{ text: `cannot resolve import "${args.path}".${hint}` }] };
          }
          return { path: found };
        }
        return { errors: [{ text: `cannot import "${args.path}". Only "artboards" and relative files are available.` }] };
      });

      b.onLoad({ filter: /.*/, namespace: "artboards-runtime" }, (args) => ({
        contents: `module.exports = globalThis[${JSON.stringify(RUNTIME_GLOBAL)}][${JSON.stringify(args.path)}];`,
        loader: "js",
      }));

      b.onLoad({ filter: /.*/, namespace: "artboards-asset" }, (args) => ({
        contents: `export default ${JSON.stringify(importAsset(args.path))};`,
        loader: "js",
      }));
    },
  };
}

/** Extracts export names in source order (esbuild and ESM namespaces sort exports alphabetically). */
function scanExportOrder(src: string): string[] {
  const clean = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, " ");
  const order: string[] = [];
  const re = /\bexport\s+(?:(default)\b|(?:async\s+)?(?:function\s*\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)|\{([^}]*)\})/g;
  for (const m of clean.matchAll(re)) {
    if (m[1]) order.push("default");
    else if (m[2]) order.push(m[2]);
    else if (m[3]) {
      for (const part of m[3].split(",")) {
        const s = part.trim();
        if (!s || /^type\s+/.test(s)) continue;
        const asMatch = /^(?:[A-Za-z_$][\w$]*\s+as\s+)?([A-Za-z_$][\w$]*)$/.exec(s);
        if (asMatch) order.push(asMatch[1]);
      }
    }
  }
  return order;
}

interface CompiledBundle {
  js: string;
  mapText: string;
  meta: BundleMeta;
}

async function compile(file: string, format: "cjs" | "esm"): Promise<{ bundle?: CompiledBundle; errors: Diagnostic[] }> {
  const abs = resolve(file);
  const cwd = process.cwd();
  if (!existsSync(abs)) {
    return {
      errors: [{ severity: "error", rule: "dsl", message: `Cannot find "${file}".`, source: relative(cwd, abs) }],
    };
  }
  try {
    const exportsOrder = scanExportOrder(readFileSync(abs, "utf8"));
    const result = await build({
      entryPoints: [abs],
      absWorkingDir: cwd,
      outdir: cwd,
      bundle: true,
      write: false,
      format,
      target: "es2022",
      jsx: "automatic",
      jsxDev: true,
      jsxImportSource: "artboards",
      sourcemap: "external",
      logLevel: "silent",
      plugins: [dslPlugin(format)],
    });
    const mapFile = result.outputFiles.find((f) => f.path.endsWith(".map"))!;
    const jsFile = result.outputFiles.find((f) => !f.path.endsWith(".map"))!;
    const rawMap = JSON.parse(mapFile.text) as SourceMapData;
    const sources = rawMap.sources.map((s) => relative(cwd, resolve(cwd, s)).replaceAll("\\", "/"));
    return {
      bundle: { js: jsFile.text, mapText: mapFile.text, meta: { map: { sources, mappings: rawMap.mappings }, exports: exportsOrder } },
      errors: [],
    };
  } catch (e: any) {
    if (Array.isArray(e?.errors) && e.errors.length > 0) {
      const errors: Diagnostic[] = e.errors.map((err: any) => ({
        severity: "error",
        rule: "dsl",
        message: err.text,
        source: err.location ? `${err.location.file}:${err.location.line}` : relative(cwd, abs),
      }));
      return { errors };
    }
    return {
      errors: [{ severity: "error", rule: "dsl", message: String(e instanceof Error ? e.message : e), source: relative(cwd, abs) }],
    };
  }
}

export interface LoadedDesign {
  exports: Record<string, unknown>;
  exportOrder: string[];
  mapSource: SourceMapper;
  toDiagnostic(e: unknown, frame?: string): Diagnostic;
}

/** Compiles and evaluates a design file in Node for CLI commands. */
export async function loadDesign(file: string): Promise<LoadedDesign> {
  resetCustomFonts();
  const { bundle, errors } = await compile(file, "cjs");
  if (!bundle) throw new DesignCompileError(errors);

  const mapSource = createSourceMapper(bundle.meta.map);
  const toDiagnostic = (e: unknown, frame?: string) =>
    errorToDiagnostic(e, { frame, bundleTag: NODE_BUNDLE_TAG, lineOffset: -2, mapSource });

  const mod = { exports: {} as Record<string, unknown> };
  const req = (spec: string) => {
    if (spec in BUILTIN_MODULES) return BUILTIN_MODULES[spec];
    throw new Error(`Unexpected external import "${spec}"`);
  };
  try {
    // `new Function` adds a 2-line wrapper header in V8 (`lineOffset: -2`).
    new Function("require", "module", "exports", `${bundle.js}\n//# sourceURL=${NODE_BUNDLE_TAG}`)(req, mod, mod.exports);
  } catch (e) {
    throw new DesignCompileError([toDiagnostic(e)]);
  }
  return { exports: mod.exports, exportOrder: bundle.meta.exports, mapSource, toDiagnostic };
}

/** Compiles a design file into a browser ESM bundle with inline source maps. */
export async function bundleDesign(file: string): Promise<{ code?: string; errors: Diagnostic[] }> {
  const { bundle, errors } = await compile(file, "esm");
  if (!bundle) return { errors };
  const b64 = Buffer.from(bundle.mapText, "utf8").toString("base64");
  // Placed without a newline before esbuild's line-1 runtime helper so line numbers stay 1:1.
  const prefix = `globalThis[${JSON.stringify(BUNDLE_META_GLOBAL)}]=${JSON.stringify(bundle.meta)};`;
  const code = `${prefix}${bundle.js}\n//# sourceMappingURL=data:application/json;base64,${b64}\n`;
  return { code, errors: [] };
}
