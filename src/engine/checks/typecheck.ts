// Type-checks a DSL file against the generated declarations by running tsc.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Diagnostic } from "../../shared/diagnostics.ts";
import { generateDts } from "../dsl/schema.ts";

const require = createRequire(import.meta.url);

// Lives inside the package so its `import "react"` resolves to our @types/react.
export const DTS_PATH = fileURLToPath(new URL("../../../types/artboards.d.ts", import.meta.url));

/** Writes the declaration file if it is missing or out of date. */
export function ensureTypes(): string {
  const next = generateDts();
  if (!existsSync(DTS_PATH) || readFileSync(DTS_PATH, "utf8") !== next) {
    mkdirSync(dirname(DTS_PATH), { recursive: true });
    writeFileSync(DTS_PATH, next);
  }
  return DTS_PATH;
}

export function typecheck(file: string): Diagnostic[] {
  const tsPkg = require.resolve("typescript/package.json");
  const tsc = join(dirname(tsPkg), require(tsPkg).bin.tsc);
  const dir = mkdtempSync(join(tmpdir(), "artboards-tsc-"));
  try {
    const config = {
      compilerOptions: {
        noEmit: true,
        allowJs: true,
        checkJs: true,
        jsx: "react-jsx",
        jsxImportSource: "artboards",
        strict: true,
        noImplicitAny: false, // untyped component props are fine in .jsx
        target: "esnext",
        module: "esnext",
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        skipLibCheck: true,
        types: [],
      },
      files: [resolve(file), ensureTypes()],
    };
    writeFileSync(join(dir, "tsconfig.json"), JSON.stringify(config));
    const run = spawnSync(process.execPath, [tsc, "-p", dir, "--pretty", "false"], { encoding: "utf8" });
    const out = `${run.stdout ?? ""}${run.stderr ?? ""}`;
    const diagnostics: Diagnostic[] = [];
    // path(line,col): error TS1234: message   (continuation lines are indented)
    const re = /^(.+?)\((\d+),\d+\): error (TS\d+): (.*)$/;
    for (const line of out.split("\n")) {
      const m = re.exec(line);
      if (m) {
        diagnostics.push({
          severity: "error",
          rule: "type",
          message: m[4],
          source: `${relative(process.cwd(), resolve(m[1]))}:${m[2]}`, // tsc prints paths relative to its cwd
        });
      } else if (/^\s+\S/.test(line) && diagnostics.length) {
        diagnostics[diagnostics.length - 1].message += ` ${line.trim()}`;
      }
    }
    if (run.status !== 0 && diagnostics.length === 0 && out.trim()) {
      diagnostics.push({ severity: "error", rule: "type", message: out.trim() });
    }
    return diagnostics;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
