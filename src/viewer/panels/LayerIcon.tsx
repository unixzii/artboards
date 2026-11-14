// Maps a scene ViewNode to its corresponding Figma-style Lucide layer icon.

import {
  Circle,
  Component,
  Frame,
  Spline,
  Square,
  StretchHorizontal,
  StretchVertical,
  TriangleAlert,
  Type,
} from "lucide-react";
import type { ViewNode } from "../core/model.ts";

export function LayerIcon({ node, size = 13 }: { node: ViewNode; size?: number }) {
  if (node.component) return <Component size={size} className="layer-icon" />;
  switch (node.type) {
    case "Frame":
      return <Frame size={size} className="layer-icon" />;
    case "Row":
      return <StretchVertical size={size} className="layer-icon" />;
    case "Column":
      return <StretchHorizontal size={size} className="layer-icon" />;
    case "Text":
      return <Type size={size} className="layer-icon" />;
    case "Rect":
      return <Square size={size} className="layer-icon" />;
    case "Ellipse":
      return <Circle size={size} className="layer-icon" />;
    case "Path":
      return <Spline size={size} className="layer-icon" />;
    default:
      return <Square size={size} className="layer-icon" />;
  }
}

export function FailedFrameIcon({ size = 13 }: { size?: number }) {
  return <TriangleAlert size={size} className="layer-icon" />;
}
