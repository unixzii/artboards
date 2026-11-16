#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { Command, CommanderError, InvalidArgumentError, Option } from "@commander-js/extra-typings";
import pkg from "../../package.json" with { type: "json" };
import { formatDiagnostic, type Diagnostic } from "../shared/diagnostics.ts";
import { VariantStore } from "../shared/dsl/variants.ts";
import { checkFrame } from "../shared/layout-lint.ts";
import { commentsPath, importComments, resolveFileComments, updateComment } from "./comments-store.ts";
import { startDevServer } from "./dev-server.ts";
import { distFile } from "./dist.ts";
import { formatTrace, formatTree, formatVariants, toJson } from "./inspect.ts";
import { autoMoments, parseTimes, SETTLE_LIMIT, settleTime, Timeline, Trace, type Settling, type TimeSpec } from "./motion.ts";
import {
  buildFrame,
  cliErrorToDiagnostics,
  type FrameEntry,
  lintFile,
  loadFrames,
  pickFrames,
  unknownVariants,
  type FrameVariants,
  type VariantPresets,
} from "./pipeline.ts";
import { buildSite, OutDirError } from "./build.ts";
import { Filmstrip, renderToPng } from "./skia.ts";
import { err, out } from "./style.ts";

// ------------------------------------------------------------------ options

/** Exit code for a mistake in how the CLI was called, as opposed to a problem in the design. */
const USAGE_ERROR = 2;

class UsageError extends Error {}

function collectVariant(value: string, previous: VariantPresets): VariantPresets {
  const i = value.indexOf("=");
  if (i <= 0) throw new InvalidArgumentError("Expected name=value, e.g. --variant Step=2.");
  return [...previous, [value.slice(0, i), value.slice(i + 1)]];
}

function times(value: string): TimeSpec {
  try {
    return parseTimes(value);
  } catch (e) {
    throw new InvalidArgumentError((e as Error).message);
  }
}

function positiveNumber(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new InvalidArgumentError("Expected a number greater than 0.");
  return n;
}

function port(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 65535) throw new InvalidArgumentError("Expected a port number from 0 to 65535.");
  return n;
}

function commentId(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new InvalidArgumentError("Expected a comment id such as 3.");
  return n;
}

const variantOption = () =>
  new Option("--variant <name=value>", "render another state of a useVariant (repeatable)").argParser(collectVariant).default([] as VariantPresets, "initial values");
const frameOption = () => new Option("-f, --frame <name>", "only this artboard");
const atOption = () =>
  new Option("--at <ms>", "play the motion and show these moments: 120, 0,80,160, 0..600:50 (start..end:step) or auto (until springs settle)").argParser(times);
const toOption = () =>
  new Option("--to <name=value>", "start at rest in the --variant state, then switch this variant at 0 ms and play the transition (repeatable)")
    .argParser(collectVariant)
    .default([] as VariantPresets, "none");
const jsonOption = (what: string) => new Option("--json", `print ${what} as JSON`);

// ------------------------------------------------------------------ output

function report(diagnostics: Diagnostic[]) {
  for (const d of diagnostics) console.error(formatDiagnostic(d, err.diagnostic));
}

