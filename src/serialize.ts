// Builds the payload the viewer draws from: laid-out trees, diagnostics,
// the font files they need, and review comments matched to current layers.

import { readComments, resolveComment, type ResolvedComment } from "./comments.ts";
import { createTextEngine } from "./engine.ts";
import type { FontFace } from "./fonts.ts";
import { analyzeFile, type Diagnostic } from "./lint.ts";
import { layerChildren, textContentOf, type Box, type SceneNode } from "./scene.ts";

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

export interface ScenePayload {
  file: string;
  frames: FramePayload[];
  diagnostics: Diagnostic[];
  fonts: FontFace[];
  comments: ResolvedComment[];
}

function serialize(n: SceneNode): SerializedNode {
  const { children: _children, ...props } = n.props;
  if (n.type === "Text") props.children = textContentOf(n);
  return {
    type: n.type,
    props,
    layout: n.layout,
    fontFamilies: n.fontFamilies,
    children: n.type === "Text" ? [] : layerChildren(n).map(serialize),
  };
}

export async function buildScene(file: string): Promise<ScenePayload> {
  const pending = readComments(file);
  const comments: ResolvedComment[] = [];
  const roots = new Map<string, SerializedNode>();

  const analysis = await analyzeFile(file, (built) => {
    roots.set(built.name, serialize(built.root));
    // Comments are matched while the live tree still exists.
    for (const c of pending) if (c.frame === built.name) comments.push(resolveComment(c, built.root));
  });
  for (const c of pending) if (!roots.has(c.frame)) comments.push(resolveComment(c, undefined));
  comments.sort((a, b) => a.id - b.id);

  const engine = await createTextEngine();
  return {
    file,
    frames: analysis.frames.map((f) => ({ name: f.name, root: roots.get(f.name) ?? null, error: f.error })),
    diagnostics: analysis.diagnostics,
    fonts: [...engine.fonts.faces.values()],
    comments,
  };
}
