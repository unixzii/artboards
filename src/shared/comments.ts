// Comment types and pure scene-tree matching shared by the CLI and the viewer.

import { formatPropsSummary, layerHint, nodeAtPath, nodePath, sourceOf, textContentOf, walk, type SceneNode } from "./scene.ts";

export interface Comment {
  id: number;
  /** Artboard name. */
  frame: string;
  /** Layer path at the time of writing (see nodePath). */
  path: string;
  /** Layer type at the time of writing; used to notice the anchor has moved. */
  nodeType: string;
  /** The layer's text (for Text) or name when written; lets the comment follow a layer that moved. */
  hint?: string;
  /** Where the reviewer clicked, in the layer's own coordinates (before rotation and scrolling). */
  point: { x: number; y: number };
  text: string;
  createdAt: string;
  resolved: boolean;
}

/** What the viewer sends to create a comment. */
export type NewComment = Pick<Comment, "frame" | "path" | "nodeType" | "hint" | "point" | "text">;

/** A comment matched against the current tree of its artboard. */
export interface ResolvedComment extends Comment {
  /** False when the layer it was attached to is gone or is now a different type. */
  attached: boolean;
  /** Current source line of the layer, when attached. */
  source?: string;
  /** Short description of the layer, e.g. `<Text "Overview">`. */
  target?: string;
}

/** Builds a stored comment from what the viewer sent, numbered after the existing ones. */
export function createComment(input: NewComment, existing: readonly Comment[]): Comment {
  return {
    id: nextId(existing),
    frame: String(input.frame),
    path: String(input.path),
    nodeType: String(input.nodeType),
    hint: input.hint ? String(input.hint) : undefined,
    point: { x: Math.round(Number(input.point?.x) || 0), y: Math.round(Number(input.point?.y) || 0) },
    text: String(input.text).trim(),
    createdAt: new Date().toISOString(),
    resolved: false,
  };
}

const nextId = (comments: readonly Comment[]) => comments.reduce((max, c) => Math.max(max, c.id), 0) + 1;

/** Whether two comments are copies of one: ids differ between copies, so match on when and what was written. */
export const sameComment = (a: Comment, b: Comment) => a.createdAt === b.createdAt && a.frame === b.frame && a.text === b.text;

/** `into` plus the comments of `incoming` it does not have yet, renumbered after its own. */
export function appendNew(into: readonly Comment[], incoming: readonly Comment[]): Comment[] {
  const out = [...into];
  for (const c of incoming) {
    if (!out.some((o) => sameComment(o, c))) out.push({ ...c, id: nextId(out) });
  }
  return out;
}

export function describeNode(n: SceneNode): string {
  if (n.component) {
    const summary = formatPropsSummary(n.component.props);
    return `<${n.component.name}${summary ? ` ${summary}` : ""}>`;
  }
  const detail = n.type === "Text" ? textContentOf(n).slice(0, 32) : n.props.name;
  return `<${n.type}${detail ? ` ${JSON.stringify(detail)}` : ""}>`;
}

/**
 * Matches a comment against the current tree of its artboard.
 * The stored path wins when the layer there still looks the same; otherwise a
 * single layer with the same type and hint is taken to be the one that moved.
 */
export function resolveComment(comment: Comment, root: SceneNode | undefined): ResolvedComment {
  if (!root) return { ...comment, attached: false };
  const same = (n: SceneNode) => n.type === comment.nodeType && (!comment.hint || layerHint(n) === comment.hint);
  let node = nodeAtPath(root, comment.path);
  if (!node || !same(node)) {
    const candidates: SceneNode[] = [];
    if (comment.hint) walk(root, (n) => same(n) && candidates.push(n));
    node = candidates.length === 1 ? candidates[0] : undefined;
  }
  if (!node) return { ...comment, attached: false };
  return { ...comment, path: nodePath(node), attached: true, source: sourceOf(node), target: describeNode(node) };
}
