import { Empty } from "../components/primitives.tsx";
import { Section } from "../components/Section.tsx";
import { useViewerState } from "../core/context.ts";
import { ProblemItem } from "./ProblemItem.tsx";

export function Problems() {
  const diagnostics = useViewerState((s) => s.diagnostics);
  return (
    <Section id="problems" title="Problems" count={diagnostics.length ? `(${diagnostics.length})` : ""} resizable defaultHeight={220}>
      {diagnostics.length === 0 && <Empty>No problems.</Empty>}
      {diagnostics.map((d, i) => (
        <ProblemItem key={i} problem={d} />
      ))}
    </Section>
  );
}
