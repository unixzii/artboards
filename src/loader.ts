// Compiles a DSL file (JSX/TSX) and evaluates it.
// NOTE: spike only — this runs the code in-process with no sandbox.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import React from "react";
import { transform } from "sucrase";
import * as dsl from "./dsl.ts";
import * as jsxRuntime from "./jsx-runtime.ts";
import { unknownExport } from "./schema.ts";

// Reading a name that "artboards" does not export fails loudly instead of
// handing React an undefined element type.
const strictDsl = new Proxy(dsl as Record<string | symbol, unknown>, {
  get(target, key) {
    if (typeof key === "symbol" || key in target || key === "__esModule" || key === "default") return target[key];
    throw unknownExport(key);
  },
});

const BUILTINS: Record<string, unknown> = {
  artboards: strictDsl,
  "artboards/jsx-dev-runtime": jsxRuntime,
  "artboards/jsx-runtime": jsxRuntime,
  react: React,
};

const EXTENSIONS = ["", ".jsx", ".tsx", ".ts", ".js"];

export function loadModule(file: string, cache = new Map<string, any>()): Record<string, any> {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file).exports;

  const { code } = transform(readFileSync(file, "utf8"), {
    transforms: ["typescript", "jsx", "imports"],
    jsxRuntime: "automatic",
    jsxImportSource: "artboards",
    production: false,
    filePath: file,
  });

  const module = { exports: {} as Record<string, any> };
  cache.set(file, module);

  const require = (spec: string) => {
    if (spec in BUILTINS) return BUILTINS[spec];
    if (spec.startsWith(".")) {
      const base = resolve(dirname(file), spec);
      const found = EXTENSIONS.map((e) => base + e).find((p) => existsSync(p));
      if (!found) throw new Error(`${file}: cannot resolve import "${spec}"`);
      return loadModule(found, cache);
    }
    throw new Error(`${file}: cannot import "${spec}". Only "artboards" and relative files are available.`);
  };

  new Function("require", "module", "exports", `${code}\n//# sourceURL=${file}`)(
    require,
    module,
    module.exports,
  );
  return module.exports;
}
