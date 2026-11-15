// Artboards — brand tokens. The palette is the viewer's own: zinc neutrals,
// the selection blue, the component purple and the comment-pin amber.

import { defineFont } from "artboards";
import calSansRegular from "./fonts/CalSans-Regular.ttf";

export const color = {
  ink: "#18181b", // primary text
  muted: "#71717a", // secondary text
  mutedStrong: "#63636b", // secondary text on tinted fills
  subtle: "#a1a1aa", // labels, placeholders
  line: "#e4e4e7", // hairlines, artboard borders
  dot: "#d4d4d8", // canvas grid
  canvas: "#fafafa", // the canvas behind artboards
  surface: "#ffffff", // artboards
  skeleton: "#f1f1f3", // placeholder content inside ghost artboards
  accent: "#2563eb", // selection
  accentSoft: "#dbe7ff",
  accentStrong: "#1d4ed8", // accent text on accentSoft
  agent: "#7c3aed", // the agent's cursor
  pin: "#f59e0b", // comment pins
  danger: "#dc2626", // lint problems drawn on the canvas
  chrome: "#f4f4f5", // window title bars
};

/** Code in a light editor. Every colour passes 4.5:1 on white. */
export const syntax = {
  tag: "#2563eb",
  attr: "#7c3aed",
  value: "#b45309",
  keyword: "#be185d",
  punct: "#63636b",
  text: "#18181b",
};

/** A dark terminal, in the viewer's dark palette. */
export const term = {
  bg: "#18181b",
  bar: "#27272a",
  dot: "#52525b",
  text: "#e4e4e7",
  dim: "#a1a1aa",
  ok: "#4ade80",
  warn: "#fbbf24",
  path: "#60a5fa",
  agent: "#c4b5fd",
};

/** Cal Sans (SIL OFL, from Google Fonts) ships one weight; use it at 400. */
const calSans = defineFont("Cal Sans", [{ src: calSansRegular, weight: 400 }]);

export const font = {
  display: calSans,
  body: "Inter",
  mono: "JetBrains Mono",
};
