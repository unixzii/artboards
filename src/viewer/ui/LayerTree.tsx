import { memo, useEffect, useRef } from "react";
import { useViewer, useViewerState } from "../core/context.ts";
import { describe, type ViewNode } from "../core/model.ts";
import { Empty, Section } from "./primitives.tsx";

// Memoised: hovering changes two rows, not the whole tree.
const LayerRow = memo(function LayerRow(props: { node: ViewNode; depth: number; selected: boolean; hovered: boolean }) {
  const { node, depth, selected, hovered } = props;
  const viewer = useViewer();
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) row.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const isArtboard = depth === 0;
  const className = ["layer", isArtboard && "artboard", selected && "selected", hovered && "hover"].filter(Boolean).join(" ");
  return (
    <div
      ref={row}
      className={className}
      style={{ paddingLeft: 12 + depth * 14 }}
      onClick={() => viewer.select(node.key, { reveal: true })}
      onMouseEnter={() => viewer.hover(node.key)}
      onMouseLeave={() => viewer.hover(null)}
    >
      <span className="type">{isArtboard ? node.frame.name : node.type}</span>
      <span className="detail">{isArtboard ? node.type : describe(node)}</span>
    </div>
  );
});

function flatten(node: ViewNode, depth: number, out: { node: ViewNode; depth: number }[]) {
  out.push({ node, depth });
  for (const child of node.children) flatten(child, depth + 1, out);
  return out;
}

export function LayerTree() {
  const frames = useViewerState((s) => s.model.frames);
  const selected = useViewerState((s) => s.selected);
  const hovered = useViewerState((s) => s.hovered);

  return (
    <Section id="layers" title="Layers">
      {frames.length === 0 && <Empty>No artboards.</Empty>}
      {frames.map((frame) =>
        frame.root ? (
          flatten(frame.root, 0, []).map(({ node, depth }) => (
            <LayerRow key={node.key} node={node} depth={depth} selected={node.key === selected} hovered={node.key === hovered} />
          ))
        ) : (
          <div key={frame.name} className="layer artboard failed">
            <span className="type">⚠ {frame.name}</span>
            <span className="detail">failed to render</span>
          </div>
        ),
      )}
    </Section>
  );
}
