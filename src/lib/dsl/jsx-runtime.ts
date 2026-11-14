// JSX runtime the loader points DSL files at. It only exists to stamp each host
// element with where it was written, so inspect/lint/selection can map a node
// back to source. React 19 dropped the `source` argument, hence the wrapper.

import { relative } from "node:path";
import { jsx, jsxs } from "react/jsx-runtime";

export { Fragment } from "react";

interface Source {
  fileName: string;
  lineNumber: number;
  columnNumber: number;
}

export function jsxDEV(type: any, props: any, key: any, isStatic: boolean, source?: Source) {
  if (typeof type === "string" && source) {
    props = { ...props, $source: `${relative(process.cwd(), source.fileName)}:${source.lineNumber}` };
  }
  return (isStatic ? jsxs : jsx)(type, props, key);
}
