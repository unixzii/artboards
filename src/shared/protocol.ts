// What the viewer receives from the dev server, or finds baked into a static
// site's index.html. Types and constants only, so both sides can import it
// without pulling in each other's runtime code.

import type { Comment, NewComment, ResolvedComment } from "./comments.ts";
import type { Diagnostic } from "./diagnostics.ts";

export type { Comment, NewComment, ResolvedComment };

/** id of the `<script type="application/json">` in a static site's index.html that holds its BuildPayload. */
export const STATIC_BUILD_ELEMENT = "artboards-build";

/** Build state sent by the dev server or baked into a static site; the design itself executes in the browser. */
export interface BuildPayload {
  file: string;
  /** Monotonic bundle id for `/design.js?v=${version}`, or null when bundling failed. */
  version: number | null;
  /** Bundler errors when the design failed to compile. */
  buildErrors: Diagnostic[];
  /** Latest `tsc` diagnostics, updated asynchronously in the background. */
  typeErrors: Diagnostic[];
  /** Raw review comments stored next to the design file. */
  comments: Comment[];
}
