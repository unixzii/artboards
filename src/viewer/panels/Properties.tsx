import { Check, Component, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { Empty, LinkButton } from "../components/primitives.tsx";
import { Section } from "../components/Section.tsx";
import { useViewer, useViewerState } from "../core/context.ts";
import { enclosingComponent, type ViewNode } from "../core/model.ts";
import { LayerIcon } from "./LayerIcon.tsx";
import { ProblemItem } from "./ProblemItem.tsx";

const COLOR_PROPS = new Set(["fill", "stroke", "color"]);
const COLOR_VALUE = /^(#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]+\))$/i;
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
  const isColor = typeof value === "string" && (COLOR_PROPS.has(name) || COLOR_VALUE.test(value.trim()));
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

function SourceCopy({ source }: { source: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setCopied(false);
  }, [source]);

  const copy = () => {
    navigator.clipboard?.writeText(source);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <LinkButton title="Copy source location" onClick={copy}>
      <span>{source}</span>
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </LinkButton>
  );
}

function Inspector({ node }: { node: ViewNode }) {
  const viewer = useViewer();
  const diagnostics = useViewerState((s) => s.diagnostics);
  const comp = node.component;
  const owner = enclosingComponent(node);
  const source: string | undefined = comp ? comp.source : node.props.$source;
  const props = comp
    ? Object.entries(comp.props)
    : Object.entries(node.props).filter(([name]) => !HIDDEN_PROPS.has(name));
  const problems = diagnostics.filter((d) => d.frame === node.frame.name && d.node === node.path);
  return (
    <>
      <div className="prop-head">
        <div className={`title${comp ? " comp-title" : ""}`}>
          <LayerIcon node={node} size={14} />
          <span>
            {comp ? comp.name : node.type}
            {!comp && node.props.name && ` “${node.props.name}”`}
          </span>
        </div>
        <div className="source">
          {source ? <SourceCopy source={source} /> : node.frame.name}
          {owner && (
            <span className="owner">
              {" · in "}
              <LinkButton title="Select enclosing component" onClick={() => viewer.select(owner.key)}>
                <Component size={11} />
                <span>{owner.component!.name}</span>
              </LinkButton>
            </span>
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
