import { useViewerState } from "../core/context.ts";
import { Empty, Section } from "./primitives.tsx";
import { ProblemItem } from "./ProblemItem.tsx";

export function Problems() {
  const diagnostics = useViewerState((s) => s.diagnostics);
  return (
    <Section id="problems" title="Problems" count={diagnostics.length ? `(${diagnostics.length})` : ""}>
      {diagnostics.length === 0 && <Empty>No problems.</Empty>}
      {diagnostics.map((d, i) => (
        <ProblemItem key={i} problem={d} />
      ))}
    </Section>
  );
}
