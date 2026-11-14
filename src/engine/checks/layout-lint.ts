// Layout and legibility rules checked against a laid-out artboard.

import type { Diagnostic } from "../../shared/diagnostics.ts";
import { nodePath, sourceOf, walk, type SceneNode } from "../../shared/scene.ts";
import { naturalTextHeight, type TextEngine } from "../../shared/text.ts";

const label = (n: SceneNode) => `<${n.type}${n.props.name ? ` "${n.props.name}"` : ""}>`;

/** WCAG relative luminance of an [r, g, b] in 0..1. */
function luminance(c: ArrayLike<number>): number {
  const [r, g, b] = [c[0], c[1], c[2]];
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function checkFrame({ root, engine, name: frame }: { name: string; root: SceneNode; engine: TextEngine }): Diagnostic[] {
  const out: Diagnostic[] = [];
  const warn = (n: SceneNode, rule: string, message: string) =>
    out.push({ severity: "warning", rule, message, source: sourceOf(n), frame, node: nodePath(n) });

  walk(root, (n) => {
    if (n.type === "#text") return;
    const { x, y, width, height } = n.layout;
    const p = n.parent;
    const inFlow = p && (p.type === "Row" || p.type === "Column");

    if (width === 0 || height === 0) {
      const axis = width === 0 ? "width" : "height";
      const why =
        n.props[axis] === "fill"
          ? `${axis}="fill" got no space: the parent hugs its content or siblings used it all`
          : `it has no content and no ${axis}`;
      warn(n, "zero-size", `${label(n)} is ${width}x${height} and will not be visible — ${why}.`);
    }

    if (p && p.type !== "#root" && !p.props.clip) {
      const dx = Math.max(0, -x, x + width - p.layout.width);
      const dy = Math.max(0, -y, y + height - p.layout.height);
      if (dx > 0.5 || dy > 0.5) {
        const parts = [dx > 0.5 && `${Math.round(dx)}px horizontally`, dy > 0.5 && `${Math.round(dy)}px vertically`];
        warn(n, "overflow", `${label(n)} overflows its parent ${label(p)} by ${parts.filter(Boolean).join(" and ")}.`);
      }
    }

    if (inFlow && (n.props.x != null || n.props.y != null)) {
      warn(n, "ignored-position", `${label(n)} has x/y but its parent is a <${p.type}>, which positions children itself. Remove x/y or use a <Frame> parent.`);
    }

    if (n.type === "Text") {
      const natural = naturalTextHeight(engine, n);
      if (natural > height + 0.5) {
        warn(n, "text-clipped", `${label(n)} needs ${natural}px of height but has ${height}px; text spills out of its box.`);
      }
      if (n.missingGlyphs?.length) {
        warn(n, "missing-glyph", `${label(n)} contains characters no bundled font can draw: ${n.missingGlyphs.join(" ")}`);
      }
      // Contrast against the nearest filled ancestor (white if none).
      const { ck } = engine;
      const fg = ck.parseColorString(n.props.color ?? "#000000");
      let bg: ArrayLike<number> = [1, 1, 1, 1];
      for (let a = n.parent; a; a = a.parent) {
        if (a.props.fill) {
          bg = ck.parseColorString(a.props.fill);
          break;
        }
      }
      if (fg[3] === 1 && bg[3] === 1) {
        const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
        const ratio = (hi + 0.05) / (lo + 0.05);
        const size = n.props.fontSize ?? 14;
        const large = size >= 24 || (size >= 18.5 && Number(n.props.fontWeight ?? 400) >= 700);
        const need = large ? 3 : 4.5;
        if (ratio < need) {
          warn(n, "low-contrast", `${label(n)} has a contrast ratio of ${ratio.toFixed(2)}:1 against its background; ${need}:1 is the minimum for this size.`);
        }
      }
    }
  });
  return out;
}
