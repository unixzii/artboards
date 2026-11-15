// Collapsible (and optionally height-resizable) panel section.

import { ChevronDown, ChevronRight } from "lucide-react";
import { useCallback, useState, type CSSProperties, type ReactNode } from "react";
import { ResizeHandle } from "./ResizeHandle.tsx";

export interface SectionProps {
  id: string;
  title: string;
  count?: string;
  defaultCollapsed?: boolean;
  /** Enables a horizontal drag handle above this section to resize its height. */
  resizable?: boolean;
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  /** Buttons at the right end of the header, e.g. "Export". */
  actions?: ReactNode;
  children: ReactNode;
}

export function Section({
  id,
  title,
  count,
  defaultCollapsed = false,
  resizable = false,
  defaultHeight = 220,
  minHeight = 96,
  maxHeight = 560,
  actions,
  children,
}: SectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [height, setHeight] = useState(defaultHeight);

  const onDelta = useCallback(
    (dy: number) => {
      setHeight((h) => Math.min(maxHeight, Math.max(minHeight, h - dy)));
    },
    [minHeight, maxHeight],
  );

  const onReset = useCallback(() => setHeight(defaultHeight), [defaultHeight]);

  const className = ["panel-section", collapsed && "is-collapsed", resizable && "is-resizable", actions && "has-actions"].filter(Boolean).join(" ");
  const style = resizable && !collapsed ? ({ "--section-h": `${height}px` } as CSSProperties) : undefined;

  return (
    <section className={className} style={style}>
      {resizable && !collapsed && <ResizeHandle orientation="horizontal" onDelta={onDelta} onReset={onReset} />}
      <button type="button" className="section-header" onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed}>
        <span className="section-chevron">{collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}</span>
        <span className="section-title">{title}</span>
        {count && (
          <span id={`${id}-count`} className="count">
            {count}
          </span>
        )}
      </button>
      {actions && <div className="section-actions">{actions}</div>}
      {!collapsed && (
        <div id={id} className="scroll">
          {children}
        </div>
      )}
    </section>
  );
}
