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

export function formatDiagnostic(d: Diagnostic): string {
  const where = d.source ?? "(unknown location)";
  return `${where}  ${d.severity}[${d.rule}]${d.frame ? ` (${d.frame})` : ""}  ${d.message}`;
}
