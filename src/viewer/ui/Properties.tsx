import { useViewer, useViewerState } from "../core/context.ts";
import type { ViewNode } from "../core/model.ts";
import { Empty, LinkButton, Section } from "./primitives.tsx";
import { ProblemItem } from "./ProblemItem.tsx";

const COLOR_PROPS = new Set(["fill", "stroke", "color"]);
// Shown elsewhere in the panel (header, text box) or internal.
const HIDDEN_PROPS = new Set(["$source", "children", "name"]);

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <span>{Math.round(value * 100) / 100}</span>
    </div>
  );
}

function PropRow({ name, value }: { name: string; value: unknown }) {
  const isColor = COLOR_PROPS.has(name) && typeof value === "string";
  return (
    <div className="row">
      <span className="k">{name}</span>
      <span className="v">
        {isColor && <span className="swatch" style={{ background: value }} />}
        {typeof value === "string" ? value : JSON.stringify(value)}
      </span>
    </div>
  );
}

function Inspector({ node }: { node: ViewNode }) {
  const diagnostics = useViewerState((s) => s.diagnostics);
  const source: string | undefined = node.props.$source;
  const props = Object.entries(node.props).filter(([name]) => !HIDDEN_PROPS.has(name));
  const problems = diagnostics.filter((d) => d.frame === node.frame.name && d.node === node.path);
  return (
    <>
      <div className="prop-head">
        <div className="title">
          {node.type}
          {node.props.name && ` “${node.props.name}”`}
        </div>
        <div className="source">
          {source ? (
            <LinkButton title="Copy" onClick={() => navigator.clipboard?.writeText(source)}>
              {source}
            </LinkButton>
          ) : (
            node.frame.name
          )}
        </div>
      </div>
      <div className="metrics">
        <Metric label="X" value={node.abs.x} />
        <Metric label="Y" value={node.abs.y} />
        <Metric label="W" value={node.layout.width} />
        <Metric label="H" value={node.layout.height} />
      </div>
      {node.type === "Text" && <div className="text-content">{String(node.props.children ?? "")}</div>}
      {props.length > 0 && (
        <div className="rows">
          {props.map(([name, value]) => (
            <PropRow key={name} name={name} value={value} />
          ))}
        </div>
      )}
      {problems.map((d, i) => (
        <ProblemItem key={i} problem={d} />
      ))}
    </>
  );
}

export function Properties() {
  const viewer = useViewer();
  const selected = useViewerState((s) => s.selected);
  useViewerState((s) => s.model); // the selected key can point at a new node after a rebuild
  const node = viewer.node(selected);
  return (
    <Section id="props" title="Properties">
      {node ? <Inspector node={node} /> : <Empty>Click a layer to inspect it.</Empty>}
    </Section>
  );
}
