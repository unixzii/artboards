// Diagnostics produced by type-checking, DSL evaluation, and layout rules.

export interface Diagnostic {
  severity: "error" | "warning";
  rule: string;
  message: string;
  /** "file:line" of the layer or statement the problem is about. */
  source?: string;
  /** Artboard name. */
  frame?: string;
  /** Layer path within the artboard (see nodePath), when the problem is on a layer. */
  node?: string;
}

/** What each part of a formatted diagnostic is, for a caller that colors them. */
export type DiagnosticPart = "location" | "error" | "warning" | "frame";

export function formatDiagnostic(d: Diagnostic, paint: (part: DiagnosticPart, text: string) => string = (_, text) => text): string {
  const where = paint("location", d.source ?? "(unknown location)");
  const frame = d.frame ? paint("frame", ` (${d.frame})`) : "";
  return `${where}  ${paint(d.severity, `${d.severity}[${d.rule}]`)}${frame}  ${d.message}`;
}
