// Building blocks of the website's feature pages: the page layout, windows,
// terminal and editor lines, and small marks drawn on the canvas.

import type { ReactNode } from "react";
import { Column, Ellipse, Fragment, Frame, Rect, Row, Span, Text } from "artboards";
import { DotGrid } from "./canvas.tsx";
import { color, font, syntax, term } from "./tokens.ts";

export const PAGE = { width: 960, height: 560 };

type Place = { x?: number; y?: number; right?: number; bottom?: number };

/**
 * A feature page: the canvas, a text column on the left and an illustration
 * area on the right (528 × 464). Children are placed in that area with x/y.
 */
export function FeaturePage(props: { n: number; label: string; title: string; body: ReactNode; command?: string; children: ReactNode }) {
  const { n, label, title, body, command, children } = props;
  return (
    <Frame width={PAGE.width} height={PAGE.height} fill={color.canvas} clip>
      <DotGrid width={PAGE.width} height={PAGE.height} />
      <Row x={0} y={0} width="fill" height="fill" padding={[48, 56]} gap={40} align="center">
        <Column name="copy" width={280} gap={16}>
          <Text fontFamily={font.mono} fontSize={13} fontWeight={500} color={color.accent}>
            {String(n).padStart(2, "0")} · {label}
          </Text>
          <Text width="fill" fontFamily={font.display} fontSize={40} lineHeight={44} color={color.ink}>
            {title}
          </Text>
          <Text width="fill" fontSize={16} lineHeight={25} color={color.muted}>
            {body}
          </Text>
          {command ? <CommandChip>{command}</CommandChip> : null}
        </Column>
        <Frame name="illustration" width="fill" height="fill">
          {children}
        </Frame>
      </Row>
    </Frame>
  );
}

/** Inline code inside body text. */
export function Code({ children }: { children: string }) {
  return (
    <Span fontFamily={font.mono} fontSize={14} color={color.ink}>
      {children}
    </Span>
  );
}

/** A key to press, inside body text. */
export function Key({ children }: { children: string }) {
  return (
    <Span fontFamily={font.mono} fontSize={14} fontWeight={700} color={color.accent}>
      {children}
    </Span>
  );
}

/**
 * The viewer's segmented control, as the Properties panel shows a variant.
 * Each option calls `onPick` when clicked in Play mode.
 */
export function Segmented<T extends string>({ options, value, onPick }: { options: readonly T[]; value: T; onPick?: (value: T) => void }) {
  return (
    <Row name="segmented" padding={2} gap={2} fill="#f0f0f2" cornerRadius={8}>
      {options.map((option) => {
        const on = option === value;
        return (
          <Row
            key={option}
            height={24}
            padding={[0, 10]}
            align="center"
            fill={on ? color.surface : undefined}
            cornerRadius={6}
            shadow={on ? [{ y: 1, blur: 2, color: "rgba(0, 0, 0, 0.1)" }, { spread: 0.5, color: "rgba(0, 0, 0, 0.06)" }] : undefined}
            onClick={onPick ? () => onPick(option) : undefined}
          >
            <Text fontSize={12} fontWeight={on ? 600 : 400} color={on ? color.accent : color.mutedStrong}>
              {option}
            </Text>
          </Row>
        );
      })}
    </Row>
  );
}

/** A shell command set on its own, as a hint of what to type. */
export function CommandChip({ children }: { children: string }) {
  return (
    <Row height={32} padding={[0, 12]} gap={8} align="center" fill={color.surface} stroke={color.line} cornerRadius={6}>
      <Text fontFamily={font.mono} fontSize={13} color={color.muted}>
        $
      </Text>
      <Text fontFamily={font.mono} fontSize={13} color={color.ink}>
        {children}
      </Text>
    </Row>
  );
}

/**
 * A desktop window: title bar with traffic-light dots, then content. Placed
 * absolutely when given x/y/right/bottom. Its one border sits outside the box,
 * so the title bar's fill never covers it; the bar has no border of its own.
 */
