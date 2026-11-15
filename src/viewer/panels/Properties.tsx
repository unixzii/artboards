import { Check, Component, Copy, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { ButtonGroup, Empty, GroupButton, LinkButton } from "../components/primitives.tsx";
import { Section } from "../components/Section.tsx";
import { useViewer, useViewerState } from "../core/context.ts";
import { enclosingComponent, type ViewFrame, type ViewNode } from "../core/model.ts";
import type { VariantInfo } from "../../shared/dsl/variants.ts";
import { gradientStops } from "../../shared/paint.ts";
import { isAssetRef, type Gradient } from "../../shared/scene.ts";
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

function ShadowValue({ shadow }: { shadow: Record<string, unknown> }) {
  const color = typeof shadow.color === "string" ? shadow.color : "rgba(0, 0, 0, 0.25)";
  const parts = [`${shadow.x ?? 0}, ${shadow.y ?? 0}`, `blur ${shadow.blur ?? 0}`];
  if (shadow.spread) parts.push(`spread ${shadow.spread}`);
  return (
    <div>
      <span className="swatch" style={{ background: color }} />
      {parts.join(" · ")}
    </div>
  );
}

function isGradient(v: unknown): v is Gradient {
  return typeof v === "object" && v !== null && ((v as Gradient).type === "linear" || (v as Gradient).type === "radial") && Array.isArray((v as Gradient).stops);
}

/** The same gradient as CSS, for the swatch. */
function cssGradient(g: Gradient): string {
  const { colors, positions } = gradientStops(g.stops);
  const stops = colors.map((c, i) => `${c} ${Math.round(positions[i] * 100)}%`).join(", ");
  if (g.type === "radial") {
    const [cx, cy] = g.center ?? [0.5, 0.5];
    return `radial-gradient(circle at ${cx * 100}% ${cy * 100}%, ${stops})`;
  }
  return `linear-gradient(${g.angle ?? 180}deg, ${stops})`;
}

function PropRow({ name, value }: { name: string; value: unknown }) {
  if (name === "shadow" && typeof value === "object" && value !== null) {
    const list = Array.isArray(value) ? value : [value];
    return (
      <div className="row">
        <span className="k">{name}</span>
        <span className="v">
          {list.map((s, i) => (
            <ShadowValue key={i} shadow={s as Record<string, unknown>} />
          ))}
        </span>
      </div>
    );
  }
  if (COLOR_PROPS.has(name) && isGradient(value)) {
    return (
      <div className="row">
        <span className="k">{name}</span>
        <span className="v">
          <span className="swatch" style={{ background: cssGradient(value) }} />
          {value.type} · {value.stops.length} stops
        </span>
      </div>
    );
  }
  if (isAssetRef(value)) {
    return (
      <div className="row">
        <span className="k">{name}</span>
        <span className="v">{value.file}</span>
      </div>
    );
  }
  if (typeof value === "function") {
    return (
      <div className="row">
        <span className="k">{name}</span>
        <span className="v">function</span>
      </div>
    );
  }
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

/** Segmented buttons for a few short options, a menu otherwise. */
function VariantPicker({ frame, variant }: { frame: string; variant: VariantInfo }) {
  const viewer = useViewer();
  const labels = variant.options.map(String);
  const pick = (i: number) => viewer.setVariant(frame, variant.name, variant.options[i]);
  const current = variant.options.findIndex((o) => Object.is(o, variant.value));
  const title = (i: number) => (Object.is(variant.options[i], variant.initial) ? `${labels[i]} (initial)` : labels[i]);
  if (labels.length <= 5 && labels.join("").length <= 24) {
    return (
      <ButtonGroup label={variant.name}>
        {labels.map((label, i) => (
          <GroupButton key={label} title={title(i)} active={i === current} onClick={() => pick(i)}>
            {label}
          </GroupButton>
        ))}
      </ButtonGroup>
    );
  }
  return (
    <select aria-label={variant.name} value={current} onChange={(e) => pick(Number(e.target.value))}>
      {labels.map((label, i) => (
        <option key={label} value={i}>
          {title(i)}
        </option>
      ))}
    </select>
  );
}

/** The artboard's variants, shown when its root is selected. */
function Variants({ frame }: { frame: ViewFrame }) {
  const viewer = useViewer();
  if (frame.variants.length === 0 && !frame.modified) return null;
  return (
    <div className="variants">
      <div className="variants-head">
        <span>Variants</span>
        {frame.modified && (
          <LinkButton title="Reset every variant and clicked state" onClick={() => viewer.resetFrame(frame.name)}>
            <RotateCcw size={11} />
            <span>Reset</span>
          </LinkButton>
        )}
      </div>
      {frame.variants.map((v) => (
        <div className="variant" key={v.name}>
          <span className="k" title={v.name}>
            {v.name}
          </span>
          <VariantPicker frame={frame.name} variant={v} />
        </div>
      ))}
      {frame.variants.length === 0 && <div className="variants-note">Changed by clicks in Play mode.</div>}
    </div>
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
      {!node.parent && <Variants frame={node.frame} />}
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
