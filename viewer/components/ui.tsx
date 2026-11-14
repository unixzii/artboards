// Small presentational pieces shared by the panels and the canvas overlay.

import type { CSSProperties, MouseEvent, ReactNode } from "react";
import type { Point } from "../model.ts";

/** A titled, scrollable block inside a side panel. */
export function Section(props: { id: string; title: string; count?: string; children: ReactNode }) {
  return (
    <>
      <h2>
        {props.title}{" "}
        <span id={`${props.id}-count`} className="count">
          {props.count}
        </span>
      </h2>
      <div id={props.id} className="scroll">
        {props.children}
      </div>
    </>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

/** Row in a problems or comments list: a muted head line, a body, optional actions. */
export function ListItem(props: {
  tone?: "error" | "warning" | "resolved";
  head: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div className={`item ${props.tone ?? ""}`} onClick={props.onClick}>
      <div className="head">{props.head}</div>
      <div className="body">{props.children}</div>
      {props.actions && <div className="actions">{props.actions}</div>}
    </div>
  );
}

/** Text-styled button. Does not trigger the click handler of the row it sits in. */
export function LinkButton(props: { onClick: () => void; title?: string; children: ReactNode }) {
  const click = (e: MouseEvent) => {
    e.stopPropagation();
    props.onClick();
  };
  return (
    <button className="link" title={props.title} onClick={click}>
      {props.children}
    </button>
  );
}

export function ButtonGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="group" role="group" aria-label={label}>
      {children}
    </div>
  );
}

export function GroupButton(props: { id?: string; title: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button id={props.id} title={props.title} className={props.active ? "on" : undefined} aria-pressed={props.active} onClick={props.onClick}>
      {props.children}
    </button>
  );
}

/** The numbered badge that identifies a comment in lists. */
export function CommentNumber({ id }: { id: number }) {
  return <span className="num">{id}</span>;
}

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
