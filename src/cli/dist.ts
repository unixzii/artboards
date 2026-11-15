// Files `npm run build` writes to dist/ next to the bundled CLI. The CLI only
// reads them; nothing in the package is generated while it runs.

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The package root: the nearest directory with a package.json, from src/cli/ or from dist/. */
function packageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, "package.json"))) {
    const up = dirname(dir);
    if (up === dir) throw new Error("artboards: cannot find the package root.");
    dir = up;
  }
  return dir;
}

const DIST = join(packageRoot(), "dist");

/** Path of a built file; throws when the package has not been built. */
export function distFile(name: string): string {
  const path = join(DIST, name);
  if (!existsSync(path)) throw new Error(`artboards: missing ${path}. Run \`npm run build\` in the artboards package.`);
  return path;
}
