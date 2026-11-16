// Text/JSON views of a laid-out tree.

import type { VariantInfo, VariantValue } from "../shared/dsl/variants.ts";
import { MASK_TYPE, formatPropsSummary, layerChildren, sourceOf, textContentOf, type SceneNode } from "../shared/scene.ts";

const showValue = (v: VariantValue) => JSON.stringify(v);

/** The `variants:` block printed above an artboard's tree; empty when it has none. */
export function formatVariants(variants: VariantInfo[]): string {
  if (variants.length === 0) return "";
  const lines = variants.map((v) => `  ${v.name} = ${showValue(v.value)}  (${v.options.map(showValue).join(" | ")}; initial ${showValue(v.initial)})`);
  return `variants:\n${lines.join("\n")}\n`;
}

/** Layout values to two decimals: layout is subpixel, and 16.799999 reads as noise. */
const round = (n: number) => Math.round(n * 100) / 100;
const roundBox = (b: SceneNode["layout"]) => ({ x: round(b.x), y: round(b.y), width: round(b.width), height: round(b.height) });

export function formatTree(root: SceneNode): string {
  const lines: string[] = [];
  const walk = (n: SceneNode, depth: number) => {
    line(n, depth);
    for (const c of layerChildren(n)) walk(c, depth + 1);
    if (n.mask) walk(n.mask, depth + 1);
  };
  const line = (n: SceneNode, depth: number) => {
    const { x, y, width, height } = roundBox(n.layout);
    if (n.component) {
      const summary = formatPropsSummary(n.component.props);
      lines.push(
        `${"  ".repeat(depth)}<${n.component.name}>${summary ? ` ${summary}` : ""}  [${x},${y} ${width}x${height}]  ${sourceOf(n) ?? ""}`.trimEnd(),
      );
      return;
    }
    const text = n.type === "Text" ? ` ${JSON.stringify(textContentOf(n).slice(0, 40))}` : "";
    const name = n.props.name ? ` "${n.props.name}"` : "";
    lines.push(
      `${"  ".repeat(depth)}${n.type === MASK_TYPE ? "Mask (alpha)" : n.type}${name}${text}  [${x},${y} ${width}x${height}]  ${sourceOf(n) ?? ""}`.trimEnd(),
    );
  };
  walk(root, 0);
  return lines.join("\n");
}

export function toJson(n: SceneNode): object {
  if (n.type === MASK_TYPE) {
    return { type: "Mask", mode: "alpha", layout: roundBox(n.layout), children: layerChildren(n).map(toJson) };
  }
  if (n.component) {
    return {
      type: "Component",
      component: n.component.name,
      props: n.component.props,
      layout: roundBox(n.layout),
      source: sourceOf(n),
      children: layerChildren(n).map(toJson),
    };
  }
  const { children: _c, mask: _mask, $source, ...props } = n.props;
  return {
    type: n.type,
    ...(n.type === "Text" ? { text: textContentOf(n), ...(n.runs && n.runs.length > 1 ? { runs: n.runs.map(({ text, props }) => ({ text, props })) } : {}) } : {}),
    props,
    layout: roundBox(n.layout),
    source: $source,
    children: layerChildren(n).map(toJson),
    ...(n.mask ? { mask: toJson(n.mask) } : {}),
  };
}
