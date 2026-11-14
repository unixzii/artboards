// React host config that builds the scene tree. Mutation mode, synchronous.

import type { ReactNode } from "react";
import Reconciler from "react-reconciler";
import { DefaultEventPriority } from "react-reconciler/constants.js";
import { DslError, validateProps } from "./schema.ts";
import { createNode, type SceneNode } from "../shared/scene.ts";

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

  createInstance(type: string, props: Record<string, any>) {
    validateProps(type, props);
    return createNode(type, props);
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
  commitUpdate(instance: SceneNode, type: string, _old: unknown, next: Record<string, any>) {
    validateProps(type, next);
    instance.props = next;
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
