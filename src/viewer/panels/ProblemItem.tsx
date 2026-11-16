import { CircleAlert, TriangleAlert } from "lucide-react";
import type { Diagnostic } from "../../shared/diagnostics.ts";
import { ListItem } from "../components/primitives.tsx";
import { useViewer } from "../core/context.ts";
import { nodeKey } from "../core/model.ts";

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
          {problem.severity === "error" ? (
            <CircleAlert size={12} className="sev-icon" />
          ) : (
            <TriangleAlert size={12} className="sev-icon" />
          )}
          <span className="rule">{problem.rule}</span>
          <span className="where">{problem.source}</span>
        </>
      }
    >
      {problem.message}
    </ListItem>
  );
}
