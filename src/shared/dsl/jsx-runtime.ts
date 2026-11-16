// JSX runtime DSL files compile against. Stamps host elements and tracks
// component call-sites so inspect/lint/viewer can map both layers and component
// instances back to source lines. React 19 dropped the `source` argument, hence
// the wrapper.

import { isValidElement, type Key, type ReactElement } from "react";
import { jsx as jsxFactory, jsxs as jsxsFactory } from "react/jsx-runtime";
import { MASK_TYPE } from "../scene.ts";
import { DslError, ELEMENTS } from "./schema.ts";

export { Fragment } from "react";

// React's public JSX typings only accept its DOM tags and components.
type ElementFactory = (type: unknown, props: Record<string, unknown>, key?: Key) => ReactElement;
const reactJsx = jsxFactory as ElementFactory;
const reactJsxs = jsxsFactory as ElementFactory;

function renderElement(factory: ElementFactory, type: unknown, props: Record<string, unknown>, key?: Key) {
  if (typeof type === "string" && props.mask != null && props.mask !== false && ELEMENTS[type]?.props.mask) {
    const { mask, children, ...rest } = props;
    if (!isValidElement(mask)) {
      const source = typeof props.$source === "string" ? props.$source : undefined;
      throw new DslError(`\`mask\` on <${type}> must be a JSX element, e.g. mask={<Ellipse ... />}.`, source);
    }
    const content = Array.isArray(children) ? children : [children];
    const slot = reactJsx(MASK_TYPE, { children: mask }, "$artboards:mask");
    return reactJsxs(type, { ...rest, $maskContent: children, children: [...content, slot] }, key);
  }
  return factory(type, props, key);
}

export const jsx: ElementFactory = (type, props, key) => renderElement(reactJsx, type, props, key);
export const jsxs: ElementFactory = (type, props, key) => renderElement(reactJsxs, type, props, key);

/** Restores the authored children prop after React has seen the extra slot. */
export function layerProps(props: Record<string, any>): Record<string, any> {
  if (!Object.hasOwn(props, "$maskContent")) return props;
  const { $maskContent, children: _children, ...rest } = props;
  return $maskContent === undefined ? rest : { ...rest, children: $maskContent };
}

interface Source {
  fileName: string;
  lineNumber: number;
  columnNumber: number;
}

// Keyed by the cloned props object passed to React so user components never see
// internal `$source` properties when spreading `{ ...rest }`.
const componentSources = new WeakMap<object, string>();

export function componentSourceOf(props: unknown): string | undefined {
  return props && typeof props === "object" ? componentSources.get(props) : undefined;
}

export function jsxDEV(type: any, props: any, key: any, isStatic: boolean, source?: Source) {
  const loc = source ? `${source.fileName}:${source.lineNumber}` : undefined;
  if (typeof type === "string" && loc) {
    props = { ...props, $source: loc };
  } else if ((typeof type === "function" || (type && typeof type === "object")) && loc) {
    props = { ...props };
    componentSources.set(props, loc);
  }
  return (isStatic ? jsxs : jsx)(type, props, key);
}