export function Window(props: Place & { title: string; dark?: boolean; width: number; height?: number; children: ReactNode; name?: string }) {
  const { title, dark = false, width, height, children, name, ...place } = props;
  return (
    <Column
      name={name ?? `window ${title}`}
      absolute={Object.values(place).some((v) => v !== undefined)}
      {...place}
      width={width}
      height={height ?? "hug"}
      fill={dark ? term.bg : color.surface}
      stroke={dark ? term.bg : color.line}
      strokeAlign="outside"
      cornerRadius={10}
      clip
      shadow={[
        { y: 1, blur: 2, color: "rgba(24, 24, 27, 0.06)" },
        { y: 12, blur: 32, color: "rgba(24, 24, 27, 0.10)" },
      ]}
    >
      <Row
        name="title bar"
        width="fill"
        height={30}
        padding={[0, 12]}
        align="center"
        fill={dark ? term.bar : color.chrome}
      >
        <Row gap={6}>
          {[0, 1, 2].map((i) => (
            <Ellipse key={i} width={10} height={10} fill={dark ? term.dot : color.dot} />
          ))}
        </Row>
        <Text width="fill" textAlign="center" fontFamily={font.mono} fontSize={11} color={dark ? term.dim : color.mutedStrong}>
          {title}
        </Text>
        <Rect width={42} height={1} />
      </Row>
      {children}
    </Column>
  );
}

/** A terminal's content: lines of monospace text. */
export function Terminal({ children, gap = 6 }: { children: ReactNode; gap?: number }) {
  return (
    <Column width="fill" padding={[14, 16]} gap={gap}>
      {children}
    </Column>
  );
}

/** One terminal line; wraps at the window's width like a real terminal. */
export function Line({ children, color: tint = term.text, size = 12 }: { children: ReactNode; color?: string; size?: number }) {
  return (
    <Text width="fill" fontFamily={font.mono} fontSize={size} lineHeight={Math.round(size * 1.5)} color={tint}>
      {children}
    </Text>
  );
}

/** A prompt line: `$ command`. */
export function Prompt({ children, size }: { children: string; size?: number }) {
  return (
    <Line size={size}>
      <Span color={term.dim}>$ </Span>
      {children}
    </Line>
  );
}

/** Colour helpers for code in the editor. */
export const tok = {
  tag: (s: string) => <Span color={syntax.tag}>{s}</Span>,
  attr: (s: string) => <Span color={syntax.attr}>{s}</Span>,
  value: (s: string) => <Span color={syntax.value}>{s}</Span>,
  kw: (s: string) => <Span color={syntax.keyword}>{s}</Span>,
  p: (s: string) => <Span color={syntax.punct}>{s}</Span>,
};

/** Numbered lines of code; `highlight` is a 1-based line number. */
export function Editor({ lines, highlight, start = 1 }: { lines: ReactNode[][]; highlight?: number; start?: number }) {
  return (
    <Column width="fill" padding={[10, 0]}>
      {lines.map((parts, i) => {
        const n = start + i;
        const on = n === highlight;
        return (
          <Row key={n} width="fill" height={21} padding={[0, 14, 0, 0]} gap={14} align="center" fill={on ? "#eef4ff" : undefined}>
            <Rect width={2} height={21} fill={on ? color.accent : undefined} />
            <Text width={18} textAlign="right" fontFamily={font.mono} fontSize={12} color={on ? color.accent : syntax.punct} tabularNums>
              {n}
            </Text>
            <Text fontFamily={font.mono} fontSize={12.5} color={syntax.text}>
              {parts.map((part, j) => (
                <Fragment key={j}>{part}</Fragment>
              ))}
            </Text>
          </Row>
        );
      })}
    </Column>
  );
}

/** A small rounded label, e.g. a variant value or a file name. */
export function Tag({ children, tint = color.ink, fill = color.surface, mono = false }: { children: ReactNode; tint?: string; fill?: string; mono?: boolean }) {
  return (
    <Row height={24} padding={[0, 9]} align="center" fill={fill} stroke={fill === color.surface ? color.line : fill} cornerRadius={12}>
      <Text fontFamily={mono ? font.mono : font.body} fontSize={12} fontWeight={500} color={tint}>
        {children}
      </Text>
    </Row>
  );
}
