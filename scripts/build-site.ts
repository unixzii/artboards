// Builds the Artboards website into out/site: examples/artboards/site.tsx as
// a static site (`artboards build`), plus the images a link preview and a
// browser tab need, rendered from the design, the <head> tags that point at
// them, and robots.txt and sitemap.xml for crawlers. Build the package first (`npm run build`); `npm run build:site`
// does both, and is what Vercel runs (vercel.json).
//
// Link previews need absolute image URLs. The site's address comes from
// SITE_URL, or on Vercel from the production domain it provides; without
// either, the tags use relative paths, which is fine for a local preview.

import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const cli = join(root, "dist/cli.js");
const out = join(root, "out/site");

const TITLE = "Artboards: design UI as code, with your agents";
const DESCRIPTION = "A harness-agnostic UI design tool built for coding agents.";
const OG_ALT = "Artboards, selected on a design canvas with an agent's cursor on it.";

const siteUrl = (
  process.env.SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")
).replace(/\/+$/, "");
const url = (path: string) => (siteUrl ? `${siteUrl}/${path}` : path);

function artboards(...args: string[]) {
  const run = spawnSync(process.execPath, [cli, ...args], { cwd: root, stdio: "inherit" });
  if (run.status !== 0) process.exit(run.status ?? 1);
}

// `artboards build` only replaces a directory holding an earlier build; start clean.
rmSync(out, { recursive: true, force: true });
artboards("build", "examples/artboards/site.tsx", "-o", "out/site");
artboards("render", "examples/artboards/index.tsx", "-f", "OpenGraph", "-s", "1.5", "-o", "out/site/og.png"); // 1200×630
artboards("render", "examples/artboards/index.tsx", "-f", "Icon", "--transparent", "-s", "0.5", "-o", "out/site/icon.png"); // 32×32
artboards("render", "examples/artboards/index.tsx", "-f", "Icon", "--variant", "Shape=Square", "-s", "2.8125", "-o", "out/site/apple-touch-icon.png"); // 180×180
// For clients that ask for /favicon.ico whatever the page links.
writeFileSync(join(out, "favicon.ico"), icoFromPng(readFileSync(join(out, "icon.png")), 32));

const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
const meta = [
  `<meta name="description" content="${escape(DESCRIPTION)}" />`,
  `<meta name="theme-color" content="#fafafa" />`,
  `<link rel="icon" type="image/png" sizes="32x32" href="icon.png" />`,
  `<link rel="apple-touch-icon" href="apple-touch-icon.png" />`,
  ...(siteUrl ? [`<link rel="canonical" href="${siteUrl}/" />`, `<meta property="og:url" content="${siteUrl}/" />`] : []),
  `<meta property="og:type" content="website" />`,
  `<meta property="og:site_name" content="Artboards" />`,
  `<meta property="og:title" content="${escape(TITLE)}" />`,
  `<meta property="og:description" content="${escape(DESCRIPTION)}" />`,
  `<meta property="og:image" content="${url("og.png")}" />`,
  `<meta property="og:image:width" content="1200" />`,
  `<meta property="og:image:height" content="630" />`,
  `<meta property="og:image:alt" content="${escape(OG_ALT)}" />`,
  `<meta name="twitter:card" content="summary_large_image" />`,
  `<meta name="twitter:title" content="${escape(TITLE)}" />`,
  `<meta name="twitter:description" content="${escape(DESCRIPTION)}" />`,
  `<meta name="twitter:image" content="${url("og.png")}" />`,
  `<meta name="twitter:image:alt" content="${escape(OG_ALT)}" />`,
];

const indexPath = join(out, "index.html");
const html = readFileSync(indexPath, "utf8");
if (!html.includes("<title>Artboards</title>")) throw new Error("build-site: the viewer's <title> changed; update scripts/build-site.ts.");
writeFileSync(indexPath, html.replace("<title>Artboards</title>", [`<title>${escape(TITLE)}</title>`, ...meta].join("\n    ")));

// A sitemap needs absolute URLs, so it is only written when the address is known.
writeFileSync(join(out, "robots.txt"), ["User-agent: *", "Allow: /", ...(siteUrl ? [`Sitemap: ${siteUrl}/sitemap.xml`] : [])].join("\n") + "\n");
if (siteUrl) {
  writeFileSync(
    join(out, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${siteUrl}/</loc></url>\n</urlset>\n`,
  );
}

/** An .ico holding one square PNG image, which every current browser reads. */
function icoFromPng(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  header.writeUInt8(size % 256, 6); // width (0 means 256)
  header.writeUInt8(size % 256, 7); // height
  header.writeUInt8(0, 8); // no palette
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(png.length, 14); // image size
  header.writeUInt32LE(header.length, 18); // image offset
  return Buffer.concat([header, png]);
}

console.log(`Website in out/site/${siteUrl ? ` for ${siteUrl}` : " (relative image URLs; set SITE_URL for absolute ones)"}`);
