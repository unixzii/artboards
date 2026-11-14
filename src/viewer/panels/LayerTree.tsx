import { ChevronDown, ChevronRight } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { Empty } from "../components/primitives.tsx";
import { Section } from "../components/Section.tsx";
import { useViewer, useViewerState } from "../core/context.ts";
import { describe, type ViewNode } from "../core/model.ts";
import { FailedFrameIcon, LayerIcon } from "./LayerIcon.tsx";

type SelectionRole = "none" | "root" | "descendant";
type SelectionEdge = "none" | "single" | "top" | "middle" | "bottom";

interface FlatRow {
  node: ViewNode;
  depth: number;
  inComponent: boolean;
  selectionRole: SelectionRole;
  selectionEdge: SelectionEdge;
}

// Memoised: hovering changes two rows, not the whole tree.
const LayerRow = memo(function LayerRow(props: {
  node: ViewNode;
  depth: number;
  inComponent: boolean;
  selectionRole: SelectionRole;
  selectionEdge: SelectionEdge;
  hovered: boolean;
  collapsed: boolean;
  onToggle: (key: string) => void;
}) {
  const { node, depth, inComponent, selectionRole, selectionEdge, hovered, collapsed, onToggle } = props;
  const viewer = useViewer();
  const row = useRef<HTMLDivElement>(null);
  const isRootSelected = selectionRole === "root";

  useEffect(() => {
    if (isRootSelected) row.current?.scrollIntoView({ block: "nearest" });
  }, [isRootSelected]);

  const isArtboard = depth === 0;
  const comp = node.component;
  const hasChildren = node.children.length > 0;
  const className = [
    "layer",
    isArtboard && "artboard",
    comp && "component",
    inComponent && "in-component",
    selectionRole === "root" && "selected",
    selectionRole === "descendant" && "selected-descendant",
    selectionEdge !== "none" && `sel-${selectionEdge}`,
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
        {hasChildren && (collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />)}
      </span>
      <LayerIcon node={node} size={13} />
      <span className="type">{isArtboard ? node.frame.name : comp ? comp.name : node.type}</span>
      <span className="detail">{isArtboard ? node.type : describe(node)}</span>
    </div>
  );
});

function walkVisible(
  node: ViewNode,
  depth: number,
  collapsed: ReadonlySet<string>,
  selectedKey: string | null,
  inSelected: boolean,
  parentInComponent: boolean,
  out: FlatRow[],
) {
  const isSelected = node.key === selectedKey;
  const inComponent = parentInComponent || Boolean(node.component);
  const selectionRole: SelectionRole = isSelected ? "root" : inSelected ? "descendant" : "none";
  out.push({ node, depth, inComponent, selectionRole, selectionEdge: "none" });
  if (!collapsed.has(node.key)) {
    for (const child of node.children) {
      walkVisible(child, depth + 1, collapsed, selectedKey, isSelected || inSelected, inComponent, out);
    }
  }
}

function buildRows(root: ViewNode, collapsed: ReadonlySet<string>, selectedKey: string | null): FlatRow[] {
  const rows: FlatRow[] = [];
  walkVisible(root, 0, collapsed, selectedKey, false, false, rows);
  for (let i = 0; i < rows.length; i++) {
    const role = rows[i].selectionRole;
    if (role === "none") continue;
    const nextIsDescendant = rows[i + 1]?.selectionRole === "descendant";
    if (role === "root") {
      rows[i].selectionEdge = nextIsDescendant ? "top" : "single";
    } else {
      rows[i].selectionEdge = nextIsDescendant ? "middle" : "bottom";
    }
  }
  return rows;
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
          buildRows(frame.root, collapsed, selected).map((row) => (
            <LayerRow
              key={row.node.key}
              node={row.node}
              depth={row.depth}
              inComponent={row.inComponent}
              selectionRole={row.selectionRole}
              selectionEdge={row.selectionEdge}
              hovered={row.node.key === hovered}
              collapsed={collapsed.has(row.node.key)}
              onToggle={onToggle}
            />
          ))
        ) : (
          <div key={frame.name} className="layer artboard failed">
            <span className="twisty empty-twisty" />
            <FailedFrameIcon size={13} />
            <span className="type">{frame.name}</span>
            <span className="detail">failed to render</span>
          </div>
        ),
      )}
    </Section>
  );
}
