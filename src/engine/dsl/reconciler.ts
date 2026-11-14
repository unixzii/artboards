// React host config that builds the scene tree. Mutation mode, synchronous.

import { isValidElement, type ReactNode } from "react";
import Reconciler from "react-reconciler";
import { DefaultEventPriority } from "react-reconciler/constants.js";
import { COMPONENT_TYPE, createNode, layerChildren, type ComponentInfo, type SceneNode } from "../../shared/scene.ts";
import { componentSourceOf } from "./jsx-runtime.ts";
import { DslError, validateProps } from "./schema.ts";

const INTERNAL_PROPS = new Set(["key", "ref", "$source"]);

function elementTagName(el: any): string {
  const t = el.type;
  if (typeof t === "string") return t;
  if (typeof t === "function") return t.displayName || t.name || "Component";
  if (t && typeof t === "object") return t.displayName || t.type?.displayName || t.type?.name || t.render?.name || "Component";
  return "Fragment";
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "function") return `[Function${value.name ? ` ${value.name}` : ""}]`;
  if (isValidElement(value)) return `<${elementTagName(value)}>`;
  if (depth >= 3) return String(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = sanitizeValue(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

function sanitizeComponentProps(raw: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (INTERNAL_PROPS.has(key) || value === undefined) continue;
    if (key === "children") {
      // Keep plain text children (e.g. `<Button>Sign in</Button>`); omit element
      // children because they already appear as child nodes in the layer tree.
      if (typeof value === "string" || typeof value === "number") {
        out.children = String(value);
      } else if (Array.isArray(value) && value.every((v) => typeof v === "string" || typeof v === "number")) {
        out.children = value.join("");
      }
      continue;
    }
    out[key] = sanitizeValue(value);
  }
  return out;
}

function fiberComponentName(fiber: any): string | null {
  const t = fiber.type;
  if (typeof t === "function") return t.displayName || t.name || "Anonymous";
  // ForwardRef (tag 11) has `{ render }`; MemoComponent (tag 14) wraps an inner function fiber so skip outer wrapper to avoid duplicates.
  if (fiber.tag === 11 && t && typeof t === "object") return t.displayName || t.render?.displayName || t.render?.name || "ForwardRef";
  return null;
}

const fiberInstances = new WeakMap<object, ComponentInfo>();

function componentInfoForFiber(fiber: any, name: string): ComponentInfo {
  const propsObj = fiber.memoizedProps ?? fiber.pendingProps;
  let info = fiberInstances.get(fiber);
  const nextProps = sanitizeComponentProps(propsObj);
  const source = componentSourceOf(propsObj) ?? (fiber.alternate ? componentSourceOf(fiber.alternate.memoizedProps) : undefined);
  if (!info) {
    info = { name, props: nextProps, source };
    if (fiber.alternate) fiberInstances.set(fiber.alternate, info);
    fiberInstances.set(fiber, info);
  } else {
    info.props = nextProps;
    if (source) info.source = source;
  }
  return info;
}

/** Extracts the outermost-to-innermost sub-component chain enclosing a host Fiber. */
function captureComponentStack(hostFiber: any): ComponentInfo[] | undefined {
  const stack: ComponentInfo[] = [];
  for (let f = hostFiber?.return; f; f = f.return) {
    // Skip the top-level artboard component itself (its parent is HostRoot, tag === 3,
    // or a MemoComponent whose parent is HostRoot).
    const isArtboardRoot = !f.return || f.return.tag === 3 || (f.return.tag === 14 && (!f.return.return || f.return.return.tag === 3));
    if (isArtboardRoot) continue;
    const name = fiberComponentName(f);
    if (name) stack.push(componentInfoForFiber(f, name));
  }
  return stack.length > 0 ? stack.reverse() : undefined;
}

function append(parent: SceneNode, child: SceneNode) {
  detach(child);
  child.parent = parent;
  parent.children.push(child);
}

function insertBefore(parent: SceneNode, child: SceneNode, before: SceneNode) {
  detach(child);
  child.parent = parent;
  parent.children.splice(parent.children.indexOf(before), 0, child);
}

function detach(child: SceneNode) {
  const p = child.parent;
  if (!p) return;
  const i = p.children.indexOf(child);
  if (i >= 0) p.children.splice(i, 1);
  child.parent = null;
}

let currentPriority = 0;

const hostConfig: any = {
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  isPrimaryRenderer: true,

  createInstance(type: string, props: Record<string, any>, _root: SceneNode, _ctx: unknown, fiber: any) {
    validateProps(type, props);
    const node = createNode(type, props);
    node.componentStack = captureComponentStack(fiber);
    return node;
  },
  createTextInstance(text: string, _root: SceneNode, hostContext: { inText: boolean; source?: string }) {
    if (!hostContext.inText) {
      if (text.trim() === "") return createNode("#text", {});
      throw new DslError(`Text "${text.trim().slice(0, 40)}" must be wrapped in <Text>`, hostContext.source);
    }
    const node = createNode("#text", {});
    node.text = text;
    return node;
  },
  shouldSetTextContent(type: string, props: Record<string, any>) {
    return type === "Text" && (typeof props.children === "string" || typeof props.children === "number");
  },

  getRootHostContext: () => ({ inText: false }),
  getChildHostContext: (_parent: unknown, type: string, _root: unknown) => ({ inText: type === "Text" }),
  getPublicInstance: (instance: SceneNode) => instance,

  appendInitialChild: append,
  appendChild: append,
  appendChildToContainer: append,
  insertBefore,
  insertInContainerBefore: insertBefore,
  removeChild: (_parent: SceneNode, child: SceneNode) => detach(child),
  removeChildFromContainer: (_parent: SceneNode, child: SceneNode) => detach(child),
  clearContainer(root: SceneNode) {
    for (const c of root.children) c.parent = null;
    root.children.length = 0;
  },

  finalizeInitialChildren: () => false,
  commitUpdate(instance: SceneNode, type: string, _old: unknown, next: Record<string, any>, fiber: any) {
    validateProps(type, next);
    instance.props = next;
    instance.componentStack = captureComponentStack(fiber);
  },
  commitTextUpdate(instance: SceneNode, _old: string, next: string) {
    instance.text = next;
  },
  resetTextContent() {},

  prepareForCommit: () => null,
  resetAfterCommit() {},
  preparePortalMount() {},
  detachDeletedInstance() {},
  getInstanceFromNode: () => null,
  beforeActiveInstanceBlur() {},
  afterActiveInstanceBlur() {},
  prepareScopeUpdate() {},
  getInstanceFromScope: () => null,

  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1,
  scheduleMicrotask: queueMicrotask,
  supportsMicrotasks: true,

  setCurrentUpdatePriority(p: number) {
    currentPriority = p;
  },
  getCurrentUpdatePriority: () => currentPriority,
  resolveUpdatePriority: () => currentPriority || DefaultEventPriority,
  shouldAttemptEagerTransition: () => false,
  trackSchedulerEvent() {},
  resolveEventType: () => null,
  resolveEventTimeStamp: () => -1.1,
  requestPostPaintCallback() {},

  maySuspendCommit: () => false,
  preloadInstance: () => true,
  startSuspendingCommit() {},
  suspendInstance() {},
  waitForCommitToBeReady: () => null,
  NotPendingTransition: null,
  HostTransitionContext: { $$typeof: Symbol.for("react.context"), _currentValue: null, _currentValue2: null },
  resetFormInstance() {},
};

const reconciler = Reconciler(hostConfig);

export interface SceneRoot {
  root: SceneNode;
  render(element: ReactNode): void;
  unmount(): void;
}

export function createSceneRoot(): SceneRoot {
  const root = createNode("#root", {});
  let error: unknown;
  const onError = (e: unknown) => {
    error ??= e;
  };
  const container = (reconciler as any).createContainer(
    root,
    1, // ConcurrentRoot
    null,
    false,
    null,
    "",
    onError,
    onError,
    onError,
    () => {},
    null,
  );
  const update = (element: ReactNode) => {
    error = undefined;
    (reconciler as any).updateContainerSync(element, container, null, null);
    (reconciler as any).flushSyncWork();
    if (error) throw error;
  };
  return { root, render: update, unmount: () => update(null) };
}

function groupChildren(nodes: SceneNode[], depth: number, parent: SceneNode): SceneNode[] {
  const out: SceneNode[] = [];
  for (let i = 0; i < nodes.length; ) {
    const comp = nodes[i].componentStack?.[depth];
    if (!comp) {
      const node = nodes[i++];
      node.parent = parent;
      if (node.type !== "Text") {
        node.children = groupChildren(layerChildren(node), depth, node);
      }
      out.push(node);
      continue;
    }

    const run: SceneNode[] = [nodes[i++]];
    while (i < nodes.length && nodes[i].componentStack?.[depth] === comp) {
      run.push(nodes[i++]);
    }

    const x0 = Math.min(...run.map((c) => c.layout.x));
    const y0 = Math.min(...run.map((c) => c.layout.y));
    const x1 = Math.max(...run.map((c) => c.layout.x + c.layout.width));
    const y1 = Math.max(...run.map((c) => c.layout.y + c.layout.height));
    for (const c of run) {
      c.layout = { x: c.layout.x - x0, y: c.layout.y - y0, width: c.layout.width, height: c.layout.height };
    }

    const wrapper = createNode(COMPONENT_TYPE, comp.source ? { $source: comp.source } : {});
    wrapper.component = { name: comp.name, props: comp.props, source: comp.source };
    wrapper.layout = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    wrapper.parent = parent;
    wrapper.children = groupChildren(run, depth + 1, wrapper);
    out.push(wrapper);
  }
  return out;
}

/**
 * Materializes virtual `#component` nodes from the recorded Fiber stacks on a
 * laid-out (or freshly reconciled) artboard root, rebasing child coordinates.
 */
export function groupComponents(root: SceneNode) {
  if (root.type === "Text") return;
  root.children = groupChildren(layerChildren(root), 0, root);
}
