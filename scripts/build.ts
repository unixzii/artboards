// Builds everything the published package runs or reads into dist/:
//   cli.js          the `artboards` bin (src/cli bundled; dependencies stay imports)
//   viewer/         the browser viewer `artboards dev` serves
//   artboards.d.ts  the declarations `artboards lint` type-checks designs against
//   docs.md         what `artboards docs` prints
// Node cannot run TypeScript from node_modules, so the CLI must ship as JavaScript.

import { chmodSync, copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { generateDocs, generateDts } from "../src/docs/generate.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");

/** `dev` keeps the viewer readable: unminified, with an inline source map. */
export async function buildAll({ dev = false } = {}) {
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(join(dist, "viewer"), { recursive: true });

  await Promise.all([
    build({
      entryPoints: [join(root, "src/cli/main.ts")],
      outfile: join(dist, "cli.js"),
      bundle: true,
      platform: "node",
      format: "esm",
      target: "node22",
      packages: "external",
      logLevel: "warning",
    }),
    build({
      entryPoints: [join(root, "src/viewer/main.tsx")],
      outfile: join(dist, "viewer/client.js"),
      bundle: true,
      format: "esm",
      target: "es2022",
      jsx: "automatic",
      define: { "process.env.NODE_ENV": '"production"' },
      minify: !dev,
      sourcemap: dev ? "inline" : false,
      logLevel: "warning",
    }),
  ]);
  chmodSync(join(dist, "cli.js"), 0o755);
  for (const file of ["index.html", "style.css"]) copyFileSync(join(root, "src/viewer", file), join(dist, "viewer", file));

  const dts = generateDts();
  writeFileSync(join(dist, "artboards.d.ts"), dts);
  writeFileSync(join(dist, "docs.md"), generateDocs(dts));
}

if (import.meta.main) {
  const started = performance.now();
  await buildAll();
  console.log(`built dist/ in ${Math.round(performance.now() - started)}ms`);
}
