// Pieces of the viewer's canvas, drawn as illustration: the dot grid, ghost
// artboards, the selection box with its size badge, and a named cursor.

import type { ReactNode } from "react";
import { Column, Frame, Path, Rect, Row, Text } from "artboards";
import { color, font } from "./tokens.ts";

/** A dot every `step` px across a width × height area, as one path. */
export function DotGrid({ width, height, step = 24 }: { width: number; height: number; step?: number }) {
  let d = "";
  for (let y = step / 2; y < height; y += step) {
    for (let x = step / 2; x < width; x += step) d += `M${x - 1} ${y}a1 1 0 1 0 2 0a1 1 0 1 0 -2 0`;
  }
  return <Path name="dot grid" absolute x={0} y={0} width={width} height={height} viewBox={[0, 0, width, height]} d={d} fill={color.dot} />;
}

/** Skeleton bars standing in for an artboard's content. */
function Bar({ width, height = 8, fill = color.skeleton }: { width: number | "fill"; height?: number; fill?: string }) {
  return <Rect width={width} height={height} fill={fill} cornerRadius={height / 2} />;
}

/** A faint artboard with its name above it, filled with skeleton content. */
export function GhostArtboard(props: {
  name: string;
  children?: ReactNode;
  kind: "phone" | "desktop";
  x?: number;
  y?: number;
  right?: number;
  bottom?: number;
  width: number;
  height: number;
  rotation?: number;
}) {
  const { name, kind, width, height, children, ...place } = props;
  return (
    <Column name={`ghost ${name}`} absolute {...place} gap={8}>
      <Text fontSize={12} fontWeight={500} color={color.muted}>
        {name}
      </Text>
      <Column
        width={width}
        height={height}
        fill={color.surface}
        stroke={color.line}
        cornerRadius={4}
        padding={kind === "phone" ? [28, 16] : 20}
        gap={kind === "phone" ? 12 : 14}
        clip
        shadow={{ y: 1, blur: 2, color: "rgba(24, 24, 27, 0.04)" }}
      >
        {kind === "phone" ? <PhoneContent /> : <DesktopContent />}
      </Column>
      {children}
    </Column>
  );
}

function PhoneContent() {
  return (
    <>
      <Bar width={96} height={12} fill={color.line} />
      <Rect width="fill" height={120} fill={color.skeleton} cornerRadius={10} />
      <Bar width="fill" />
      <Bar width={110} />
      <Row width="fill" gap={10}>
        <Rect width="fill" height={72} fill={color.skeleton} cornerRadius={8} />
        <Rect width="fill" height={72} fill={color.skeleton} cornerRadius={8} />
      </Row>
      <Bar width={140} />
      <Rect width="fill" height={36} fill={color.accentSoft} cornerRadius={18} />
    </>
  );
}

function DesktopContent() {
  return (
    <Row width="fill" height="fill" gap={16}>
      <Column width={64} height="fill" gap={10}>
        <Bar width={48} height={10} fill={color.line} />
        <Bar width={56} />
        <Bar width={40} />
        <Bar width={52} />
      </Column>
      <Column width="fill" height="fill" gap={12}>
        <Bar width={120} height={12} fill={color.line} />
        <Row width="fill" gap={10}>
          <Rect width="fill" height={56} fill={color.skeleton} cornerRadius={6} />
          <Rect width="fill" height={56} fill={color.skeleton} cornerRadius={6} />
          <Rect width="fill" height={56} fill={color.skeleton} cornerRadius={6} />
        </Row>
        <Rect width="fill" height="fill" fill={color.skeleton} cornerRadius={6} />
      </Column>
    </Row>
  );
}

/** A square selection handle centred on a corner of its parent. */
function Handle({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  const h = -4;
  const place = {
    tl: { x: h, y: h },
    tr: { right: h, y: h },
    bl: { x: h, bottom: h },
    br: { right: h, bottom: h },
  }[corner];
  return <Rect name={`handle ${corner}`} absolute {...place} width={8} height={8} fill={color.surface} stroke={color.accent} strokeWidth={1.5} />;
}

/** Draws the viewer's selection box around its child, with corner handles. */
export function Selection({ children, padding = 0, decoration }: { children: ReactNode; padding?: number; decoration?: ReactNode }) {
  return (
    <Row name="selection" padding={padding}>
      {children}
      <Rect name="outline" absolute x={0} y={0} right={0} bottom={0} stroke={color.accent} strokeWidth={1.5} />
      <Handle corner="tl" />
      <Handle corner="tr" />
      <Handle corner="bl" />
      <Handle corner="br" />
      {decoration}
    </Row>
  );
}

/** The blue badge under a selection that reads out its size. */
export function SizeBadge({ children }: { children: ReactNode }) {
  return (
    <Row name="size badge" height={22} padding={[0, 8]} align="center" fill={color.accent} cornerRadius={4}>
      <Text fontFamily={font.mono} fontSize={12} fontWeight={500} color="#ffffff" tabularNums>
        {children}
      </Text>
    </Row>
  );
}

/** A numbered comment pin, as the viewer drops it on a layer. */
export function CommentPin({ n, ...place }: { n: number; x?: number; y?: number; right?: number; bottom?: number }) {
  return (
    <Row
      name={`comment ${n}`}
      absolute
      {...place}
      width={28}
      height={28}
      align="center"
      justify="center"
      fill={color.pin}
      stroke="#ffffff"
      strokeWidth={2}
      strokeAlign="outside"
      cornerRadius={[14, 14, 14, 3]}
      shadow={{ y: 2, blur: 6, color: "rgba(24, 24, 27, 0.18)" }}
    >
      <Text fontSize={13} fontWeight={700} color={color.ink} tabularNums>
        {n}
      </Text>
    </Row>
  );
}

/** A multiplayer-style pointer with a name tag. */
export function Cursor({ label, tint, ...place }: { label: string; tint: string; x?: number; y?: number; right?: number; bottom?: number }) {
  return (
    <Frame name={`cursor ${label}`} absolute {...place} width={120} height={56}>
      <Path
        x={0}
        y={0}
        width={22}
        height={22}
        viewBox="0 0 24 24"
        d="M4 2.5 L4 19.5 L8.6 15.2 L11.6 21.8 L14.6 20.4 L11.7 14 L18 14 Z"
        fill={tint}
        stroke="#ffffff"
        strokeWidth={1.5}
        strokeJoin="round"
        shadow={{ y: 1, blur: 3, color: "rgba(24, 24, 27, 0.2)" }}
      />
      <Row x={16} y={22} height={24} padding={[0, 9]} align="center" fill={tint} cornerRadius={12} shadow={{ y: 2, blur: 6, color: "rgba(24, 24, 27, 0.16)" }}>
        <Text fontSize={13} fontWeight={600} color="#ffffff">
          {label}
        </Text>
      </Row>
    </Frame>
  );
}
