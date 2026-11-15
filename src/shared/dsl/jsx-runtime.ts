// JSX runtime DSL files compile against. Stamps host elements and tracks
// component call-sites so inspect/lint/viewer can map both layers and component
// instances back to source lines. React 19 dropped the `source` argument, hence
// the wrapper.

import { jsx, jsxs } from "react/jsx-runtime";

export { Fragment } from "react";
export { jsx, jsxs };

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
