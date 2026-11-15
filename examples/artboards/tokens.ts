// Artboards — brand tokens. The palette is the viewer's own: zinc neutrals,
// the selection blue, the component purple and the comment-pin amber.

import { defineFont } from "artboards";
import calSansRegular from "./fonts/CalSans-Regular.ttf";

export const color = {
  ink: "#18181b", // primary text
  muted: "#71717a", // secondary text
  subtle: "#a1a1aa", // labels, placeholders
  line: "#e4e4e7", // hairlines, artboard borders
  dot: "#d4d4d8", // canvas grid
  canvas: "#fafafa", // the canvas behind artboards
  surface: "#ffffff", // artboards
  skeleton: "#f1f1f3", // placeholder content inside ghost artboards
  accent: "#2563eb", // selection
  accentSoft: "#dbe7ff",
  agent: "#7c3aed", // the agent's cursor
  pin: "#f59e0b", // comment pins
};

/** Cal Sans (SIL OFL, from Google Fonts) ships one weight; use it at 400. */
const calSans = defineFont("Cal Sans", [{ src: calSansRegular, weight: 400 }]);

export const font = {
  display: calSans,
  body: "Inter",
  mono: "JetBrains Mono",
};
