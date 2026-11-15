// Builds dist/ and serves the viewer on an example, for working on this package.
// Run through `npm run dev`, which restarts it whenever src/ changes; extra
// arguments go to `artboards dev` (e.g. `npm run dev -- examples/page1.jsx`).

import { buildAll } from "./build.ts";

const [file = "examples/roastery/index.tsx", ...rest] = process.argv.slice(2);
await buildAll({ dev: true });
process.argv = [process.argv[0], "artboards", "dev", file, ...rest];
await import(new URL("../dist/cli.js", import.meta.url).href);
