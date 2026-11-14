// Dev server endpoints.

import type { NewComment, ScenePayload } from "../../shared/protocol.ts";

const JSON_HEADERS = { "content-type": "application/json" };

export async function fetchScene(): Promise<ScenePayload> {
  return (await fetch("/api/scene")).json();
}

/** Calls back with every rebuilt scene. Returns a function that stops listening. */
export function subscribeScenes(onScene: (scene: ScenePayload) => void): () => void {
  const events = new EventSource("/api/events");
  events.addEventListener("scene", (e) => onScene(JSON.parse((e as MessageEvent).data)));
  return () => events.close();
}

// Each of these triggers a rebuild on the server; the result arrives as a scene event.

export async function postComment(comment: NewComment): Promise<boolean> {
  return (await fetch("/api/comments", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(comment) })).ok;
}

export function setCommentResolved(id: number, resolved: boolean) {
  return fetch(`/api/comments/${id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ resolved }) });
}

export function deleteComment(id: number) {
  return fetch(`/api/comments/${id}`, { method: "DELETE", headers: JSON_HEADERS, body: "{}" });
}
