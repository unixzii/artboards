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
  /** Where the reviewer clicked, in artboard coordinates. */
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
