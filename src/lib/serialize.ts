// Builds the payload the viewer draws from: laid-out trees, diagnostics,
// the font files they need, and review comments matched to current layers.

import { readComments, resolveComment } from "./comments.ts";
import { createTextEngine } from "./engine.ts";
import { analyzeFile } from "./lint.ts";
import type { ResolvedComment, ScenePayload, SerializedNode } from "./shared/protocol.ts";
import { layerChildren, textContentOf, type SceneNode } from "./shared/scene.ts";

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
