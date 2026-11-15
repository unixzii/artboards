// The app icon: the name's initial on a dark tile, framed by a # of guide
// lines like a layer on a canvas. 64×64, with every line on a multiple of
// 4 px so it stays sharp at 32 and 16 px. Shape picks where it goes:
//   Rounded  the favicon. Render with --transparent, so the corners outside
//            the tile stay clear, at 0.5× (32×32).
//   Square   Apple's home-screen icon: iOS rounds the corners itself and
//            would fill transparent ones with black. Render at 2.8125× (180×180).

import { Frame, Rect, Row, Text, useVariant } from "artboards";
import { color, font } from "./tokens.ts";

const BLUE = "#3b82f6";

/** The # lines: each 4 px wide, crossing around a 32 × 32 cell in the middle, and stopping short of the corners. */
const LINES = [12, 48];
const LINE = 4;
const INSET = 8;

export function Icon() {
  const [shape] = useVariant("Shape", ["Rounded", "Square"]);
  const span = 64 - 2 * INSET;
  return (
    <Frame width={64} height={64} fill={color.ink} cornerRadius={shape === "Rounded" ? 16 : 0}>
      {LINES.map((at) => (
        <Rect key={`v${at}`} name="guide" x={at} y={INSET} width={LINE} height={span} fill={BLUE} />
      ))}
      {LINES.map((at) => (
        <Rect key={`h${at}`} name="guide" x={INSET} y={at} width={span} height={LINE} fill={BLUE} />
      ))}
      <Row name="cell" x={16} y={16} width={32} height={32} align="center" justify="center">
        <Text fontFamily={font.display} fontSize={36} lineHeight={32} color="#ffffff">
          A
        </Text>
      </Row>
    </Frame>
  );
}
