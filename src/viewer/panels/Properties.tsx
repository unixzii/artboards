import { Check, Component, Copy, RotateCcw } from "lucide-react";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { ButtonGroup, Empty, GroupButton, LinkButton, Select } from "../components/primitives.tsx";
import { Section } from "../components/Section.tsx";
import { useViewer, useViewerState } from "../core/context.ts";
import { enclosingComponent, sizing, type ViewFrame, type ViewNode } from "../core/model.ts";
import type { VariantInfo } from "../../shared/dsl/variants.ts";
import { gradientStops } from "../../shared/paint.ts";
import { MASK_TYPE, isAssetRef, type Gradient } from "../../shared/scene.ts";
import { LayerIcon } from "./LayerIcon.tsx";
import { ProblemItem } from "./ProblemItem.tsx";

const COLOR_PROPS = new Set(["fill", "stroke", "color"]);
const COLOR_VALUE = /^(#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]+\))$/i;
// Shown elsewhere in the panel (header, Layout's W/H, Content, Shadows) or internal.
const HIDDEN_PROPS = new Set(["$source", "children", "name", "width", "height", "shadow"]);

/** Which section each element prop is listed under; anything else goes to "Other". */
const PROP_GROUPS: [title: string, props: Set<string>][] = [
  [
    "Layout",
    new Set([
      "padding", "gap", "crossGap", "columnGap", "rowGap", "align", "justify", "wrap", "columns", "rows",
      "minWidth", "maxWidth", "minHeight", "maxHeight", "grow", "alignSelf", "colSpan", "rowSpan",
      "absolute", "x", "y", "right", "bottom", "rotation", "clip", "scroll",
    ]),
  ],
  [
    "Typography",
    new Set([
      "fontFamily", "fontSize", "fontWeight", "italic", "lineHeight", "letterSpacing", "textAlign",
      "textDecoration", "tabularNums", "maxLines", "color",
    ]),
  ],
  [
    "Appearance",
    new Set([
      "fill", "stroke", "strokeWidth", "strokeAlign", "strokeDash", "strokeCap", "strokeJoin", "cornerRadius",
      "opacity", "blur", "backdropBlur", "fit", "src", "viewBox", "d", "fillRule",
    ]),
  ],
  ["Interaction", new Set(["onClick", "onMouseDown", "onMouseMove", "onMouseUp", "onMouseEnter", "onMouseLeave"])],
];

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/** One labelled section of the inspector: a bold title (with an optional action on the right), then its rows. */
function Group({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="prop-group">
      <div className="prop-group-title">
        <span>{title}</span>
        {action}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, mode }: { label: string; value: number; mode?: string | null }) {
  return (
    <div className="metric">
      <span className="k">{label}</span>
      <span>
        {round(value)}
        {mode && mode !== "Fixed" && <span className="mode"> {mode}</span>}
      </span>
    </div>
  );
}

const CHECKER = "repeating-conic-gradient(#d4d4d8 0 25%, #fff 0 50%) 0 0 / 6px 6px";
let colorProbe: CanvasRenderingContext2D | null = null;

/** Any CSS color as `#rrggbb` plus alpha 0–1, or null if it isn't one. */
function parseColor(css: string): { hex: string; alpha: number } | null {
  if (!CSS.supports("color", css)) return null;
  colorProbe ??= document.createElement("canvas").getContext("2d");
  if (!colorProbe) return null;
  colorProbe.fillStyle = css;
  // The canvas normalizes to `#rrggbb` when opaque, `rgba(r, g, b, a)` otherwise.
  const out = String(colorProbe.fillStyle);
  if (out.startsWith("#")) return { hex: out, alpha: 1 };
  const m = out.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(",").map(Number);
  const hex = "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
  return { hex, alpha: a };
}

/** A color chip; translucent colors show the opaque color on the left and the real one over a checkerboard on the right. */
function Swatch({ color }: { color: string }) {
  const parsed = parseColor(color);
  if (!parsed || parsed.alpha >= 1) return <span className="swatch" style={{ background: color }} />;
  return (
    <span
      className="swatch"
      style={{ background: `linear-gradient(90deg, ${parsed.hex} 50%, transparent 50%), linear-gradient(${color}, ${color}), ${CHECKER}` }}
    />
  );
}

/** A small square whose own shadow points the way this one falls, like Figma's effect icon. */
function ShadowIcon({ x, y }: { x: number; y: number }) {
  const step = (n: number) => Math.sign(n) * 2;
  const offset = x || y ? `${step(x)}px ${step(y)}px 0 0` : "0 0 3px 0";
  return <span className="shadow-icon" style={{ boxShadow: `${offset} var(--shadow-icon)` }} />;
}

function ShadowItem({ shadow }: { shadow: Record<string, unknown> }) {
  const num = (v: unknown) => (typeof v === "number" ? v : 0);
  const color = typeof shadow.color === "string" ? shadow.color : "rgba(0, 0, 0, 0.25)";
  const parsed = parseColor(color);
  const fields: [string, number][] = [
    ["X", num(shadow.x)],
    ["Y", num(shadow.y)],
    ["Blur", num(shadow.blur)],
    ["Spread", num(shadow.spread)],
  ];
  return (
    <div className="shadow">
      <div className="shadow-head">
        <ShadowIcon x={num(shadow.x)} y={num(shadow.y)} />
        <span>Drop shadow</span>
      </div>
      <div className="shadow-grid">
        {fields.map(([label, v]) => (
          <Fragment key={label}>
            <span className="k">{label}</span>
            <span>{v}</span>
          </Fragment>
        ))}
      </div>
      <div className="shadow-color">
        <Swatch color={color} />
        <span>{parsed ? parsed.hex : color}</span>
        {parsed && <span>{Math.round(parsed.alpha * 100)}%</span>}
      </div>
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
  if (COLOR_PROPS.has(name) && isGradient(value)) {
    return (
      <div className="row">
        <span className="k">{name}</span>
        <span className="v">
          <span className="swatch" style={{ background: cssGradient(value) }} />
          {value.type}, {value.stops.length} stops
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
        {isColor && <Swatch color={value} />}
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
      <ButtonGroup label={variant.name} look="segmented">
        {labels.map((label, i) => (
          <GroupButton key={label} title={title(i)} active={i === current} onClick={() => pick(i)}>
            {label}
          </GroupButton>
        ))}
      </ButtonGroup>
    );
  }
  return (
    <Select label={variant.name} value={current} onChange={(v) => pick(Number(v))}>
      {labels.map((label, i) => (
        <option key={label} value={i}>
          {title(i)}
        </option>
      ))}
    </Select>
  );
}

/** The artboard's variants, shown when its root is selected. */
function Variants({ frame }: { frame: ViewFrame }) {
  const viewer = useViewer();
  if (frame.variants.length === 0 && !frame.modified) return null;
  const reset = frame.modified && (
    <LinkButton title="Reset every variant and interaction state" onClick={() => viewer.resetFrame(frame.name)}>
      <RotateCcw size={11} />
      <span>Reset</span>
    </LinkButton>
  );
  return (
    <Group title="Variants" action={reset}>
      {frame.variants.map((v) => (
        <div className="variant" key={v.name}>
          <span className="k" title={v.name}>
            {v.name}
          </span>
          <VariantPicker frame={frame.name} variant={v} />
        </div>
      ))}
      {frame.variants.length === 0 && <div className="note">Changed in Play mode.</div>}
    </Group>
  );
}

/** Splits element props into the sections of PROP_GROUPS, in that order, then "Other". Unset props are left out. */
function groupProps(props: Record<string, unknown>): [string, [string, unknown][]][] {
  const groups = new Map<string, [string, unknown][]>(PROP_GROUPS.map(([title]) => [title, []]));
  groups.set("Other", []);
  for (const [name, value] of Object.entries(props)) {
    if (value === undefined || HIDDEN_PROPS.has(name)) continue;
    const title = PROP_GROUPS.find(([, names]) => names.has(name))?.[0] ?? "Other";
    groups.get(title)!.push([name, value]);
  }
  return [...groups];
}

function Rows({ entries }: { entries: [string, unknown][] }) {
  return (
    <div className="rows">
      {entries.map(([name, value]) => (
        <PropRow key={name} name={name} value={value} />
      ))}
    </div>
  );
}

function Inspector({ node }: { node: ViewNode }) {
  const viewer = useViewer();
  const diagnostics = useViewerState((s) => s.diagnostics);
  const comp = node.component;
  const owner = enclosingComponent(node);
  const source: string | undefined = comp ? comp.source : node.props.$source;
  // A component instance lists the props it was called with; an element, its own props by section.
  const groups = comp ? [] : groupProps(node.props);
  const layoutRows = groups.find(([title]) => title === "Layout")?.[1] ?? [];
  const compProps = comp ? Object.entries(comp.props).filter(([, v]) => v !== undefined) : [];
  const problems = diagnostics.filter((d) => d.frame === node.frame.name && d.node === node.path);
  // Shadows get their own section, right after Appearance (or where it would be).
  const shadows = comp || node.props.shadow == null ? [] : [node.props.shadow].flat();
  const hasAppearance = groups.some(([title, entries]) => title === "Appearance" && entries.length > 0);
  const shadowGroup = shadows.length > 0 && (
    <Group title="Shadows">
      {shadows.map((sh, i) => (
        <ShadowItem key={i} shadow={sh} />
      ))}
    </Group>
  );
  return (
    <>
      <div className="prop-head">
        <div className={`title${comp ? " comp-title" : ""}`}>
          <LayerIcon node={node} size={14} />
          <span>
            {comp ? comp.name : node.type === MASK_TYPE ? "Mask" : node.type}
            {!comp && node.props.name && ` “${node.props.name}”`}
          </span>
        </div>
        <div className="source">{source ? <SourceCopy source={source} /> : node.frame.name}</div>
        {owner && (
          <div className="owner">
            <span>Inside</span>
            <LinkButton title="Select enclosing component" onClick={() => viewer.select(owner.key)}>
              <Component size={11} />
              <span>{owner.component!.name}</span>
            </LinkButton>
          </div>
        )}
      </div>
      {!node.parent && <Variants frame={node.frame} />}
      <Group title="Layout">
        <div className="metrics">
          <Metric label="X" value={node.abs.x} />
          <Metric label="Y" value={node.abs.y} />
          <Metric label="W" value={node.layout.width} mode={sizing(node, "width")} />
          <Metric label="H" value={node.layout.height} mode={sizing(node, "height")} />
        </div>
        {layoutRows.length > 0 && <Rows entries={layoutRows} />}
      </Group>
      {node.type === "Text" && (
        <Group title="Content">
          <div className="text-content">{String(node.props.children ?? "")}</div>
        </Group>
      )}
      {compProps.length > 0 && (
        <Group title="Props">
          <Rows entries={compProps} />
        </Group>
      )}
      {groups.map(
        ([title, entries]) =>
          title !== "Layout" &&
          entries.length > 0 && (
            <Fragment key={title}>
              <Group title={title}>
                <Rows entries={entries} />
              </Group>
              {title === "Appearance" && shadowGroup}
            </Fragment>
          ),
      )}
      {!hasAppearance && shadowGroup}
      {problems.length > 0 && (
        <Group title="Problems">
          {problems.map((d, i) => (
            <ProblemItem key={i} problem={d} />
          ))}
        </Group>
      )}
    </>
  );
}

export function Properties() {
  const viewer = useViewer();
  const selected = useViewerState((s) => s.selected);
  useViewerState((s) => s.model); // the selected key can point at a new node after a rebuild
  useViewerState((s) => s.scrollTick); // X/Y change when a container above scrolls
  const node = viewer.node(selected);
  return (
    <Section id="props" title="Properties">
      {node ? <Inspector node={node} /> : <Empty>Click a layer to inspect it.</Empty>}
    </Section>
  );
}
