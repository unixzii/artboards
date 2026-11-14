// Dev server for human review. The DSL runs, lays out and lints here; the
// browser only paints the result and sends back review comments.

import { createReadStream, existsSync, watch } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { addComment, commentsPath, updateComment } from "./comments.ts";
import { canvasKitDir } from "./engine.ts";
import { fontDir } from "./fonts.ts";
import { buildScene, type ScenePayload } from "./serialize.ts";

const viewerDir = fileURLToPath(new URL("../viewer/", import.meta.url));

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
};

async function bundleViewer(): Promise<string> {
  const result = await build({
    entryPoints: [join(viewerDir, "main.ts")],
    bundle: true,
    format: "esm",
    target: "es2022",
    write: false,
    sourcemap: "inline",
    logLevel: "silent",
  });
  return result.outputFiles[0].text;
}

function send(res: ServerResponse, status: number, body: string | object, type = "text/plain; charset=utf-8") {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "content-type": typeof body === "string" ? type : "application/json", "cache-control": "no-store" });
  res.end(text);
}

function sendFile(res: ServerResponse, path: string, immutable = false) {
  if (!existsSync(path)) return send(res, 404, "not found");
  const ext = path.slice(path.lastIndexOf("."));
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
  const client = await bundleViewer();
  const streams = new Set<ServerResponse>();
  let scene: ScenePayload | undefined;
  let building: Promise<void> | undefined;
  let stale = false;

  // One build at a time; a change during a build triggers exactly one more.
  const rebuild = (): Promise<void> => {
    if (building) {
      stale = true;
      return building;
    }
    building = (async () => {
      do {
        stale = false;
        try {
          scene = { ...(await buildScene(file)), file: relative(process.cwd(), file) };
        } catch (e) {
          console.error("build failed:", e);
        }
      } while (stale);
      building = undefined;
      const data = `event: scene\ndata: ${JSON.stringify(scene)}\n\n`;
      for (const s of streams) s.write(data);
    })();
    return building;
  };
  await rebuild();

  // Rebuild on any source change next to the entry file (imports are relative).
  let timer: NodeJS.Timeout | undefined;
  const comments = basename(commentsPath(file));
  watch(dirname(file), { recursive: true }, (_event, name) => {
    if (!name || name.includes("node_modules")) return;
    if (!/\.(jsx|tsx|ts|js)$/.test(name) && basename(name) !== comments) return;
    clearTimeout(timer);
    timer = setTimeout(rebuild, 60);
  });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = decodeURIComponent(url.pathname);
    try {
      if (req.method === "GET") {
        if (path === "/") return sendFile(res, join(viewerDir, "index.html"));
        if (path === "/style.css") return sendFile(res, join(viewerDir, "style.css"));
        if (path === "/client.js") return send(res, 200, client, TYPES[".js"]);
        if (path === "/api/scene") return send(res, 200, scene ?? {});
        if (path === "/api/events") {
          res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
          res.write(": connected\n\n");
          streams.add(res);
          req.on("close", () => streams.delete(res));
          return;
        }
        let m = /^\/canvaskit\/(canvaskit\.(?:js|wasm))$/.exec(path);
        if (m) return sendFile(res, join(canvasKitDir, m[1]), true);
        m = /^\/fonts\/([a-z0-9-]+)\/([a-z0-9-]+\.woff2)$/.exec(path);
        const dir = m && fontDir(m[1]);
        if (m && dir) return sendFile(res, join(dir, m[2]), true);
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
        await rebuild();
        return send(res, 200, comment);
      }
      const m = /^\/api\/comments\/(\d+)$/.exec(path);
      if (m && (req.method === "PATCH" || req.method === "DELETE")) {
        const body = req.method === "PATCH" ? await readJson(req) : {};
        const ok = updateComment(file, Number(m[1]), req.method === "DELETE" ? { remove: true } : { resolved: Boolean(body.resolved) });
        if (!ok) return send(res, 404, "no such comment");
        await rebuild();
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
