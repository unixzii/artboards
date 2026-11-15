// React host config that builds the scene tree. Mutation mode, synchronous.

import { isValidElement, type ReactNode } from "react";
import Reconciler from "react-reconciler";
import { DefaultEventPriority } from "react-reconciler/constants.js";
import { COMPONENT_TYPE, createNode, layerChildren, type Box, type ComponentInfo, type SceneNode } from "../scene.ts";
import { componentSourceOf } from "./jsx-runtime.ts";
import { DslError, validateProps } from "./schema.ts";
import { VariantContext } from "./variants.ts";

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
  if (typeof value === "function") return "[Function]";
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

/** Whether a fiber is the root, or the variant provider every artboard is wrapped in. */
function atTop(fiber: any): boolean {
  if (!fiber || fiber.tag === 3) return true; // HostRoot
  return fiber.type === VariantContext && atTop(fiber.return);
}

/** Extracts the outermost-to-innermost sub-component chain enclosing a host Fiber. */
function captureComponentStack(hostFiber: any): ComponentInfo[] | undefined {
  const stack: ComponentInfo[] = [];
  for (let f = hostFiber?.return; f; f = f.return) {
    // Skip the top-level artboard component itself (rendered directly under the
    // root, possibly through a MemoComponent).
    const isArtboardRoot = atTop(f.return) || (f.return.tag === 14 && atTop(f.return.return));
    if (isArtboardRoot) continue;
    const name = fiberComponentName(f);
    if (name) stack.push(componentInfoForFiber(f, name));
  }
  return stack.length > 0 ? stack.reverse() : undefined;
}

/** Drops cached Skia paragraph and runs on the enclosing <Text> when its content or style mutates. */
function invalidateText(node: SceneNode | null) {
  for (let n = node; n; n = n.parent) {
    if (n.type === "Text") {
      n.paragraph?.delete();
      n.paragraph = undefined;
      n.runs = undefined;
      n.fontFamilies = undefined;
      n.missingGlyphs = undefined;
      break;
    }
  }
}

function append(parent: SceneNode, child: SceneNode) {
  detach(child);
  child.parent = parent;
  parent.children.push(child);
  invalidateText(parent);
}

function insertBefore(parent: SceneNode, child: SceneNode, before: SceneNode) {
  detach(child);
  child.parent = parent;
  parent.children.splice(parent.children.indexOf(before), 0, child);
  invalidateText(parent);
}

function detach(child: SceneNode) {
  const p = child.parent;
  if (!p) return;
  invalidateText(p);
  const i = p.children.indexOf(child);
  if (i >= 0) p.children.splice(i, 1);
  child.parent = null;
}

interface HostContext {
  inText: boolean;
  inSpan: boolean;
  source?: string;
}

let currentPriority = 0;
const commitListeners = new WeakMap<SceneNode, () => void>();

const hostConfig: any = {
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  isPrimaryRenderer: true,

  createInstance(type: string, props: Record<string, any>, _root: SceneNode, ctx: HostContext, fiber: any) {
    if (type === "Span" && !ctx.inText) throw new DslError("<Span> must be inside a <Text>.", props.$source);
    if (type === "Span" && ctx.inSpan) throw new DslError("<Span> cannot contain another <Span>; put them side by side.", props.$source);
    if (ctx.inText && type !== "Span") {
      throw new DslError(`<Text> can only contain text and <Span>, not <${type}>. Put other elements next to the Text in a Row or Column.`, props.$source);
    }
    validateProps(type, props);
    const node = createNode(type, props);
    node.componentStack = captureComponentStack(fiber);
    return node;
  },
  createTextInstance(text: string, _root: SceneNode, hostContext: HostContext) {
    if (!hostContext.inText) {
      if (text.trim() === "") return createNode("#text", {});
      throw new DslError(`Text "${text.trim().slice(0, 40)}" must be wrapped in <Text>`, hostContext.source);
    }
    const node = createNode("#text", {});
    node.text = text;
    return node;
  },
  shouldSetTextContent(type: string, props: Record<string, any>) {
    return (type === "Text" || type === "Span") && (typeof props.children === "string" || typeof props.children === "number");
  },

  getRootHostContext: (): HostContext => ({ inText: false, inSpan: false }),
  getChildHostContext: (_parent: unknown, type: string, _root: unknown): HostContext => ({
    inText: type === "Text" || type === "Span",
    inSpan: type === "Span",
  }),
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
    invalidateText(instance);
  },
  commitTextUpdate(instance: SceneNode, _old: string, next: string) {
    instance.text = next;
    invalidateText(instance);
  },
  resetTextContent(instance: SceneNode) {
    invalidateText(instance);
  },

  prepareForCommit: () => null,
  resetAfterCommit(root: SceneNode) {
    commitListeners.get(root)?.();
  },
  preparePortalMount() {},
  detachDeletedInstance() {},
  getInstanceFromNode: () => null,
  beforeActiveInstanceBlur() {},
  afterActiveInstanceBlur() {},
  prepareScopeUpdate() {},
  getInstanceFromScope: () => null,

  scheduleTimeout: (globalThis as any).setTimeout,
  cancelTimeout: (globalThis as any).clearTimeout,
  noTimeout: -1,
  scheduleMicrotask: (globalThis as any).queueMicrotask,
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

