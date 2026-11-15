// Builtin module map exposed to compiled design bundles in both Node and browser.

import React from "react";
import * as dsl from "./elements.ts";
import * as jsxRuntime from "./jsx-runtime.ts";
import { unknownExport } from "./schema.ts";

// Prototype proxy so reading an unknown export from "artboards" throws a helpful
// DslError even after esbuild wraps CJS exports with `__toESM`.
const strictProto = new Proxy(
  {},
  {
    get(_target, key) {
      if (typeof key === "symbol" || key === "default" || key === "__esModule" || key === "then") return undefined;
      throw unknownExport(key);
    },
  },
);

const strictDsl = Object.assign(Object.create(strictProto), dsl, { __esModule: true });

export const RUNTIME_GLOBAL = "__ARTBOARDS_RUNTIME__";

export const BUILTIN_MODULES: Record<string, unknown> = {
  artboards: strictDsl,
  "artboards/jsx-dev-runtime": jsxRuntime,
  "artboards/jsx-runtime": jsxRuntime,
  react: React,
};
