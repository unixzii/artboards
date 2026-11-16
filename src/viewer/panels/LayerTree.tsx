import { ChevronDown, ChevronRight } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { MASK_TYPE } from "../../shared/scene.ts";
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
  maskDistance: number;
}

// Memoised: hovering changes two rows, not the whole tree.
const LayerRow = memo(function LayerRow(props: {
  node: ViewNode;
  depth: number;
  inComponent: boolean;
  selectionRole: SelectionRole;
  selectionEdge: SelectionEdge;
  maskDistance: number;
  startsFrame: boolean;
  hovered: boolean;
  collapsed: boolean;
  onToggle: (key: string) => void;
}) {
  const { node, depth, inComponent, selectionRole, selectionEdge, maskDistance, startsFrame, hovered, collapsed, onToggle } = props;
  const viewer = useViewer();
  const row = useRef<HTMLDivElement>(null);
  const isRootSelected = selectionRole === "root";

  useEffect(() => {
    if (isRootSelected) row.current?.scrollIntoView({ block: "nearest" });
  }, [isRootSelected]);

  const isArtboard = node === node.frame.root;
  const comp = node.component;
  const hasChildren = node.children.length > 0;
  const className = [
    "layer",
    isArtboard && "artboard",
    startsFrame && "frame-start",
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
      <span className="layer-icon-slot">
        <LayerIcon node={node} size={13} />
        {maskDistance > 0 && (
          <span className="layer-mask-link" style={{ "--mask-distance": maskDistance } as CSSProperties} aria-hidden="true" />
        )}
      </span>
      <span className="type">{isArtboard ? node.frame.name : comp ? comp.name : node.type}</span>
      <span className="detail">{isArtboard ? node.type : describe(node)}</span>
      {node.parent?.type === MASK_TYPE && <span className="mask-label">Mask</span>}
    </div>
  );
});

function walkVisible(
  node: ViewNode,
  depth: number,
  expanded: ReadonlySet<string>,
  selectedKey: string | null,
  inSelected: boolean,
  parentInComponent: boolean,
  out: FlatRow[],
) {
  const isSelected = node.key === selectedKey;
  const inComponent = parentInComponent || Boolean(node.component);
  const selectionRole: SelectionRole = isSelected ? "root" : inSelected ? "descendant" : "none";
  // The slot belongs to the rendering tree. In the sidebar its layers sit
  // alongside their target and stay visible when the target is collapsed.
  let maskRow: number | undefined;
  for (const mask of node.mask?.children ?? []) {
    maskRow = walkVisible(mask, depth, expanded, selectedKey, inSelected, inComponent, out);
  }
  const row = out.length;
  out.push({ node, depth, inComponent, selectionRole, selectionEdge: "none", maskDistance: maskRow === undefined ? 0 : row - maskRow });
  if (expanded.has(node.key)) {
    for (const child of node.children) {
      walkVisible(child, depth + 1, expanded, selectedKey, isSelected || inSelected, inComponent, out);
    }
  }
  return row;
}

function buildRows(root: ViewNode, expanded: ReadonlySet<string>, selectedKey: string | null): FlatRow[] {
  const rows: FlatRow[] = [];
  walkVisible(root, 0, expanded, selectedKey, false, false, rows);
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
  // Everything starts collapsed. Keys are stable across rebuilds, so this survives reloads of the file.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  // Selecting a layer expands just its ancestors, so its row shows; the layer itself stays as it was.
  useEffect(() => {
    const node = viewer.node(selected);
    if (!node) return;
    setExpanded((prev) => {
      let next: Set<string> | null = null;
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (parent.type === MASK_TYPE) {
          if (!parent.parent) break;
          parent = parent.parent;
          continue;
        }
        if (!prev.has(parent.key)) {
          next ??= new Set(prev);
          next.add(parent.key);
        }
      }
      return next ?? prev;
    });
  }, [viewer, selected]);

  const onToggle = useCallback((key: string) => {
    setExpanded((prev) => {
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
          buildRows(frame.root, expanded, selected).map((row, index) => (
            <LayerRow
              key={row.node.key}
              node={row.node}
              depth={row.depth}
              inComponent={row.inComponent}
              selectionRole={row.selectionRole}
              selectionEdge={row.selectionEdge}
              maskDistance={row.maskDistance}
              startsFrame={index === 0}
              hovered={row.node.key === hovered}
              collapsed={!expanded.has(row.node.key)}
              onToggle={onToggle}
            />
          ))
        ) : (
          <div key={frame.name} className="layer artboard frame-start failed">
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
