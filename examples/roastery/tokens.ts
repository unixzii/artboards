// 焙刻 Roastery — design tokens shared by every surface.

export const color: Record<string, string> = {
  espresso: "#2b1a12", // primary text
  roast: "#5b3420", // brand, primary actions
  roastHover: "#4a2a19",
  caramel: "#c4773b", // accent fills, large text only
  caramelText: "#a65f2a", // accent text at body sizes
  caramelSoft: "#f3e1cf",
  crema: "#f6efe6", // app background
  foam: "#fffaf4", // raised surfaces
  white: "#ffffff",
  oat: "#e9dccd", // hairlines, borders
  oatStrong: "#d6c4b1",
  muted: "#6f5d51", // secondary text
  subtle: "#7d6a5c", // tertiary text, placeholders
  sage: "#3f6b4b", // success
  sageSoft: "#e3efe4",
  amber: "#7f5605", // warning text
  amberSoft: "#fbefd2",
  tomato: "#b4372a", // danger
  tomatoSoft: "#f9e1dd",
  sky: "#2f6690", // info
  skySoft: "#e1edf6",
  scrim: "rgba(28, 17, 11, 0.48)",
};

export const font = {
  display: "Fraunces",
  body: "Inter",
  mono: "JetBrains Mono",
};

/** Type scale: [fontSize, lineHeight]. */
export const type: Record<string, [number, number]> = {
  caption: [11, 14],
  footnote: [12, 16],
  body: [14, 20],
  callout: [15, 22],
  headline: [17, 24],
  title3: [20, 26],
  title2: [24, 30],
  title1: [32, 38],
  display: [44, 48],
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

export const shadow: Record<"card" | "float" | "sheet", Shadow | Shadow[]> = {
  card: [
    { y: 1, blur: 2, color: "rgba(43, 26, 18, 0.06)" },
    { y: 8, blur: 24, spread: -4, color: "rgba(43, 26, 18, 0.10)" },
  ],
  float: [
    { y: 4, blur: 12, color: "rgba(43, 26, 18, 0.10)" },
    { y: 16, blur: 40, spread: -8, color: "rgba(43, 26, 18, 0.28)" },
  ],
  sheet: { y: -8, blur: 32, color: "rgba(28, 17, 11, 0.18)" },
};

import type { Shadow } from "artboards";

