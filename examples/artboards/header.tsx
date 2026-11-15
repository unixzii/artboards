// The header image: the name, selected on a canvas, with an agent's cursor
// on it. Two sizes: the README banner (also GitHub's social preview) and the
// Open Graph card.
//
// The boards are smaller than the images they become, so their contents read
// at a comfortable size where the image is shown scaled down. Export them with
// --scale:
//   artboards render examples/artboards/index.tsx -f ReadmeHeader -s 2 -o .github/header.png    # 1920×960, the README image
//   artboards render examples/artboards/index.tsx -f OpenGraph -s 1.5    # 1200×630

import type { ReactNode } from "react";
import { Column, Frame, Text } from "artboards";
import { CommentPin, Cursor, DotGrid, GhostArtboard, Selection, SizeBadge } from "./canvas.tsx";
import { color, font } from "./tokens.ts";

/** The canvas, with `ghosts` (artboards at its edges) behind the selected name. */
function Header({ width, height, ghosts }: { width: number; height: number; ghosts: ReactNode }) {
  return (
    <Frame width={width} height={height} fill={color.canvas} clip>
      <DotGrid width={width} height={height} />
      {ghosts}

      <Column name="center" x={0} y={0} width="fill" height="fill" align="center" justify="center" gap={14}>
        <Selection padding={4} decoration={<Cursor label="agent" tint={color.agent} right={-118} bottom={-50} />}>
          <Text name="name" fontFamily={font.display} fontSize={132} fontWeight={400} lineHeight={136} color={color.ink}>
            Artboards
          </Text>
        </Selection>
        <SizeBadge>595 × 136</SizeBadge>
        <Text fontSize={22} color={color.muted}>
          Design UI as code, with your agents.
        </Text>
      </Column>
    </Frame>
  );
}

/** README banner and GitHub social preview: 960×480, exported at 2×. */
export function ReadmeHeader() {
  return (
    <Header
      width={960}
      height={480}
      ghosts={
        <>
          <GhostArtboard name="Onboarding" kind="phone" x={-60} y={-345} width={220} height={440} />
          <GhostArtboard name="Dashboard" kind="desktop" x={830} y={16} width={360} height={232} />
          <GhostArtboard name="Home" kind="phone" x={48} y={372} width={220} height={440}>
            <CommentPin n={1} x={176} y={34} />
          </GhostArtboard>
          <GhostArtboard name="Checkout" kind="phone" x={712} y={392} width={220} height={440} />
        </>
      }
    />
  );
}

/** Open Graph / Twitter card: 800×420, exported at 1.5× to 1200×630. */
export function OpenGraph() {
  return (
    <Header
      width={800}
      height={420}
      ghosts={
        <>
          <GhostArtboard name="Onboarding" kind="phone" x={-120} y={-380} width={220} height={440} />
          <GhostArtboard name="Dashboard" kind="desktop" x={730} y={-150} width={360} height={232} />
          <GhostArtboard name="Home" kind="phone" x={24} y={340} width={220} height={440}>
            <CommentPin n={1} x={176} y={34} />
          </GhostArtboard>
          <GhostArtboard name="Checkout" kind="phone" x={640} y={352} width={220} height={440} />
        </>
      }
    />
  );
}
