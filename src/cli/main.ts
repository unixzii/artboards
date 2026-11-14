#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { parseArgs } from "node:util";
import { checkFrame } from "../engine/checks/layout-lint.ts";
import { ensureTypes } from "../engine/checks/typecheck.ts";
import { generateDocs } from "../engine/dsl/schema.ts";
import { formatTree, toJson } from "../engine/inspect.ts";
import { buildFrame, errorToDiagnostic, lintFile, listFrames, pickFrames } from "../engine/pipeline.ts";
import { renderToPng } from "../engine/skia.ts";
import { commentsPath, resolveFileComments, updateComment } from "../server/comments.ts";
import { startDevServer } from "../server/dev-server.ts";
import { formatDiagnostic, type Diagnostic } from "../shared/diagnostics.ts";

const USAGE = `Usage:
  artboards lint    <file> [--json]                              type-check, render and check every artboard
  artboards render  <file> [--frame Name] [--scale 2] [-o png]   write PNG screenshots (default: out/)
  artboards inspect <file> [--frame Name] [--json]               layer tree with computed bounds
  artboards dev     <file> [--port 4400] [--host 127.0.0.1]      open the viewer for human review, live-reloading
  artboards comments <file> [--all] [--resolve id] [--json]      review comments left in the viewer
  artboards docs                                                 print the DSL reference
  artboards types                                                write types/artboards.d.ts`;

function report(diagnostics: Diagnostic[]) {
  for (const d of diagnostics) console.error(formatDiagnostic(d));
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
    },
  });
  const [command, file] = positionals;

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
    const comments = resolveFileComments(file).filter((c) => values.all || !c.resolved);
    if (values.json) {
      console.log(JSON.stringify(comments, null, 2));
      return 0;
    }
    for (const c of comments) {
      const where = c.attached ? `${c.source ?? ""}  ${c.target}` : `(layer changed since; was a <${c.nodeType}> near ${c.point.x},${c.point.y})`;
      console.log(`#${c.id}${c.resolved ? " [resolved]" : ""}  ${c.frame}  ${where}\n    ${c.text.replace(/\n/g, "\n    ")}`);
    }
    console.log(comments.length ? `${comments.length} comment(s). Mark one done with --resolve <id>.` : "No open comments.");
    return 0;
  }

  if (command === "lint") {
    const diagnostics = await lintFile(file);
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
  try {
    frames = pickFrames(listFrames(file), values.frame, file);
  } catch (e) {
    report([errorToDiagnostic(e, file)]);
    return 1;
  }
  if (values.out && frames.length > 1) {
    console.error(`-o needs a single artboard; pass --frame (${frames.map((f) => f.name).join(", ")}).`);
    return 2;
  }

  let failed = false;
  const json: object[] = [];
  for (const frame of frames) {
    let built;
    try {
      built = await buildFrame(frame);
    } catch (e) {
      report([errorToDiagnostic(e, file, frame.name)]);
      failed = true;
      continue;
    }
    const diagnostics = checkFrame(built);
    const { width, height } = built.root.layout;
    if (command === "render") {
      const out = values.out ?? join("out", `${basename(file, extname(file))}.${frame.name}.png`);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, renderToPng(built.engine, built.root, Number(values.scale)));
      console.log(`${out}  ${width}x${height} @${values.scale}x`);
      report(diagnostics);
    } else if (values.json) {
      json.push({ frame: frame.name, tree: toJson(built.root), diagnostics });
    } else {
      console.log(`# ${frame.name}  ${width}x${height}\n${formatTree(built.root)}`);
      report(diagnostics);
    }
    built.dispose();
  }
  if (command === "inspect" && values.json) console.log(JSON.stringify(json, null, 2));
  return failed ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
