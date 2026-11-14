import type { Diagnostic } from "../../lib/shared/protocol.ts";
import { nodeKey } from "../model.ts";
import { useViewer, useViewerState } from "./context.ts";
import { Empty, ListItem, Section } from "./ui.tsx";

/** One diagnostic. Clicking it selects the layer it is about, when there is one. */
export function ProblemItem({ problem }: { problem: Diagnostic }) {
  const viewer = useViewer();
  const key = problem.frame != null && problem.node != null ? nodeKey(problem.frame, problem.node) : null;
  return (
    <ListItem
      tone={problem.severity}
      onClick={() => key && viewer.select(key, { reveal: true })}
      head={
        <>
          <span className="rule">{problem.rule}</span>
          <span>{problem.source}</span>
        </>
      }
    >
      {problem.message}
    </ListItem>
  );
}

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
