// Data that crosses between the dev server and the viewer. Types only, so
// both sides can import it without pulling in each other's code.

import type { Box } from "./scene.ts";

export interface Diagnostic {
  severity: "error" | "warning";
  rule: string;
  message: string;
  /** "file:line" of the layer or statement the problem is about. */
  source?: string;
  /** Artboard name. */
  frame?: string;
  /** Layer path within the artboard (see nodePath), when the problem is on a layer. */
  node?: string;
}

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

export interface FontFace {
  family: string;
  /** Path under the dev server's /fonts/ route: "<pack>/<file>". */
  path: string;
}

export interface SerializedNode {
  type: string;
  /** Props as written, minus children. For Text, `children` is the text. */
  props: Record<string, any>;
  layout: Box;
  fontFamilies?: string[];
  children: SerializedNode[];
}

export interface FramePayload {
  name: string;
  /** Null when the artboard failed to build; see `error`. */
  root: SerializedNode | null;
  error?: Diagnostic;
}

/** Everything the viewer needs to draw and inspect one design file. */
export interface ScenePayload {
  file: string;
  frames: FramePayload[];
  diagnostics: Diagnostic[];
  fonts: FontFace[];
  comments: ResolvedComment[];
}
