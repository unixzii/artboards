// Resizable left/right workbench sidebar container.

import { useCallback, useState, type CSSProperties, type ReactNode } from "react";
import { ResizeHandle } from "./ResizeHandle.tsx";

export interface SidePanelProps {
  id: string;
  side: "left" | "right";
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  children: ReactNode;
}

export function SidePanel({ id, side, defaultWidth, minWidth = 180, maxWidth = 500, children }: SidePanelProps) {
  const [width, setWidth] = useState(defaultWidth);

  const onDelta = useCallback(
    (dx: number) => {
      const signed = side === "left" ? dx : -dx;
      setWidth((w) => Math.min(maxWidth, Math.max(minWidth, w + signed)));
    },
    [side, minWidth, maxWidth],
  );

  const onReset = useCallback(() => setWidth(defaultWidth), [defaultWidth]);

  return (
    <aside id={id} className={`side-panel side-${side}`} style={{ "--panel-w": `${width}px` } as CSSProperties}>
      {children}
      <ResizeHandle orientation="vertical" onDelta={onDelta} onReset={onReset} />
    </aside>
  );
}
