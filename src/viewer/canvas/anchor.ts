// CSS-variable positioning for DOM overlay elements pinned to canvas coordinates.

import type { CSSProperties } from "react";
import type { Point } from "../core/model.ts";

/**
 * Style for an `.anchored` overlay element pinned to a canvas point. The
 * renderer moves it by updating --s/--tx/--ty on the overlay, so panning and
 * zooming never re-render React. Extra entries become CSS variables too.
 */
export function anchor(at: Point, vars: Record<string, string | number> = {}): CSSProperties {
  const style: Record<string, string | number> = { "--x": at.x, "--y": at.y };
  for (const [name, value] of Object.entries(vars)) style[`--${name}`] = value;
  return style as CSSProperties;
}
