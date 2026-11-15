// Where the viewer gets builds from and keeps comments. `artboards dev` serves
// both and stores comments next to the design; a site from `artboards build`
// has its build baked into index.html and keeps comments in this browser until
// they are exported.

import { appendNew, createComment, sameComment } from "../../shared/comments.ts";
import type { Diagnostic } from "../../shared/diagnostics.ts";
import { STATIC_BUILD_ELEMENT, type BuildPayload, type Comment, type NewComment } from "../../shared/protocol.ts";

export interface BackendHandlers {
  onBuild(payload: BuildPayload): void;
  onTypecheck(diagnostics: Diagnostic[]): void;
  onComments(comments: Comment[]): void;
}

export interface Backend {
  /** "static": a site from `artboards build`, with no server behind it. */
  readonly mode: "dev" | "static";
  /** Starts delivering builds, type errors and comments. Returns the teardown. */
  connect(handlers: BackendHandlers): () => void;
  /** Resolves to false when the comment could not be saved. */
  addComment(comment: NewComment): Promise<boolean>;
  setCommentResolved(id: number, resolved: boolean): Promise<void>;
  deleteComment(id: number): Promise<void>;
  /** Static sites only: downloads the comments as a `<name>.comments.json` file. */
  exportComments?(): void;
}

/** The backend for this page: static when index.html carries a build, else the dev server. */
export function detectBackend(): Backend {
  const baked = document.getElementById(STATIC_BUILD_ELEMENT);
  return baked ? new StaticBackend(JSON.parse(baked.textContent ?? "")) : new DevBackend();
}

// ------------------------------------------------------------------ dev server

const JSON_HEADERS = { "content-type": "application/json" };

// Relative URLs, like every URL the viewer loads, so a site works under any path.
class DevBackend implements Backend {
  readonly mode = "dev";

  connect(handlers: BackendHandlers) {
    fetch("api/build")
      .then((r) => r.json())
      .then(handlers.onBuild)
      .catch((e) => console.error(e));
    const events = new EventSource("api/events");
    events.addEventListener("build", (e) => handlers.onBuild(JSON.parse((e as MessageEvent).data)));
    events.addEventListener("typecheck", (e) => handlers.onTypecheck(JSON.parse((e as MessageEvent).data)));
    events.addEventListener("comments", (e) => handlers.onComments(JSON.parse((e as MessageEvent).data)));
    return () => events.close();
  }

  async addComment(comment: NewComment) {
    return (await fetch("api/comments", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(comment) })).ok;
  }

  async setCommentResolved(id: number, resolved: boolean) {
    await fetch(`api/comments/${id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ resolved }) });
  }

  async deleteComment(id: number) {
    await fetch(`api/comments/${id}`, { method: "DELETE", headers: JSON_HEADERS, body: "{}" });
  }
}

// ------------------------------------------------------------------ static site

/** What a static site keeps in localStorage: the comments it shipped with, and the current list. */
interface Stored {
  base: Comment[];
  comments: Comment[];
}

class StaticBackend implements Backend {
  readonly mode = "static";
  private build: BuildPayload;
  private key: string;
  private comments: Comment[];
  private handlers: BackendHandlers | null = null;

  constructor(build: BuildPayload) {
    this.build = build;
    // One list per site and design; localStorage is already per origin.
    this.key = `artboards:comments:${new URL(".", location.href).pathname}:${build.file}`;
    this.comments = this.load();
  }

  connect(handlers: BackendHandlers) {
    this.handlers = handlers;
    handlers.onBuild({ ...this.build, comments: this.comments });
    return () => {
      this.handlers = null;
    };
  }

  async addComment(input: NewComment) {
    if (!String(input.text ?? "").trim()) return false;
    this.update([...this.comments, createComment(input, this.comments)]);
    return true;
  }

  async setCommentResolved(id: number, resolved: boolean) {
    this.update(this.comments.map((c) => (c.id === id ? { ...c, resolved } : c)));
  }

  async deleteComment(id: number) {
    this.update(this.comments.filter((c) => c.id !== id));
  }

  exportComments() {
    const name = (this.build.file.split("/").pop() ?? "design").replace(/\.[^.]+$/, "") + ".comments.json";
    const blob = new Blob([JSON.stringify(this.comments, null, 2) + "\n"], { type: "application/json" });
    const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  }

  private update(comments: Comment[]) {
    this.comments = comments;
    this.save();
    this.handlers?.onComments(comments);
  }

  /**
   * The stored list, unless the site was rebuilt with different comments since:
   * then the new ones, plus those written in this browser.
   */
  private load(): Comment[] {
    const baked = this.build.comments;
    let stored: Stored | undefined;
    try {
      stored = JSON.parse(localStorage.getItem(this.key) ?? "null") ?? undefined;
    } catch {
      // Storage blocked or unreadable: start from the shipped comments.
    }
    if (!stored) return baked;
    if (JSON.stringify(stored.base) === JSON.stringify(baked)) return stored.comments;
    const written = stored.comments.filter((c) => !stored.base.some((b) => sameComment(b, c)));
    return appendNew(baked, written);
  }

  private save() {
    try {
      localStorage.setItem(this.key, JSON.stringify({ base: this.build.comments, comments: this.comments } satisfies Stored));
    } catch (e) {
      console.warn("Could not save comments in this browser:", e);
    }
  }
}
