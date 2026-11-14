// Converts Lucide icon nodes into single SVG path strings for <Path viewBox="0 0 24 24">.
// Usage (from the repo root):
//   node examples/roastery/tools/gen-icons.mjs examples/roastery/icons.ts house search coffee ...
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const R = join(dirname(require.resolve("lucide-react/package.json")), "dist/esm/icons/");
const names = process.argv.slice(3);
const n = (v) => Number(v);
function toD([tag, a]) {
  switch (tag) {
    case "path": return a.d;
    case "circle": { const [cx, cy, r] = [n(a.cx), n(a.cy), n(a.r)]; return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`; }
    case "ellipse": { const [cx, cy, rx, ry] = [n(a.cx), n(a.cy), n(a.rx), n(a.ry)]; return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0`; }
    case "line": return `M${a.x1} ${a.y1}L${a.x2} ${a.y2}`;
    case "polyline": case "polygon": { const p = a.points.trim().split(/[\s,]+/); let d = `M${p[0]} ${p[1]}`; for (let i = 2; i < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`; return tag === "polygon" ? d + "Z" : d; }
    case "rect": {
      const [x, y, w, h] = [n(a.x ?? 0), n(a.y ?? 0), n(a.width), n(a.height)]; const r = Math.min(n(a.rx ?? a.ry ?? 0), w / 2, h / 2);
      if (!r) return `M${x} ${y}h${w}v${h}h${-w}Z`;
      return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
    }
    default: throw new Error("unsupported " + tag);
  }
}
const out = {};
for (const name of names) {
  let file = name; let mod = await import(R + file + ".mjs");
  while (!mod.__iconData) { const src = (await import("node:fs")).readFileSync(R + file + ".mjs", "utf8"); file = /from .\.\/([^.]+)\.mjs/.exec(src)[1]; mod = await import(R + file + ".mjs"); }
  const { __iconData } = mod;
  out[name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = __iconData.node.map(toD).map((d) => d.trim().replace(/^m/, "M0 0 m")).join(" ");
}
const body = Object.entries(out).map(([k, d]) => `  ${k}: ${JSON.stringify(d)},`).join("\n");
writeFileSync(process.argv[2], `// Icon outlines from Lucide (https://lucide.dev, ISC license), flattened to one SVG
// path per icon for <Path viewBox="0 0 24 24">. Draw them with <Icon> from
// ./components.tsx; stroke them, never fill.
export const ICONS = {\n${body}\n};\n\nexport type IconName = keyof typeof ICONS;\n`);
console.log(Object.keys(out).length, "icons");
