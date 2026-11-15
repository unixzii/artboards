// Runs the built CLI's `artboards lint` on every example, as an end-to-end check
// of the package. Exits non-zero when any example has a problem. Build first.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

// examples/flows.jsx is left out: its `Broken` artboard fails lint on purpose.
const EXAMPLES = [
  "examples/page1.jsx",
  "examples/path.jsx",
  "examples/features/features.jsx",
  "examples/features/illustrations.jsx",
  "examples/roastery/index.tsx",
];

let failed = 0;
for (const file of EXAMPLES) {
  const run = spawnSync(process.execPath, [cli, "lint", file], { cwd: root, encoding: "utf8" });
  if (run.status === 0) {
    console.log(`ok    ${file}`);
  } else {
    failed++;
    console.log(`FAIL  ${file}\n${(run.stderr + run.stdout).trimEnd().replace(/^/gm, "      ")}`);
  }
}
process.exit(failed ? 1 : 0);