export interface SceneRootOptions {
  /** Called when React commits an internal state/effect update outside `render()` / `unmount()`. */
  onCommit?: () => void;
  /** Called when an asynchronous React render throws outside synchronous `render()`. */
  onError?: (error: unknown) => void;
}

export function createSceneRoot(opts: SceneRootOptions = {}): SceneRoot {
  const root = createNode("#root", {});
  let error: unknown;
  let inSyncCall = false;
  const handleError = (e: unknown) => {
    if (inSyncCall) error ??= e;
    else opts.onError?.(e);
  };
  if (opts.onCommit) {
    commitListeners.set(root, () => {
      if (!inSyncCall) opts.onCommit!();
    });
  }
  const container = (reconciler as any).createContainer(
    root,
    1, // ConcurrentRoot
    null,
    false,
    null,
    "",
    handleError,
    handleError,
    handleError,
    () => {},
    null,
  );
  const update = (element: ReactNode) => {
    error = undefined;
    inSyncCall = true;
    try {
      (reconciler as any).updateContainerSync(element, container, null, null);
      (reconciler as any).flushSyncWork();
    } finally {
      inSyncCall = false;
    }
    if (error) throw error;
  };
  return {
    root,
    render: update,
    unmount: () => {
      commitListeners.delete(root);
      update(null);
    },
  };
}

// ------------------------------------------------------------------ layer tree
//
// React owns the host tree: it keeps mutating it as long as the root is
// mounted, so nothing else may rewire it. The layer tree that inspect, lint,
// comments and the viewer see (host nodes plus virtual `#component` wrappers,
// coordinates relative to the wrapper) is built beside it as a fresh copy.

/** Per-node text caches. They stay on the host so layout and painting share one paragraph. */
const HOST_CACHES = ["paragraph", "runs", "fontFamilies", "missingGlyphs"] as const;

/** A layer standing for a host node: its own place in the layer tree, the host's props and caches. */
function layerOf(host: SceneNode, parent: SceneNode | null, layout: Box): SceneNode {
  const node: SceneNode = { id: host.id, type: host.type, props: host.props, children: [], parent, layout, host };
  for (const key of HOST_CACHES) {
    Object.defineProperty(node, key, {
      enumerable: true,
      get: () => host[key],
      set: (value) => {
        host[key] = value;
      },
    });
  }
  // A Text's own children (raw text and <Span>s) are not layers; they are read through the host.
  if (host.type === "Text") node.children = host.children;
  return node;
}

/** A host node with its position in the layer being built (rebased under component wrappers). */
interface Placed {
  host: SceneNode;
  layout: Box;
}

const placed = (hosts: SceneNode[]): Placed[] => hosts.map((host) => ({ host, layout: { ...host.layout } }));

function groupChildren(items: Placed[], depth: number, parent: SceneNode): SceneNode[] {
  const out: SceneNode[] = [];
  for (let i = 0; i < items.length; ) {
    const comp = items[i].host.componentStack?.[depth];
    if (!comp) {
      const { host, layout } = items[i++];
      const node = layerOf(host, parent, layout);
      if (host.type !== "Text") node.children = groupChildren(placed(layerChildren(host)), depth, node);
      out.push(node);
      continue;
    }

    const run: Placed[] = [items[i++]];
    while (i < items.length && items[i].host.componentStack?.[depth] === comp) {
      run.push(items[i++]);
    }

    const x0 = Math.min(...run.map((c) => c.layout.x));
    const y0 = Math.min(...run.map((c) => c.layout.y));
    const x1 = Math.max(...run.map((c) => c.layout.x + c.layout.width));
    const y1 = Math.max(...run.map((c) => c.layout.y + c.layout.height));
    const rebased = run.map(({ host, layout }) => ({
      host,
      layout: { x: layout.x - x0, y: layout.y - y0, width: layout.width, height: layout.height },
    }));

    const wrapper = createNode(COMPONENT_TYPE, comp.source ? { $source: comp.source } : {});
    wrapper.component = { name: comp.name, props: comp.props, source: comp.source };
    wrapper.layout = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    wrapper.parent = parent;
    wrapper.children = groupChildren(rebased, depth + 1, wrapper);
    out.push(wrapper);
  }
  return out;
}

/**
 * Builds the layer tree of a laid-out (or freshly reconciled) artboard: virtual
 * `#component` nodes materialized from the recorded Fiber stacks, child
 * coordinates rebased onto them. The host tree is left untouched.
 */
export function groupComponents(root: SceneNode): SceneNode {
  const layer = layerOf(root, null, { ...root.layout });
  if (root.type !== "Text") layer.children = groupChildren(placed(layerChildren(root)), 0, layer);
  return layer;
}
