// Text/JSON views of a laid-out tree.

import { formatPropsSummary, layerChildren, sourceOf, textContentOf, type SceneNode } from "../shared/scene.ts";
import type { VariantInfo, VariantValue } from "./dsl/variants.ts";

const showValue = (v: VariantValue) => JSON.stringify(v);

/** The `variants:` block printed above an artboard's tree; empty when it has none. */
export function formatVariants(variants: VariantInfo[]): string {
  if (variants.length === 0) return "";
  const lines = variants.map((v) => `  ${v.name} = ${showValue(v.value)}  (${v.options.map(showValue).join(" | ")}; initial ${showValue(v.initial)})`);
  return `variants:\n${lines.join("\n")}\n`;
}

export function formatTree(root: SceneNode): string {
  const lines: string[] = [];
  const walk = (n: SceneNode, depth: number) => {
    line(n, depth);
    for (const c of layerChildren(n)) walk(c, depth + 1);
  };
  const line = (n: SceneNode, depth: number) => {
    const { x, y, width, height } = n.layout;
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
      `${"  ".repeat(depth)}${n.type}${name}${text}  [${x},${y} ${width}x${height}]  ${sourceOf(n) ?? ""}`.trimEnd(),
    );
  };
  walk(root, 0);
  return lines.join("\n");
}

export function toJson(n: SceneNode): object {
  if (n.component) {
    return {
      type: "Component",
      component: n.component.name,
      props: n.component.props,
      layout: n.layout,
      source: sourceOf(n),
      children: layerChildren(n).map(toJson),
    };
  }
  const { children: _c, $source, ...props } = n.props;
  return {
    type: n.type,
    ...(n.type === "Text" ? { text: textContentOf(n), ...(n.runs && n.runs.length > 1 ? { runs: n.runs.map(({ text, props }) => ({ text, props })) } : {}) } : {}),
    props,
    layout: n.layout,
    source: $source,
    children: layerChildren(n).map(toJson),
  };
}
