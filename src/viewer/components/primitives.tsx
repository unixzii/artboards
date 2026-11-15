// Domain-agnostic presentational primitives shared across viewer panels and toolbar.

import type { MouseEvent, ReactNode } from "react";

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
    <button type="button" className="link" title={props.title} onClick={click}>
      {props.children}
    </button>
  );
}

/**
 * A row of related buttons.
 * - `outline`: bordered, with dividers.
 * - `plain`: no outline; only the active button gets a background.
 * - `segmented`: a filled track; the active button is a raised thumb.
 */
export function ButtonGroup({ label, look = "outline", children }: { label?: string; look?: "outline" | "plain" | "segmented"; children: ReactNode }) {
  return (
    <div className={look === "outline" ? "group" : `group ${look}`} role="group" aria-label={label}>
      {children}
    </div>
  );
}

export function GroupButton(props: { id?: string; title: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" id={props.id} title={props.title} className={props.active ? "on" : undefined} aria-pressed={props.active} onClick={props.onClick}>
      {props.children}
    </button>
  );
}

/** The numbered badge that identifies a comment in lists. */
export function CommentNumber({ id }: { id: number }) {
  return <span className="num">{id}</span>;
}
