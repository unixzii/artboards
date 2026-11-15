// Terminal colors. `styleText` leaves text plain when the stream is not a TTY or
// NO_COLOR is set, so piped output (agents, `--json`, files) never has escapes.

import { styleText } from "node:util";
import type { DiagnosticPart } from "../shared/diagnostics.ts";

type Format = Parameters<typeof styleText>[0];

export interface Paint {
  (format: Format, text: string): string;
  /** Colors for the parts of a diagnostic, to pass to `formatDiagnostic`. */
  diagnostic: (part: DiagnosticPart, text: string) => string;
}

const DIAGNOSTIC: Record<DiagnosticPart, Format> = {
  location: "cyan",
  error: ["red", "bold"],
  warning: ["yellow", "bold"],
  frame: "dim",
};

function paintFor(stream: NodeJS.WriteStream): Paint {
  const paint = ((format: Format, text: string) => styleText(format, text, { stream })) as Paint;
  paint.diagnostic = (part, text) => paint(DIAGNOSTIC[part], text);
  return paint;
}

/** Colors for text written to stdout. */
export const out = paintFor(process.stdout);
/** Colors for text written to stderr. */
export const err = paintFor(process.stderr);
