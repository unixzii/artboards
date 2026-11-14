// Builds the payload the viewer draws from: laid-out trees, diagnostics,
// the font files they need, and review comments matched to current layers.

import { analyzeFile } from "../engine/pipeline.ts";
import { createEngine } from "../engine/skia.ts";
import type { AssetEntry, ResolvedComment, ScenePayload, SerializedNode } from "../shared/protocol.ts";
import { layerChildren, textContentOf, textRunsOf, walk, type SceneNode } from "../shared/scene.ts";
import { readComments, resolveComment } from "./comments.ts";

function serialize(n: SceneNode): SerializedNode {
  const { children: _children, ...props } = n.props;
  if (n.type === "Text") props.children = textContentOf(n);
  return {
    type: n.type,
    props,
    layout: n.layout,
    ...(n.component ? { component: n.component } : {}),
    ...(n.type === "Text" ? { fontFamilies: n.fontFamilies, runs: textRunsOf(n) } : {}),
    children: n.type === "Text" ? [] : layerChildren(n).map(serialize),
  };
}

export async function buildScene(file: string): Promise<ScenePayload> {
  const pending = readComments(file);
  const comments: ResolvedComment[] = [];
  const roots = new Map<string, SerializedNode>();
  const images = new Map<string, AssetEntry>();

  const analysis = await analyzeFile(file, (built) => {
    roots.set(built.name, serialize(built.root));
    walk(built.root, (n) => {
      const id = n.type === "Image" ? n.props.src?.id : undefined;
      if (id) images.set(id, { kind: "image", id, url: `/assets/${id}` });
    });
    // Comments are matched while the live tree still exists.
    for (const c of pending) if (c.frame === built.name) comments.push(resolveComment(c, built.root));
  });
  for (const c of pending) if (!roots.has(c.frame)) comments.push(resolveComment(c, undefined));
  comments.sort((a, b) => a.id - b.id);

  const engine = await createEngine();
  return {
    file,
    frames: analysis.frames.map((f) => ({ name: f.name, root: roots.get(f.name) ?? null, error: f.error })),
    diagnostics: analysis.diagnostics,
    assets: [...[...engine.fonts.faces.values()].map((f): AssetEntry => ({ kind: "font", ...f })), ...images.values()],
    comments,
  };
}