/** `.Step=2` for each preset this artboard declares, in flag order, safe for a file name. */
function variantSuffix(presets: VariantPresets, store: VariantStore): string {
  const names = [...new Set(presets.map(([name]) => name))].filter((name) => store.has(name));
  return names.map((name) => `.${name}=${String(store.get(name))}`.replace(/[/\\:*?"<>|\s]/g, "_")).join("");
}

// ------------------------------------------------------------------ commands

async function lint(file: string, opts: { json?: true; variant: VariantPresets }): Promise<number> {
  const diagnostics = await lintFile(file, { variants: opts.variant });
  const errors = diagnostics.filter((d) => d.severity === "error").length;
  if (opts.json) {
    console.log(JSON.stringify(diagnostics, null, 2));
  } else {
    for (const d of diagnostics) console.log(formatDiagnostic(d, out.diagnostic));
    const warnings = diagnostics.length - errors;
    console.log(
      diagnostics.length === 0
        ? out("green", "ok: no problems")
        : out(errors ? ["red", "bold"] : ["yellow", "bold"], `${errors} error(s), ${warnings} warning(s)`),
    );
  }
  return errors ? 1 : 0;
}

type FrameCommandOptions = {
  frame?: string;
  variant: VariantPresets;
  at?: TimeSpec;
  to?: VariantPresets;
  out?: string;
  scale?: number;
  transparent?: true;
  json?: true;
};

const ms = (t: number) => `${Math.round(t * 10) / 10} ms`;

/** What the motion did, for the summary line. */
function settleNote({ settled, looping }: Settling): string {
  const springs = settled === null ? `springs still moving at ${ms(SETTLE_LIMIT)}` : settled === 0 ? "no spring moves" : `springs settle at ${ms(settled)}`;
  return looping ? `${springs}; a useAnimationTime loop keeps running` : springs;
}

/**
 * render/inspect with --at or --to: plays the artboard on a virtual clock and
 * renders a filmstrip (or one frame), or traces what changes over time.
 */
async function playFrame(
  command: "render" | "inspect",
  file: string,
  frame: FrameEntry,
  record: FrameVariants,
  opts: FrameCommandOptions,
  json: object[],
) {
  const to = opts.to ?? [];
  const settling = await settleTime(frame, { variants: new VariantStore(opts.variant), to });
  const { settled } = settling;
  const spec = opts.at ?? "auto";
  const moments = spec === "auto" ? autoMoments(settling) : spec;
  const timeline = await Timeline.start(frame, { variants: record.store, to });
  try {
    record.rendered = record.store.list();
    const range = moments.length === 1 ? `at ${ms(moments[0])}` : `${moments.length} frames, ${ms(moments[0])} to ${ms(moments[moments.length - 1])}`;
    if (command === "render") {
      const scale = opts.scale ?? 1;
      const toSuffix = [...new Set(to.map(([name]) => name))]
        .filter((name) => record.store.has(name))
        .map((name) => `.to-${name}=${String(record.store.get(name))}`.replace(/[/\\:*?"<>|\s]/g, "_"))
        .join("");
      const when = moments.length === 1 ? `.at-${moments[0]}ms` : ".motion";
      const png = opts.out ?? join("out", `${basename(file, extname(file))}.${frame.name}${variantSuffix(opts.variant, record.store)}${toSuffix}${when}.png`);
      let bytes: Uint8Array;
      let size = "";
      if (moments.length === 1) {
        const root = await timeline.at(moments[0]);
        size = `${root.layout.width}x${root.layout.height}`;
        bytes = renderToPng(timeline.engine, root, scale, { transparent: opts.transparent });
      } else {
        let strip: Filmstrip | undefined;
        for (const t of moments) {
          const root = await timeline.at(t);
          size ||= `${root.layout.width}x${root.layout.height}`;
          strip ??= new Filmstrip(timeline.engine, moments.length, root.layout.width, root.layout.height, scale, { transparent: opts.transparent });
          await strip.add(settled !== null && settled > 0 && t >= settled ? `${ms(t)} · at rest` : ms(t), root);
        }
        bytes = strip!.encode();
      }
      mkdirSync(dirname(png), { recursive: true });
      writeFileSync(png, bytes);
      console.log(`${png}  ${out("dim", `${size} @${scale}x, ${range}; ${settleNote(settling)}`)}`);
    } else if (moments.length === 1) {
      const root = await timeline.at(moments[0]);
      const { width, height } = root.layout;
      if (opts.json) json.push({ frame: frame.name, at: moments[0], settledAt: settled, tree: toJson(root), ...(record.rendered.length ? { variants: record.rendered } : {}) });
      else console.log(`${out("bold", `# ${frame.name}`)}  ${width}x${height}  ${out("dim", `${range}; ${settleNote(settling)}`)}\n${formatVariants(record.rendered)}${formatTree(root)}`);
    } else {
      const trace = new Trace();
      for (const t of moments) trace.add(t, await timeline.at(t));
      const layers = trace.changes();
      if (opts.json) json.push({ frame: frame.name, times: trace.times, settledAt: settled, layers, ...(record.rendered.length ? { variants: record.rendered } : {}) });
      else console.log(`${out("bold", `# ${frame.name}`)}  ${out("dim", `${range}; ${settleNote(settling)}`)}\n${formatVariants(record.rendered)}${formatTrace(trace.times, layers)}`);
    }
  } finally {
    timeline.dispose();
  }
}

/** render and inspect: build each picked artboard, then write a PNG or describe it. */
async function eachFrame(command: "render" | "inspect", file: string, opts: FrameCommandOptions): Promise<number> {
  const presets = opts.variant;
  let frames;
  let design;
  try {
    const loaded = await loadFrames(file);
    design = loaded.design;
    frames = pickFrames(loaded.frames, opts.frame, file);
  } catch (e) {
    report(cliErrorToDiagnostics(e, design));
    return 1;
  }
  if (opts.out && frames.length > 1) {
    throw new UsageError(`--out needs a single artboard; pass --frame with one of: ${frames.map((f) => f.name).join(", ")}.`);
  }

  let failed = false;
  const json: object[] = [];
  const seen: FrameVariants[] = [];
  for (const frame of frames) {
    const record: FrameVariants = { frame: frame.name, store: new VariantStore(presets), rendered: [] };
    seen.push(record);
    if (opts.at !== undefined || opts.to?.length) {
      try {
        await playFrame(command, file, frame, record, opts, json);
      } catch (e) {
        report(cliErrorToDiagnostics(e, design, frame.name));
        failed = true;
      }
      continue;
    }
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
      const scale = opts.scale ?? 1;
      const png = opts.out ?? join("out", `${basename(file, extname(file))}.${frame.name}${variantSuffix(presets, built.variants)}.png`);
      mkdirSync(dirname(png), { recursive: true });
      writeFileSync(png, renderToPng(built.engine, built.root, scale, { transparent: opts.transparent }));
      console.log(`${png}  ${out("dim", `${width}x${height} @${scale}x`)}`);
      report(diagnostics);
    } else if (opts.json) {
      json.push({ frame: frame.name, tree: toJson(built.root), ...(record.rendered.length ? { variants: record.rendered } : {}), diagnostics });
    } else {
      console.log(`${out("bold", `# ${frame.name}`)}  ${width}x${height}\n${formatVariants(record.rendered)}${formatTree(built.root)}`);
      report(diagnostics);
    }
    built.dispose();
  }
  const unknown = unknownVariants([...presets, ...(opts.to ?? [])], seen);
  if (unknown.length) {
    report(unknown);
    failed = true;
  }
  if (command === "inspect" && opts.json) console.log(JSON.stringify(json, null, 2));
  return failed ? 1 : 0;
}

async function dev(file: string, opts: { port: number; host: string }): Promise<number> {
  const url = await startDevServer({ file, port: opts.port, host: opts.host });
  console.log(`Viewer running at ${out(["cyan", "underline"], url)}  ${out("dim", `(watching ${file}; Ctrl+C to stop)`)}`);
  return new Promise<number>(() => {}); // runs until interrupted
}

async function build(file: string, opts: { out?: string }): Promise<number> {
  const dir = opts.out ?? join("out", basename(file, extname(file)));
  let site;
  try {
    site = await buildSite(file, dir);
  } catch (e) {
    if (e instanceof OutDirError) throw new UsageError(e.message);
    throw e;
  }
  if ("errors" in site) {
    report(site.errors);
    return 1;
  }
  report(site.typeErrors);
  const exported = basename(commentsPath(file));
  console.log(
    [
      `${out("green", `Built ${dir}/`)}  ${out("dim", `${site.files} files, ${(site.bytes / 1e6).toFixed(1)} MB`)}`,
      ...(site.typeErrors.length ? [out("yellow", `${site.typeErrors.length} type error(s); the site lists them under Problems.`)] : []),
      "",
      "Serve the directory with any static file server, e.g.",
      `  npx serve ${dir}`,
      `Reviewers' comments stay in their browser until they export them as ${exported}. Add them here with`,
      `  artboards comments ${file} --import ${exported}`,
    ].join("\n"),
  );
  return 0;
}

async function comments(file: string, opts: { all?: true; resolve?: number; import?: string; json?: true }): Promise<number> {
  if (opts.import !== undefined) {
    const added = importComments(file, opts.import);
    console.log(added ? out("green", `Added ${added} comment(s) to ${commentsPath(file)}.`) : "No new comments in that file.");
    return 0;
  }
  if (opts.resolve !== undefined) {
    const ok = updateComment(file, opts.resolve, { resolved: true });
    if (ok) console.log(out("green", `Resolved comment #${opts.resolve}.`));
    else console.error(err("red", `No comment #${opts.resolve} in ${commentsPath(file)}.`));
    return ok ? 0 : 1;
  }
  const list = (await resolveFileComments(file)).filter((c) => opts.all || !c.resolved);
  if (opts.json) {
    console.log(JSON.stringify(list, null, 2));
    return 0;
  }
  for (const c of list) {
    const where = c.attached
      ? `${out("cyan", c.source ?? "")}  ${c.target}`
      : out("yellow", `(layer changed since; was a <${c.nodeType}${c.hint ? ` ${JSON.stringify(c.hint)}` : ""}> at ${c.path || "the root"})`);
    const id = out("bold", `#${c.id}`) + (c.resolved ? out("dim", " [resolved]") : "");
    console.log(`${id}  ${c.frame}  ${where}\n    ${c.text.replace(/\n/g, "\n    ")}`);
  }
  console.log(list.length ? `${list.length} comment(s). Mark one done with --resolve <id>.` : "No open comments.");
  return 0;
}

// ------------------------------------------------------------------ program

let exitCode = 0;
/** Wraps a command so its result becomes the exit code. */
const run =
  <A extends unknown[]>(fn: (...args: A) => Promise<number>) =>
  async (...args: A) => {
    exitCode = await fn(...args);
  };

const program = new Command()
  .name("artboards")
  .description("Design UI as JSX/TSX artboards: check, screenshot and inspect them, and review them in a browser.")
  .version(pkg.version, "-v, --version")
  .helpCommand("help [command]", "show help for a command")
  .showHelpAfterError(err("dim", "(add --help for usage)"))
  .configureHelp({ showGlobalOptions: false, sortSubcommands: false })
  .configureOutput({ outputError: (text, write) => write(err("red", text)) })
  .exitOverride()
  .addHelpText(
    "after",
    `
Examples:
  $ artboards lint design.tsx                          run after every edit
  $ artboards render design.tsx -f Home --scale 2      screenshot one artboard at 2x
  $ artboards inspect design.tsx --variant Step=2      layer tree of another state
  $ artboards render design.tsx -f Home --to Sheet=open   filmstrip of a transition
  $ artboards render design.tsx -f Home --at 0..600:50    the motion from mount, every 50 ms
  $ artboards dev design.tsx                           open the review viewer
  $ artboards build design.tsx                         a static site for reviewers
  $ artboards docs                                     the DSL reference`,
  );

program
  .command("lint")
  .description("type-check, render and check every artboard; exits 1 on errors")
  .argument("<file>", "design file (.jsx/.tsx)")
  .addOption(variantOption())
  .addOption(jsonOption("the diagnostics"))
  .action(run(lint));

program
  .command("render")
  .description("write a PNG of every artboard (default: out/<file>.<Artboard>.png)")
  .argument("<file>", "design file (.jsx/.tsx)")
  .addOption(frameOption())
  .addOption(variantOption())
  .addOption(new Option("-s, --scale <factor>", "pixel density of the PNG").argParser(positiveNumber).default(1))
  .addOption(atOption())
  .addOption(toOption())
  .addOption(new Option("-o, --out <png>", "where to write the PNG; needs a single artboard (--frame)"))
  .addOption(new Option("--transparent", "leave the PNG transparent where the artboard paints nothing, instead of white"))
  .action(run((file, opts) => eachFrame("render", file, opts)));

program
  .command("inspect")
  .description("print each artboard's layer tree with computed bounds, source lines and variants; with --at/--to, what changes over time")
  .argument("<file>", "design file (.jsx/.tsx)")
  .addOption(frameOption())
  .addOption(variantOption())
  .addOption(atOption())
  .addOption(toOption())
  .addOption(jsonOption("the trees"))
  .action(run((file, opts) => eachFrame("inspect", file, opts)));

program
  .command("dev")
  .description("open the viewer a human uses to review and comment; reloads on every save")
  .argument("<file>", "design file (.jsx/.tsx)")
  .addOption(new Option("-p, --port <port>", "port to listen on").argParser(port).default(4400))
  .addOption(new Option("--host <host>", "interface to listen on").default("127.0.0.1"))
  .action(run(dev));

program
  .command("build")
  .description("write the design as a static site to review without a server; comments stay in each reviewer's browser until exported")
  .argument("<file>", "design file (.jsx/.tsx)")
  .addOption(new Option("-o, --out <dir>", "directory to write the site to (default: out/<file>)"))
  .action(run(build));

program
  .command("comments")
  .description("list review comments left in the viewer, with the source line of each layer")
  .argument("<file>", "design file (.jsx/.tsx)")
  .addOption(new Option("--all", "include resolved comments"))
  .addOption(new Option("--resolve <id>", "mark a comment as addressed").argParser(commentId))
  .addOption(new Option("--import <json>", "add the comments of a file exported from a site made by `build`").conflicts("resolve"))
  .addOption(jsonOption("the comments"))
  .action(run(comments));

program
  .command("docs")
  .description("print the DSL reference (guide and API)")
  .action(() => {
    process.stdout.write(readFileSync(distFile("docs.md"), "utf8"));
  });

// Set the code instead of calling process.exit: exiting at once cuts off
// stdout that is still draining into a pipe (large `--json` output).
try {
  await program.parseAsync();
  process.exitCode = exitCode;
} catch (e) {
  if (e instanceof CommanderError) {
    // Help and --version exit 0; commander has already printed any error.
    process.exitCode = e.exitCode === 0 ? 0 : USAGE_ERROR;
  } else if (e instanceof UsageError) {
    console.error(err("red", `error: ${e.message}`));
    process.exitCode = USAGE_ERROR;
  } else {
    console.error(e);
    process.exitCode = 1;
  }
}
