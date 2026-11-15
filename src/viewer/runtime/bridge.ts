// Exposes the viewer's own React and DSL instances to dynamically imported
// design bundles so hooks and context share a single React copy.

import { BUILTIN_MODULES, RUNTIME_GLOBAL } from "../../shared/dsl/runtime.ts";

export function installRuntimeBridge() {
  (globalThis as any)[RUNTIME_GLOBAL] = BUILTIN_MODULES;
}
