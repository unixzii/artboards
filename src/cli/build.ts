// `artboards build`: the design as a static site, for review without a server.
// The build that `artboards dev` would serve is baked into index.html; the
// viewer then keeps comments in each reviewer's browser until they export them.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { Diagnostic } from "../shared/diagnostics.ts";
import { VariantStore } from "../shared/dsl/variants.ts";
import { packFilesFor } from "../shared/fonts.ts";
import { STATIC_BUILD_ELEMENT, type BuildPayload } from "../shared/protocol.ts";
import { registeredAssets } from "./assets.ts";
import { bundleDesign } from "./bundler.ts";
import { readComments } from "./comments-store.ts";
import { distFile } from "./dist.ts";
import { fontDir, usedFontFiles } from "./fonts.ts";
import { buildFrame, loadFrames } from "./pipeline.ts";
import { canvasKitDir, taffyWasmPath } from "./skia.ts";
import { typecheck } from "./typecheck.ts";

export class OutDirError extends Error {}

export interface Site {
  /** Number of files written. */
  files: number;
  bytes: number;
  typeErrors: Diagnostic[];
}

/** Builds the site, or returns the errors that stopped the design from compiling. */
export async function buildSite(file: string, outDir: string): Promise<Site | { errors: Diagnostic[] }> {
  const bundle = await bundleDesign(file);
  if (bundle.code === undefined) return { errors: bundle.errors };
  const [typeErrors, fontFiles] = await Promise.all([typecheck(file), fontsFor(file, bundle.code)]);

  const payload: BuildPayload = {
    file: relative(process.cwd(), resolve(file)).replaceAll("\\", "/"),
    version: 1,
    buildErrors: [],
    typeErrors,
    comments: readComments(file),
  };
  // `<` escaped so text in the design cannot close the script element.
  const baked = `<script type="application/json" id="${STATIC_BUILD_ELEMENT}">${JSON.stringify(payload).replaceAll("<", "\\u003c")}</script>`;
  const html = readFileSync(distFile("viewer/index.html"), "utf8").replace("</head>", `    ${baked}\n  </head>`);

  /** Published path -> file to copy, or the contents to write. */
  const files = new Map<string, string | { text: string }>([
    ["index.html", { text: html }],
    ["design.js", { text: bundle.code }],
    ["client.js", distFile("viewer/client.js")],
    ["style.css", distFile("viewer/style.css")],
    ["canvaskit/canvaskit.js", join(canvasKitDir, "canvaskit.js")],
    ["canvaskit/canvaskit.wasm", join(canvasKitDir, "canvaskit.wasm")],
    ["taffy/taffy_wasm_bg.wasm", taffyWasmPath],
  ]);
  for (const url of fontFiles) {
    const [, pack, name] = url.split("/").slice(1);
    const dir = fontDir(pack);
    if (dir && existsSync(join(dir, name))) files.set(`fonts/${pack}/${name}`, join(dir, name));
  }
  for (const [id, path] of registeredAssets()) files.set(`assets/${id}`, path);

  prepareOutDir(outDir);
  let bytes = 0;
  for (const [path, source] of files) {
    const target = join(outDir, path);
    mkdirSync(dirname(target), { recursive: true });
    if (typeof source === "string") copyFileSync(source, target);
    else writeFileSync(target, source.text);
    bytes += statSync(target).size;
  }
  return { files: files.size, bytes, typeErrors };
}

/** An empty or missing directory, or an earlier build, which is replaced. Anything else is left alone. */
function prepareOutDir(dir: string) {
  if (!existsSync(dir)) return;
  if (!statSync(dir).isDirectory()) throw new OutDirError(`${dir} is a file. Pass another --out.`);
  if (readdirSync(dir).length === 0) return;
  const index = join(dir, "index.html");
  if (!existsSync(index) || !readFileSync(index, "utf8").includes(`id="${STATIC_BUILD_ELEMENT}"`)) {
    throw new OutDirError(`${dir} is not empty and is not an earlier \`artboards build\`. Pass another --out.`);
  }
  rmSync(dir, { recursive: true });
}

/**
 * The bundled font files the site needs. Fonts load per Unicode subset, weight
 * and style; which ones a reviewer will need depends on state they reach by
 * clicking, which a build cannot see. So: the weights and styles every artboard
 * uses in each of its variants, in each subset covering a character anywhere
 * in the design's code.
 */
async function fontsFor(file: string, code: string): Promise<string[]> {
  try {
    const { frames } = await loadFrames(file);
    for (const frame of frames) {
      try {
        const first = await buildFrame(frame, { variants: new VariantStore() });
        const variants = first.variants.list();
        first.dispose();
        for (const v of variants) {
          for (const option of v.options) {
            if (Object.is(option, v.initial)) continue;
            (await buildFrame(frame, { variants: new VariantStore([[v.name, String(option)]]) })).dispose();
          }
        }
      } catch {
        // An artboard that fails to render shows its error in the viewer.
      }
    }
  } catch {
    // The design fails at load; the viewer shows why.
  }

  const codePoints = new Set<number>();
  const text = code.replace(/\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})/gi, (_, long, short) => String.fromCodePoint(parseInt(long ?? short, 16)));
  for (const ch of text) codePoints.add(ch.codePointAt(0)!);

  const files = new Set(usedFontFiles);
  for (const url of usedFontFiles) {
    const m = /^\/fonts\/([a-z0-9-]+)\/.+-(\d+)-(normal|italic)\.woff2$/.exec(url);
    if (!m) continue;
    for (const name of packFilesFor(m[1], Number(m[2]), m[3] === "italic", codePoints)) files.add(`/fonts/${m[1]}/${name}`);
  }
  return [...files];
}
