// Review comments left in the viewer. Stored next to the design file as
// `<name>.comments.json` so the agent can read them with `artboards comments`.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolveComment, type Comment, type NewComment, type ResolvedComment } from "../shared/comments.ts";
import { extractFrames, reconcileFrame } from "../shared/dsl/frame.ts";
import { groupComponents } from "../shared/dsl/reconciler.ts";
import { loadDesign } from "./bundler.ts";

export const commentsPath = (file: string) => file.replace(/\.[^./\\]+$/, "") + ".comments.json";

export function readComments(file: string): Comment[] {
  const path = commentsPath(file);
  if (!existsSync(path)) return [];
  const data = JSON.parse(readFileSync(path, "utf8"));
  return Array.isArray(data) ? data : [];
}

function writeComments(file: string, comments: Comment[]) {
  writeFileSync(commentsPath(file), JSON.stringify(comments, null, 2) + "\n");
}

export function addComment(file: string, input: NewComment): Comment {
  const comments = readComments(file);
  const comment: Comment = {
    id: comments.reduce((max, c) => Math.max(max, c.id), 0) + 1,
    frame: String(input.frame),
    path: String(input.path),
    nodeType: String(input.nodeType),
    hint: input.hint ? String(input.hint) : undefined,
    point: { x: Math.round(Number(input.point?.x) || 0), y: Math.round(Number(input.point?.y) || 0) },
    text: String(input.text).trim(),
    createdAt: new Date().toISOString(),
    resolved: false,
  };
  writeComments(file, [...comments, comment]);
  return comment;
}

/** Returns false when no comment has that id. */
export function updateComment(file: string, id: number, change: { resolved?: boolean; remove?: boolean }): boolean {
  const comments = readComments(file);
  const hit = comments.find((c) => c.id === id);
  if (!hit) return false;
  if (change.resolved !== undefined) hit.resolved = change.resolved;
  writeComments(file, change.remove ? comments.filter((c) => c !== hit) : comments);
  return true;
}

/** Matches stored comments against reconciled artboard trees without running layout or WASM. */
export async function resolveFileComments(file: string): Promise<ResolvedComment[]> {
  const pending = readComments(file);
  if (pending.length === 0) return [];

  let entries;
  try {
    const { exports, exportOrder } = await loadDesign(file);
    entries = new Map(extractFrames(exports, exportOrder).map((f) => [f.name, f]));
  } catch {
    return pending.map((c) => resolveComment(c, undefined));
  }

  const byFrame = new Map<string, Comment[]>();
  for (const c of pending) {
    const list = byFrame.get(c.frame) ?? [];
    list.push(c);
    byFrame.set(c.frame, list);
  }

  const resolved: ResolvedComment[] = [];
  for (const [name, list] of byFrame) {
    const entry = entries.get(name);
    if (!entry) {
      for (const c of list) resolved.push(resolveComment(c, undefined));
      continue;
    }
    try {
      const { host, unmount } = reconcileFrame(entry);
      const root = groupComponents(host);
      for (const c of list) resolved.push(resolveComment(c, root));
      unmount();
    } catch {
      for (const c of list) resolved.push(resolveComment(c, undefined));
    }
  }
  return resolved.sort((a, b) => a.id - b.id);
}
