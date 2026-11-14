import { memo, useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { useViewer, useViewerState } from "../core/context.ts";
import { describe, type ViewNode } from "../core/model.ts";
import { Empty, Section } from "./primitives.tsx";

// Memoised: hovering changes two rows, not the whole tree.
const LayerRow = memo(function LayerRow(props: {
  node: ViewNode;
  depth: number;
  selected: boolean;
  hovered: boolean;
  collapsed: boolean;
  onToggle: (key: string) => void;
}) {
  const { node, depth, selected, hovered, collapsed, onToggle } = props;
  const viewer = useViewer();
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) row.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const isArtboard = depth === 0;
  const comp = node.component;
  const hasChildren = node.children.length > 0;
  const className = [
    "layer",
    isArtboard && "artboard",
    comp && "component",
    selected && "selected",
    hovered && "hover",
  ]
    .filter(Boolean)
    .join(" ");

  const toggle = (e: MouseEvent) => {
    e.stopPropagation();
    onToggle(node.key);
  };

  return (
    <div
      ref={row}
      className={className}
      style={{ paddingLeft: 6 + depth * 14 }}
      onClick={() => viewer.select(node.key, { reveal: true })}
      onMouseEnter={() => viewer.hover(node.key)}
      onMouseLeave={() => viewer.hover(null)}
    >
      <span className={`twisty${hasChildren ? "" : " empty-twisty"}`} onClick={hasChildren ? toggle : undefined}>
        {hasChildren ? (collapsed ? "▸" : "▾") : ""}
      </span>
      <span className="type">{isArtboard ? node.frame.name : comp ? `❖ ${comp.name}` : node.type}</span>
      <span className="detail">{isArtboard ? node.type : describe(node)}</span>
    </div>
  );
});

function flatten(node: ViewNode, depth: number, collapsed: ReadonlySet<string>, out: { node: ViewNode; depth: number }[]) {
  out.push({ node, depth });
  if (!collapsed.has(node.key)) {
    for (const child of node.children) flatten(child, depth + 1, collapsed, out);
  }
  return out;
}

export function LayerTree() {
  const viewer = useViewer();
  const frames = useViewerState((s) => s.model.frames);
  const selected = useViewerState((s) => s.selected);
  const hovered = useViewerState((s) => s.hovered);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());

  // Selecting a layer on the canvas expands any collapsed ancestors so the row is visible.
  useEffect(() => {
    const node = viewer.node(selected);
    if (!node) return;
    setCollapsed((prev) => {
      let next: Set<string> | null = null;
      for (let p = node.parent; p; p = p.parent) {
        if (prev.has(p.key)) {
          next ??= new Set(prev);
          next.delete(p.key);
        }
      }
      return next ?? prev;
    });
  }, [viewer, selected]);

  const onToggle = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return (
    <Section id="layers" title="Layers">
      {frames.length === 0 && <Empty>No artboards.</Empty>}
      {frames.map((frame) =>
        frame.root ? (
          flatten(frame.root, 0, collapsed, []).map(({ node, depth }) => (
            <LayerRow
              key={node.key}
              node={node}
              depth={depth}
              selected={node.key === selected}
              hovered={node.key === hovered}
              collapsed={collapsed.has(node.key)}
              onToggle={onToggle}
            />
          ))
        ) : (
          <div key={frame.name} className="layer artboard failed">
            <span className="twisty empty-twisty" />
            <span className="type">⚠ {frame.name}</span>
            <span className="detail">failed to render</span>
          </div>
        ),
      )}
    </Section>
  );
}
