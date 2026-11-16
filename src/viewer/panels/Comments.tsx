import { Check, Download, RotateCcw, Trash2 } from "lucide-react";
import type { ResolvedComment } from "../../shared/protocol.ts";
import { ButtonGroup, CommentNumber, Empty, GroupButton, LinkButton, ListItem } from "../components/primitives.tsx";
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
          <span className="where">
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
  const viewer = useViewer();
  const comments = useViewerState((s) => s.comments);
  const isStatic = useViewerState((s) => s.mode === "static");
  // Open comments first, then by id.
  const sorted = [...comments].sort((a, b) => Number(a.resolved) - Number(b.resolved) || a.id - b.id);
  return (
    <Section
      id="comments"
      title="Comments"
      resizable
      defaultHeight={240}
      actions={
        isStatic && (
          <ButtonGroup label="Comments" look="plain">
            <GroupButton title="Export comments to a file (they are saved in this browser only)" onClick={() => viewer.exportComments()}>
              <Download size={14} />
            </GroupButton>
          </ButtonGroup>
        )
      }
    >
      {sorted.length === 0 && (
        <Empty>
          No comments. Press C, then click a layer.
          {isStatic && " They stay in this browser until exported."}
        </Empty>
      )}
      {sorted.map((c) => (
        <CommentItem key={c.id} comment={c} />
      ))}
    </Section>
  );
}
