// Dev server endpoints.

import type { Diagnostic } from "../../shared/diagnostics.ts";
import type { BuildPayload, Comment, NewComment } from "../../shared/protocol.ts";

const JSON_HEADERS = { "content-type": "application/json" };

export async function fetchBuild(): Promise<BuildPayload> {
  return (await fetch("/api/build")).json();
}

export interface ServerEventHandlers {
  onBuild(payload: BuildPayload): void;
  onTypecheck(diagnostics: Diagnostic[]): void;
  onComments(comments: Comment[]): void;
}

/** Subscribes to server build, background typecheck, and comment updates. */
export function subscribeEvents(handlers: ServerEventHandlers): () => void {
  const events = new EventSource("/api/events");
  events.addEventListener("build", (e) => handlers.onBuild(JSON.parse((e as MessageEvent).data)));
  events.addEventListener("typecheck", (e) => handlers.onTypecheck(JSON.parse((e as MessageEvent).data)));
  events.addEventListener("comments", (e) => handlers.onComments(JSON.parse((e as MessageEvent).data)));
  return () => events.close();
}

export async function postComment(comment: NewComment): Promise<boolean> {
  return (await fetch("/api/comments", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(comment) })).ok;
}

export function setCommentResolved(id: number, resolved: boolean) {
  return fetch(`/api/comments/${id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ resolved }) });
}

export function deleteComment(id: number) {
  return fetch(`/api/comments/${id}`, { method: "DELETE", headers: JSON_HEADERS, body: "{}" });
}
