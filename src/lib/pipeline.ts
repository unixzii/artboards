// File -> artboards -> laid-out scene trees. Shared by every CLI command.

import { createElement, type ComponentType } from "react";
import { layoutTree } from "./layout.ts";
import { loadModule } from "./dsl/loader.ts";
import { createSceneRoot } from "./dsl/reconciler.ts";
import type { SceneNode } from "./shared/scene.ts";
import { DslError } from "./dsl/schema.ts";
import { createTextEngine, type NodeEngine } from "./engine.ts";
import { releaseParagraphs } from "./shared/text.ts";

export interface FrameEntry {
  /** Component name, falling back to the export name. */
  name: string;
  component: ComponentType;
}

export interface BuiltFrame {
  name: string;
  root: SceneNode;
  engine: NodeEngine;
  dispose(): void;
}

/** Every exported component of the entry file is an artboard. */
export function listFrames(file: string): FrameEntry[] {
  const exports = loadModule(file);
  const seen = new Set<unknown>();
  const frames: FrameEntry[] = [];
  for (const [key, value] of Object.entries(exports)) {
    if (typeof value !== "function" || seen.has(value)) continue;
    seen.add(value);
    frames.push({ name: value.name && value.name !== "default" ? value.name : key, component: value as ComponentType });
  }
  return frames;
}

export function pickFrames(frames: FrameEntry[], name: string | undefined, file: string): FrameEntry[] {
  if (frames.length === 0) throw new DslError(`${file} exports no components. Export each artboard, e.g. \`export default function Home() {…}\`.`);
  if (!name) return frames;
  const hit = frames.filter((f) => f.name === name);
  if (hit.length === 0) throw new DslError(`No artboard named "${name}" in ${file}. Available: ${frames.map((f) => f.name).join(", ")}.`);
  return hit;
}

export async function buildFrame(frame: FrameEntry): Promise<BuiltFrame> {
  const scene = createSceneRoot();
  scene.render(createElement(frame.component));
  const roots = scene.root.children.filter((c) => c.type !== "#text");
  if (roots.length !== 1) {
    scene.unmount();
    throw new DslError(`Artboard ${frame.name} must return exactly one root element, got ${roots.length}.`);
  }
  const root = roots[0];
  const engine = await createTextEngine();
  await layoutTree(root, engine);
  return {
    name: frame.name,
    root,
    engine,
    dispose() {
      releaseParagraphs(root);
      scene.unmount();
    },
  };
}
