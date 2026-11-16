// Layout and legibility rules checked against a laid-out artboard.

import { parseColor } from "./color.ts";
import type { Diagnostic } from "./diagnostics.ts";
import type { RenderEngine } from "./engine.ts";
import { gradientStops } from "./paint.ts";
import { MASK_TYPE, expandSides, isComponentNode, nodePath, sourceOf, textRunsOf, walk, type Fill, type SceneNode } from "./scene.ts";
import { naturalTextHeight } from "./text.ts";

const validPaths = new Set<string>();

const label = (n: SceneNode) => `<${n.type}${n.props.name ? ` "${n.props.name}"` : ""}>`;

/** WCAG relative luminance of an [r, g, b] in 0..1. */
function luminance(c: ArrayLike<number>): number {
  const [r, g, b] = [c[0], c[1], c[2]];
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Axis-aligned bounds of a box rotated about its centre. */
function rotatedBounds(x: number, y: number, w: number, h: number, deg: number) {
  if (!deg) return { x, y, w, h };
  const r = (deg * Math.PI) / 180;
  const bw = Math.abs(w * Math.cos(r)) + Math.abs(h * Math.sin(r));
  const bh = Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r));
  return { x: x + (w - bw) / 2, y: y + (h - bh) / 2, w: bw, h: bh };
}

const POSITION_PROPS = ["x", "y", "right", "bottom"] as const;

