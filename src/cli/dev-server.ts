// Dev server for human review. Compiles the DSL for the browser, runs `tsc` in
// the background, serves fonts/WASM/imported assets, and persists review comments.

import { createReadStream, existsSync, watch } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { basename, dirname, join, relative, resolve } from "node:path";
import type { Diagnostic } from "../shared/diagnostics.ts";
import type { BuildPayload, Comment } from "../shared/protocol.ts";
import { assetPath } from "./assets.ts";
import { bundleDesign } from "./bundler.ts";
import { addComment, commentsPath, readComments, updateComment } from "./comments-store.ts";
import { distFile } from "./dist.ts";
import { fontDir } from "./fonts.ts";
import { canvasKitDir, taffyWasmPath } from "./skia.ts";
import { typecheck } from "./typecheck.ts";


const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function send(res: ServerResponse, status: number, body: string | object, type = "text/plain; charset=utf-8") {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "content-type": typeof body === "string" ? type : "application/json", "cache-control": "no-store" });
  res.end(text);
}

function sendFile(res: ServerResponse, path: string, immutable = false) {
  if (!existsSync(path)) return send(res, 404, "not found");
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  res.writeHead(200, {
    "content-type": TYPES[ext] ?? "application/octet-stream",
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-store",
  });
  createReadStream(path).pipe(res);
}

async function readJson(req: IncomingMessage): Promise<any> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

export interface DevServerOptions {
  file: string;
  port: number;
  host: string;
}

export async function startDevServer({ file, port, host }: DevServerOptions): Promise<string> {
  file = resolve(file);
  const relFile = relative(process.cwd(), file);
  // The viewer is built ahead of time into dist/viewer/; fail at startup if it is missing.
  const viewer = { "/": distFile("viewer/index.html"), "/style.css": distFile("viewer/style.css"), "/client.js": distFile("viewer/client.js") };

  const streams = new Set<ServerResponse>();
  const broadcast = (event: string, payload: unknown) => {
    const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const s of streams) s.write(data);
  };

  let version: number | null = null;
  let seq = 0;
  let designCode = "";
  let buildErrors: Diagnostic[] = [];
  let typeErrors: Diagnostic[] = [];
  let comments: Comment[] = readComments(file);

  const currentPayload = (): BuildPayload => ({
    file: relFile,
    version,
    buildErrors,
    typeErrors,
    comments,
  });

  // Coalesced background `tsc`: never blocks serving the updated bundle.
  let checking: Promise<void> | undefined;
  let checkStale = false;
  const runTypecheck = () => {
    if (checking) {
      checkStale = true;
      return;
    }
    checking = (async () => {
      do {
        checkStale = false;
        try {
          typeErrors = await typecheck(file);
        } catch (e) {
          console.error("typecheck failed:", e);
        }
      } while (checkStale);
      checking = undefined;
      broadcast("typecheck", typeErrors);
    })();
  };

  // Coalesced esbuild bundle: fast (~10ms), immediately notifies connected viewers.
  let building: Promise<void> | undefined;
  let buildStale = false;
  const rebuild = (): Promise<void> => {
    if (building) {
      buildStale = true;
      return building;
    }
    building = (async () => {
      do {
        buildStale = false;
        const out = await bundleDesign(file);
        if (out.code !== undefined) {
          designCode = out.code;
          version = ++seq;
          buildErrors = [];
        } else {
          version = null;
          buildErrors = out.errors;
        }
        comments = readComments(file);
      } while (buildStale);
      building = undefined;
      broadcast("build", currentPayload());
      runTypecheck();
    })();
    return building;
  };
  await rebuild();

  const refreshComments = () => {
    comments = readComments(file);
    broadcast("comments", comments);
  };

  // Rebuild on source/asset changes next to the entry file; reload comments on `.comments.json` changes.
  let timer: NodeJS.Timeout | undefined;
  let pendingCommentsOnly = true;
  const commentsFile = basename(commentsPath(file));
  watch(dirname(file), { recursive: true }, (_event, name) => {
    if (!name || name.includes("node_modules")) return;
    const isComments = basename(name) === commentsFile;
    const isSource = /\.(jsx|tsx|ts|js|png|jpe?g|webp|gif|woff2|ttf|otf)$/i.test(name);
    if (!isComments && !isSource) return;
    if (isSource) pendingCommentsOnly = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const onlyComments = pendingCommentsOnly;
      pendingCommentsOnly = true;
      if (onlyComments) refreshComments();
      else void rebuild();
    }, 60);
  });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = decodeURIComponent(url.pathname);
    try {
      if (req.method === "GET") {
        if (Object.hasOwn(viewer, path)) return sendFile(res, viewer[path as keyof typeof viewer]);
        if (path === "/design.js") {
          return version !== null ? send(res, 200, designCode, TYPES[".js"]) : send(res, 404, "no valid build");
        }
        if (path === "/api/build") return send(res, 200, currentPayload());
        if (path === "/api/events") {
          res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
          res.write(": connected\n\n");
          streams.add(res);
          req.on("close", () => streams.delete(res));
          return;
        }
        let m = /^\/canvaskit\/(canvaskit\.(?:js|wasm))$/.exec(path);
        if (m) return sendFile(res, join(canvasKitDir, m[1]), true);
        if (path === "/taffy/taffy_wasm_bg.wasm") return sendFile(res, taffyWasmPath, true);
        m = /^\/fonts\/([a-z0-9-]+)\/([a-z0-9-]+\.woff2)$/.exec(path);
        const dir = m && fontDir(m[1]);
        if (m && dir) return sendFile(res, join(dir, m[2]), true);
        // Only files the current design imported are registered, so only those are served.
        m = /^\/assets\/([0-9a-f]{16})$/.exec(path);
        const asset = m && assetPath(m[1]);
        if (asset) return sendFile(res, asset, true);
        return send(res, 404, "not found");
      }

      // Writes: JSON only and same-origin only, so another site open in the
      // browser cannot post comments into the project.
      const origin = req.headers.origin;
      if (!/^application\/json\b/.test(req.headers["content-type"] ?? "") || (origin && new URL(origin).host !== req.headers.host)) {
        return send(res, 403, "forbidden");
      }
      if (req.method === "POST" && path === "/api/comments") {
        const body = await readJson(req);
        if (!body.text?.trim()) return send(res, 400, "text is required");
        const comment = addComment(file, body);
        refreshComments();
        return send(res, 200, comment);
      }
      const m = /^\/api\/comments\/(\d+)$/.exec(path);
      if (m && (req.method === "PATCH" || req.method === "DELETE")) {
        const body = req.method === "PATCH" ? await readJson(req) : {};
        const ok = updateComment(file, Number(m[1]), req.method === "DELETE" ? { remove: true } : { resolved: Boolean(body.resolved) });
        if (!ok) return send(res, 404, "no such comment");
        refreshComments();
        return send(res, 200, { ok: true });
      }
      send(res, 404, "not found");
    } catch (e) {
      send(res, 500, String(e instanceof Error ? e.message : e));
    }
  });

  await new Promise<void>((done, fail) => {
    server.once("error", fail);
    server.listen(port, host, done);
  });
  return `http://${host === "0.0.0.0" ? "localhost" : host}:${port}/`;
}
