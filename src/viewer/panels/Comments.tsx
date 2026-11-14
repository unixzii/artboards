import { Check, RotateCcw, Trash2 } from "lucide-react";
import type { ResolvedComment } from "../../shared/protocol.ts";
import { CommentNumber, Empty, LinkButton, ListItem } from "../components/primitives.tsx";
import { Section } from "../components/Section.tsx";
import { useViewer, useViewerState } from "../core/context.ts";

function CommentItem({ comment }: { comment: ResolvedComment }) {
  const viewer = useViewer();
  return (
    <ListItem
      tone={comment.resolved ? "resolved" : undefined}
      onClick={() => viewer.focusComment(comment)}
      head={
        <>
          <CommentNumber id={comment.id} />
          <span>
            {comment.frame} {comment.target}
          </span>
          {!comment.attached && <span className="badge">layer changed</span>}
        </>
      }
      actions={
        <>
          <LinkButton onClick={() => viewer.setCommentResolved(comment.id, !comment.resolved)}>
            {comment.resolved ? <RotateCcw size={11} /> : <Check size={11} />}
            <span>{comment.resolved ? "Reopen" : "Resolve"}</span>
          </LinkButton>
          <LinkButton onClick={() => viewer.deleteComment(comment.id)}>
            <Trash2 size={11} />
            <span>Delete</span>
          </LinkButton>
        </>
      }
    >
      {comment.text}
    </ListItem>
  );
}

export function Comments() {
  const comments = useViewerState((s) => s.comments);
  // Open comments first, then by id.
  const sorted = [...comments].sort((a, b) => Number(a.resolved) - Number(b.resolved) || a.id - b.id);
  const open = comments.filter((c) => !c.resolved).length;
  return (
    <Section id="comments" title="Comments" count={comments.length ? `(${open} open)` : ""} resizable defaultHeight={240}>
      {sorted.length === 0 && <Empty>No comments. Press C, then click a layer.</Empty>}
      {sorted.map((c) => (
        <CommentItem key={c.id} comment={c} />
      ))}
    </Section>
  );
}