export function checkFrame({ root, engine, name: frame }: { name: string; root: SceneNode; engine: RenderEngine }): Diagnostic[] {
  const out: Diagnostic[] = [];
  const warn = (n: SceneNode, rule: string, message: string) =>
    out.push({ severity: "warning", rule, message, source: sourceOf(n), frame, node: nodePath(n) });
  const { ck } = engine;

  walk(root, (n) => {
    if (n.type === "#text" || n.type === "Span" || n.type === MASK_TYPE || isComponentNode(n)) return;
    const { width, height } = n.layout;
    let x = n.layout.x;
    let y = n.layout.y;
    let cursor = n.parent;
    while (cursor && isComponentNode(cursor)) {
      x += cursor.layout.x;
      y += cursor.layout.y;
      cursor = cursor.parent;
    }
    const p = cursor;
    const inFlow = p && (p.type === "Row" || p.type === "Column" || p.type === "Grid");

    if (width === 0 || height === 0) {
      const axis = width === 0 ? "width" : "height";
      const why =
        n.props[axis] === "fill"
          ? `${axis}="fill" got no space: the parent hugs its content or siblings used it all`
          : n.type === "Image" && n.props.src
            ? `the image did not decode and it has no ${axis}`
            : `it has no content and no ${axis}`;
      warn(n, "zero-size", `${label(n)} is ${width}x${height} and will not be visible — ${why}.`);
    }

    if (p && p.type !== "#root" && p.type !== MASK_TYPE && !p.props.clip && !p.props.scroll) {
      const b = rotatedBounds(x, y, width, height, n.props.rotation ?? 0);
      const dx = Math.max(0, -b.x, b.x + b.w - p.layout.width);
      const dy = Math.max(0, -b.y, b.y + b.h - p.layout.height);
      // An `absolute` overlay may hang off an edge on purpose (a corner badge);
      // it is only a mistake once it has left the parent entirely.
      const detached = b.x >= p.layout.width || b.y >= p.layout.height || b.x + b.w <= 0 || b.y + b.h <= 0;
      if ((dx > 0.5 || dy > 0.5) && (!n.props.absolute || detached)) {
        const parts = [dx > 0.5 && `${Math.round(dx)}px horizontally`, dy > 0.5 && `${Math.round(dy)}px vertically`];
        warn(n, "overflow", `${label(n)} overflows its parent ${label(p)} by ${parts.filter(Boolean).join(" and ")}.`);
      }
    }

    if (n.props.scroll) {
      const axes = n.props.scroll === "both" ? (["width", "height"] as const) : n.props.scroll === "horizontal" ? (["width"] as const) : (["height"] as const);
      const hugs = axes.filter((a) => (n.props[a] ?? "hug") === "hug" && n.props[a === "width" ? "maxWidth" : "maxHeight"] == null);
      if (hugs.length) {
        warn(n, "scroll-hug", `${label(n)} has scroll="${n.props.scroll}" but its ${hugs.join(" and ")} hugs its content, so nothing can overflow. Give it a fixed ${hugs.join("/")}, "fill", or a max.`);
      }
    }

    if (inFlow && !n.props.absolute) {
      const set = POSITION_PROPS.filter((k) => n.props[k] != null);
      if (set.length) {
        warn(n, "ignored-position", `${label(n)} has ${set.join("/")} but its parent is a <${p.type}>, which positions children itself. Add \`absolute\` to place it on top of the flow, or remove ${set.join("/")}.`);
      }
    }

    if (n.props.grow != null) {
      const main = p?.type === "Row" ? "width" : p?.type === "Column" ? "height" : null;
      if (!main || n.props[main] !== "fill" || n.props.absolute) {
        warn(n, "ignored-grow", `${label(n)} has \`grow\` but it only applies to ${main ? `width="fill"` : `a "fill" size along a Row/Column`}${main ? ` in this <${p!.type}>` : ""}.`);
      }
    }

    if ((n.props.colSpan ?? 1) > 1 || (n.props.rowSpan ?? 1) > 1) {
      if (p?.type !== "Grid") warn(n, "ignored-span", `${label(n)} has colSpan/rowSpan but its parent is not a <Grid>.`);
    }

    if (n.props.strokeDash != null && Array.isArray(n.props.strokeWidth)) {
      const s = expandSides(n.props.strokeWidth);
      if (new Set([s.top, s.right, s.bottom, s.left]).size > 1) {
        warn(n, "dash-sides", `${label(n)} has a dashed border with different widths per side; dashes use the widest one on every side.`);
      }
    }

    if (n.type === "Image" && n.props.src && !engine.images.get(n.props.src.id)) {
      warn(n, "invalid-image", `${label(n)} could not decode ${n.props.src.file}. Use a .png, .jpg, .webp or .gif file.`);
    }

    if (n.type === "Path") {
      const d = typeof n.props.d === "string" ? n.props.d.trim() : "";
      let ok = d.length > 0 && validPaths.has(d);
      if (!ok && d) {
        const parsed = ck.Path.MakeFromSVGString(d);
        if (parsed) {
          parsed.delete();
          if (validPaths.size > 2048) validPaths.clear();
          validPaths.add(d);
          ok = true;
        }
      }
      if (!ok) {
        warn(n, "invalid-path", `${label(n)} has an invalid or empty SVG path \`d\`.`);
      } else if (!n.props.fill && !n.props.stroke && !(n.props.backdropBlur > 0)) {
        warn(n, "unpainted-path", `${label(n)} has neither \`fill\` nor \`stroke\` and will not be visible.`);
      }
    }

    if (n.type === "Text") {
      const natural = naturalTextHeight(engine, n);
      if (natural > height + 0.5) {
        warn(n, "text-clipped", `${label(n)} needs ${natural}px of height but has ${height}px; text spills out of its box. Give it more height, or set \`maxLines\` to truncate.`);
      }
      if (n.missingGlyphs?.length) {
        warn(n, "missing-glyph", `${label(n)} contains characters no bundled font can draw: ${n.missingGlyphs.join(" ")}`);
      }
      checkContrast(n);
    }
  }, { includeMasks: true });
  return out;

  /** Contrast of every run's color against the nearest filled ancestor (white if none). */
  function checkContrast(n: SceneNode) {
    // Translucency makes the effective colors unknowable here.
    for (let a: SceneNode | null = n; a; a = a.parent) if (a.type === MASK_TYPE || (a.props.opacity ?? 1) < 1) return;
    let bgFill: Fill = "#ffffff";
    for (let a = n.parent; a; a = a.parent) {
      if (a.props.fill) {
        bgFill = a.props.fill;
        break;
      }
    }
    const backgrounds = (typeof bgFill === "string" ? [bgFill] : gradientStops(bgFill.stops).colors).map((c) => parseColor(ck, c));
    if (backgrounds.some((b) => b[3] !== 1)) return;
    let worst: { ratio: number; need: number } | undefined;
    for (const run of textRunsOf(n)) {
      if (!run.text.trim()) continue;
      const style = { ...n.props, ...run.props };
      const fg = parseColor(ck, style.color ?? "#000000");
      if (fg[3] !== 1) continue;
      const size = style.fontSize ?? 14;
      const large = size >= 24 || (size >= 18.5 && Number(style.fontWeight ?? 400) >= 700);
      const need = large ? 3 : 4.5;
      for (const bg of backgrounds) {
        const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
        const ratio = (hi + 0.05) / (lo + 0.05);
        if (ratio < need && (!worst || ratio / need < worst.ratio / worst.need)) worst = { ratio, need };
      }
    }
    if (worst) {
      const against = typeof bgFill === "string" ? "its background" : "part of its gradient background";
      warn(n, "low-contrast", `${label(n)} has a contrast ratio of ${worst.ratio.toFixed(2)}:1 against ${against}; ${worst.need}:1 is the minimum for this size.`);
    }
  }
}
