import type { Diagnostic } from "../../shared/diagnostics.ts";
import { useViewer } from "../core/context.ts";
import { nodeKey } from "../core/model.ts";
import { ListItem } from "./primitives.tsx";

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
