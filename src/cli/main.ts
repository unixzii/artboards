#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { parseArgs } from "node:util";
import { formatDiagnostic, type Diagnostic } from "../shared/diagnostics.ts";
import { generateDocs } from "../shared/dsl/schema.ts";
import { VariantStore } from "../shared/dsl/variants.ts";
import { checkFrame } from "../shared/layout-lint.ts";
import { commentsPath, resolveFileComments, updateComment } from "./comments-store.ts";
import { startDevServer } from "./dev-server.ts";
import { formatTree, formatVariants, toJson } from "./inspect.ts";
import {
  buildFrame,
  cliErrorToDiagnostics,
  lintFile,
  loadFrames,
  pickFrames,
  unknownVariants,
  type FrameVariants,
  type VariantPresets,
} from "./pipeline.ts";
import { renderToPng } from "./skia.ts";
import { ensureTypes } from "./typecheck.ts";

const USAGE = `Usage:
  artboards lint    <file> [--json]                              type-check, render and check every artboard
  artboards render  <file> [--frame Name] [--scale 2] [-o png]   write PNG screenshots (default: out/)
  artboards inspect <file> [--frame Name] [--json]               layer tree with computed bounds and variants
    lint, render and inspect take --variant name=value (repeatable) to render another state
  artboards dev     <file> [--port 4400] [--host 127.0.0.1]      open the viewer for human review, live-reloading
  artboards comments <file> [--all] [--resolve id] [--json]      review comments left in the viewer
  artboards docs                                                 print the DSL reference
  artboards types                                                write types/artboards.d.ts`;

function report(diagnostics: Diagnostic[]) {
  for (const d of diagnostics) console.error(formatDiagnostic(d));
}

/** `--variant name=value` flags -> presets, or the problem with one. */
function parseVariants(flags: string[]): VariantPresets | string {
  const presets: VariantPresets = [];
  for (const flag of flags) {
    const i = flag.indexOf("=");
    if (i <= 0) return `--variant takes name=value, got ${JSON.stringify(flag)}.`;
    presets.push([flag.slice(0, i), flag.slice(i + 1)]);
  }
  return presets;
}

/** `.Step=2` for each preset this artboard declares, in flag order, safe for a file name. */
function variantSuffix(presets: VariantPresets, store: VariantStore): string {
  const names = [...new Set(presets.map(([name]) => name))].filter((name) => store.has(name));
  return names.map((name) => `.${name}=${String(store.get(name))}`.replace(/[/\\:*?"<>|\s]/g, "_")).join("");
}

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      frame: { type: "string" },
      out: { type: "string", short: "o" },
      scale: { type: "string", default: "1" },
      json: { type: "boolean", default: false },
      port: { type: "string", default: "4400" },
      host: { type: "string", default: "127.0.0.1" },
      all: { type: "boolean", default: false },
      resolve: { type: "string" },
      variant: { type: "string", multiple: true, default: [] },
    },
  });
  const [command, file] = positionals;
  const presets = parseVariants(values.variant);
  if (typeof presets === "string") {
    console.error(presets);
    return 2;
  }

  if (command === "docs") {
    console.log(generateDocs());
    return 0;
  }
  if (command === "types") {
    console.log(ensureTypes());
    return 0;
  }
  if (!file || !["lint", "render", "inspect", "dev", "comments"].includes(command)) {
    console.error(USAGE);
    return 2;
  }

  if (command === "dev") {
    const url = await startDevServer({ file, port: Number(values.port), host: values.host });
    console.log(`Viewer running at ${url}  (watching ${file}; Ctrl+C to stop)`);
    return new Promise<number>(() => {}); // runs until interrupted
  }

  if (command === "comments") {
    if (values.resolve) {
      const ok = updateComment(file, Number(values.resolve), { resolved: true });
      console.log(ok ? `Resolved comment #${values.resolve}.` : `No comment #${values.resolve} in ${commentsPath(file)}.`);
      return ok ? 0 : 1;
    }
    const comments = (await resolveFileComments(file)).filter((c) => values.all || !c.resolved);
    if (values.json) {
      console.log(JSON.stringify(comments, null, 2));
      return 0;
    }
    for (const c of comments) {
      const where = c.attached ? `${c.source ?? ""}  ${c.target}` : `(layer changed since; was a <${c.nodeType}${c.hint ? ` ${JSON.stringify(c.hint)}` : ""}> at ${c.path || "the root"})`;
      console.log(`#${c.id}${c.resolved ? " [resolved]" : ""}  ${c.frame}  ${where}\n    ${c.text.replace(/\n/g, "\n    ")}`);
    }
    console.log(comments.length ? `${comments.length} comment(s). Mark one done with --resolve <id>.` : "No open comments.");
    return 0;
  }

  if (command === "lint") {
    const diagnostics = await lintFile(file, { variants: presets });
    const errors = diagnostics.filter((d) => d.severity === "error").length;
    if (values.json) {
      console.log(JSON.stringify(diagnostics, null, 2));
    } else {
      for (const d of diagnostics) console.log(formatDiagnostic(d));
      console.log(
        diagnostics.length === 0 ? "ok: no problems" : `${errors} error(s), ${diagnostics.length - errors} warning(s)`,
      );
    }
    return errors ? 1 : 0;
  }

  let frames;
  let design;
  try {
    const loaded = await loadFrames(file);
    design = loaded.design;
    frames = pickFrames(loaded.frames, values.frame, file);
  } catch (e) {
    report(cliErrorToDiagnostics(e, design));
    return 1;
  }
  if (values.out && frames.length > 1) {
    console.error(`-o needs a single artboard; pass --frame (${frames.map((f) => f.name).join(", ")}).`);
    return 2;
  }

  let failed = false;
  const json: object[] = [];
  const seen: FrameVariants[] = [];
  for (const frame of frames) {
    const record: FrameVariants = { frame: frame.name, store: new VariantStore(presets), rendered: [] };
    seen.push(record);
    let built;
    try {
      built = await buildFrame(frame, { variants: record.store });
      record.rendered = built.variants.list();
    } catch (e) {
      report(cliErrorToDiagnostics(e, design, frame.name));
      failed = true;
      continue;
    }
    const diagnostics = checkFrame(built);
    const { width, height } = built.root.layout;
    if (command === "render") {
      const out = values.out ?? join("out", `${basename(file, extname(file))}.${frame.name}${variantSuffix(presets, built.variants)}.png`);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, renderToPng(built.engine, built.root, Number(values.scale)));
      console.log(`${out}  ${width}x${height} @${values.scale}x`);
      report(diagnostics);
    } else if (values.json) {
      json.push({ frame: frame.name, tree: toJson(built.root), ...(record.rendered.length ? { variants: record.rendered } : {}), diagnostics });
    } else {
      console.log(`# ${frame.name}  ${width}x${height}\n${formatVariants(record.rendered)}${formatTree(built.root)}`);
      report(diagnostics);
    }
    built.dispose();
  }
  const unknown = unknownVariants(presets, seen);
  if (unknown.length) {
    report(unknown);
    failed = true;
  }
  if (command === "inspect" && values.json) console.log(JSON.stringify(json, null, 2));
  return failed ? 1 : 0;
}

// Set the code instead of calling process.exit: exiting at once cuts off
// stdout that is still draining into a pipe (large `--json` output).
main().then(
  (code) => {
    process.exitCode = code;
  },
  (e) => {
    console.error(e);
    process.exitCode = 1;
  },
);
