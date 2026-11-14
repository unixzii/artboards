// Text/JSON views of a laid-out tree.

import { formatPropsSummary, sourceOf, textContentOf, walk, type SceneNode } from "../shared/scene.ts";

export function formatTree(root: SceneNode): string {
  const lines: string[] = [];
  walk(root, (n, depth) => {
    if (n.type === "#text") return;
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
  });
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
      children: n.children.filter((c) => c.type !== "#text").map(toJson),
    };
  }
  const { children: _c, $source, ...props } = n.props;
  return {
    type: n.type,
    ...(n.type === "Text" ? { text: textContentOf(n) } : {}),
    props,
    layout: n.layout,
    source: $source,
    children: n.children.filter((c) => c.type !== "#text").map(toJson),
  };
}
