// Roastery component library, shared by the mobile app, the barista board and
// the manager dashboard.
import { Column, Ellipse, Frame, Image, Path, Rect, Row, Span, Text } from "artboards";
import type { Fill, Size } from "artboards";
import type { ReactNode } from "react";
import type { Product } from "./data.ts";
import { yuan } from "./data.ts";
import { ICONS, type IconName } from "./icons.ts";
import { color, radius, shadow } from "./tokens.ts";

// ------------------------------------------------------------------ basics

export function Icon({ name, size = 20, tint = color.espresso, weight = 2 }: { name: IconName; size?: number; tint?: string; weight?: number }) {
  return (
    <Path
      name={`icon:${name}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      d={ICONS[name]}
      stroke={tint}
      strokeWidth={(weight * size) / 24}
      strokeCap="round"
      strokeJoin="round"
    />
  );
}

export function Divider({ inset = 0, tint = color.oat }: { inset?: number; tint?: string }) {
  return (
    <Row width="fill" padding={[0, 0, 0, inset]}>
      <Rect width="fill" height={1} fill={tint} />
    </Row>
  );
}

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

const BUTTON: Record<ButtonVariant, { fill?: string; text: string; stroke?: string }> = {
  primary: { fill: color.roast, text: color.white },
  secondary: { fill: color.caramelSoft, text: color.roast },
  outline: { fill: color.white, text: color.espresso, stroke: color.oatStrong },
  ghost: { text: color.roast },
  danger: { fill: color.tomato, text: color.white },
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  width,
  disabled = false,
  pressed = false,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  icon?: IconName;
  width?: Size;
  disabled?: boolean;
  pressed?: boolean;
}) {
  const v = BUTTON[variant];
  const h = size === "lg" ? 52 : size === "sm" ? 32 : 44;
  const fs = size === "lg" ? 16 : size === "sm" ? 13 : 15;
  const fill = pressed ? (variant === "primary" ? color.roastHover : variant === "ghost" ? color.caramelSoft : v.fill) : v.fill;
  return (
    <Row
      name={`Button/${variant}`}
      width={width}
      height={h}
      padding={[0, size === "sm" ? 12 : 20]}
      gap={6}
      align="center"
      justify="center"
      cornerRadius={h / 2}
      fill={fill}
      stroke={v.stroke}
      strokeAlign="inside"
      opacity={disabled ? 0.4 : 1}
      shadow={variant === "primary" && !disabled && !pressed ? { y: 4, blur: 12, color: "rgba(91, 52, 32, 0.28)" } : undefined}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 18} tint={v.text} />}
      <Text fontSize={fs} fontWeight={600} color={v.text}>
        {children}
      </Text>
    </Row>
  );
}

export function Chip({ children, selected = false, icon, size = "md" }: { children: ReactNode; selected?: boolean; icon?: IconName; size?: "sm" | "md" }) {
  const h = size === "sm" ? 28 : 34;
  return (
    <Row
      name="Chip"
      height={h}
      padding={[0, size === "sm" ? 10 : 14]}
      gap={6}
      align="center"
      cornerRadius={h / 2}
      fill={selected ? color.espresso : color.white}
      stroke={selected ? undefined : color.oat}
      strokeAlign="inside"
    >
      {icon && <Icon name={icon} size={14} tint={selected ? color.white : color.muted} />}
      <Text fontSize={size === "sm" ? 12 : 13} fontWeight={selected ? 600 : 500} color={selected ? color.white : color.espresso}>
        {children}
      </Text>
    </Row>
  );
}

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

export const TONES: Record<Tone, [bg: string, fg: string]> = {
  neutral: [color.crema, color.muted],
  brand: [color.caramelSoft, color.roast],
  success: [color.sageSoft, color.sage],
  warning: [color.amberSoft, color.amber],
  danger: [color.tomatoSoft, color.tomato],
  info: [color.skySoft, color.sky],
};

export function Badge({ children, tone = "neutral", dot = false, solid = false }: { children: ReactNode; tone?: Tone; dot?: boolean; solid?: boolean }) {
  const [bg, fg] = TONES[tone];
  return (
    <Row name={`Badge/${tone}`} height={22} padding={[0, 8]} gap={5} align="center" cornerRadius={11} fill={solid ? fg : bg}>
      {dot && <Ellipse width={6} height={6} fill={solid ? color.white : fg} />}
      <Text fontSize={11} fontWeight={600} color={solid ? color.white : fg}>
        {children}
      </Text>
    </Row>
  );
}

/** ¥ and cents small, integer large; optional struck-through original price. */
export function Price({ value, was, size = 20, tint = color.espresso }: { value: number; was?: number; size?: number; tint?: string }) {
  const [int, cents] = value.toFixed(2).split(".");
  const small = Math.round(size * 0.6);
  return (
    <Text fontSize={small} fontWeight={600} color={tint} tabularNums>
      ¥<Span fontSize={size} fontWeight={700}>{int}</Span>.{cents}
      {was != null && " "}
      {was != null && (
        <Span fontWeight={400} color={color.muted} textDecoration="line-through">
          {yuan(was)}
        </Span>
      )}
    </Text>
  );
}

export function Stepper({ value, compact = false }: { value: number; compact?: boolean }) {
  const s = compact ? 24 : 30;
  return (
    <Row name="Stepper" gap={compact ? 8 : 12} align="center">
      <Row width={s} height={s} align="center" justify="center" cornerRadius={s / 2} stroke={color.oatStrong} strokeAlign="inside">
        <Icon name="minus" size={compact ? 12 : 14} />
      </Row>
      <Text width={compact ? 14 : 18} textAlign="center" fontSize={compact ? 14 : 16} fontWeight={600} tabularNums color={color.espresso}>
        {value}
      </Text>
      <Row width={s} height={s} align="center" justify="center" cornerRadius={s / 2} fill={color.roast}>
        <Icon name="plus" size={compact ? 12 : 14} tint={color.white} />
      </Row>
    </Row>
  );
}

export function Segmented({ options, value, width = "fill" }: { options: string[]; value: string; width?: Size }) {
  return (
    <Row name="Segmented" width={width} height={40} padding={4} gap={4} fill={color.crema} cornerRadius={20} stroke={color.oat} strokeAlign="inside">
      {options.map((o) => {
        const on = o === value;
        return (
          <Row key={o} width="fill" height="fill" align="center" justify="center" cornerRadius={16} fill={on ? color.white : undefined} shadow={on ? { y: 1, blur: 3, color: "rgba(43, 26, 18, 0.14)" } : undefined}>
            <Text fontSize={13} fontWeight={on ? 600 : 500} color={on ? color.espresso : color.muted}>
              {o}
            </Text>
          </Row>
        );
      })}
    </Row>
  );
}

export function Input({
  label,
  value,
  placeholder = "",
  icon,
  state = "default",
  hint,
  width = "fill",
}: {
  label?: string;
  value?: string;
  placeholder?: string;
  icon?: IconName;
  state?: "default" | "focus" | "error";
  hint?: string;
  width?: Size;
}) {
  const ring = state === "error" ? color.tomato : state === "focus" ? color.roast : color.oat;
  return (
    <Column name="Input" width={width} gap={6} align="stretch">
      {label && (
        <Text fontSize={12} fontWeight={600} color={color.muted}>
          {label}
        </Text>
      )}
      <Row
        height={44}
        padding={[0, 14]}
        gap={10}
        align="center"
        fill={color.white}
        cornerRadius={radius.md}
        stroke={ring}
        strokeWidth={state === "default" ? 1 : 1.5}
        strokeAlign="inside"
        shadow={state === "focus" ? { spread: 3, color: "rgba(91, 52, 32, 0.12)" } : undefined}
      >
        {icon && <Icon name={icon} size={18} tint={color.muted} />}
        <Text width="fill" maxLines={1} fontSize={14} color={value ? color.espresso : color.subtle}>
          {value ?? placeholder}
        </Text>
      </Row>
      {hint && (
        <Text fontSize={12} color={state === "error" ? color.tomato : color.muted}>
          {hint}
        </Text>
      )}
    </Column>
  );
}

export function Avatar({ initials, size = 36, ring = false }: { initials: string; size?: number; ring?: boolean }) {
  return (
    <Row
      name="Avatar"
      width={size}
      height={size}
      align="center"
      justify="center"
      cornerRadius={size / 2}
      fill={{ type: "linear", angle: 135, stops: ["#965a30", "#5b3420"] }}
      stroke={ring ? color.white : undefined}
      strokeWidth={2}
      strokeAlign="outside"
    >
      <Text fontSize={Math.round(size * 0.38)} fontWeight={700} color={color.white}>
        {initials}
      </Text>
    </Row>
  );
}

export function ProgressBar({ value, tint = color.caramel, track = color.oat, height = 6 }: { value: number; tint?: Fill; track?: string; height?: number }) {
  return (
    <Row name="ProgressBar" width="fill" height={height} cornerRadius={height / 2} fill={track}>
      <Rect width="fill" grow={value} height={height} cornerRadius={height / 2} fill={tint} />
      {value < 1 && <Rect width="fill" grow={1 - value} height={height} />}
    </Row>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <Row width="fill" align="center" justify="space-between">
      <Text fontSize={17} fontWeight={700} color={color.espresso}>
        {title}
      </Text>
      {action && (
        <Row gap={2} align="center">
          <Text fontSize={13} color={color.muted}>
            {action}
          </Text>
          <Icon name="chevronRight" size={14} tint={color.muted} />
        </Row>
      )}
    </Row>
  );
}

// ------------------------------------------------------------------ charts

type Point = [number, number];

/** Smooth line through points (Catmull-Rom as cubic Béziers). */
export function smoothPath(points: Point[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0][0]} ${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/** Data -> points inside a w x h box, scaled from `min` (bottom) to `max` (top). */
export function plot(data: number[], w: number, h: number, max = Math.max(...data), pad = 2, min = 0): Point[] {
  const step = w / (data.length - 1);
  return data.map((v, i) => [Math.round(i * step * 10) / 10, pad + (h - pad * 2) * (1 - (v - min) / (max - min || 1))]);
}

export function Sparkline({ data, width = 96, height = 32, tint = color.caramel }: { data: number[]; width?: number; height?: number; tint?: string }) {
  // Trends, not totals: use the data's own range so small moves stay visible.
  const lo = Math.min(...data);
  const hi = Math.max(...data);
  const line = smoothPath(plot(data, width, height, hi + (hi - lo) * 0.15, 3, lo - (hi - lo) * 0.6));
  return (
    <Frame name="Sparkline" width={width} height={height}>
      <Path width={width} height={height} viewBox={[0, 0, width, height]} d={`${line} L ${width} ${height} L 0 ${height} Z`} fill={{ type: "linear", angle: 180, stops: [`${tint}44`, `${tint}00`] }} />
      <Path width={width} height={height} viewBox={[0, 0, width, height]} d={line} stroke={tint} strokeWidth={2} strokeCap="round" strokeJoin="round" />
    </Frame>
  );
}

// ------------------------------------------------------------------ device chrome

export function StatusBar({ tint = color.espresso }: { tint?: string }) {
  return (
    <Row name="StatusBar" width="fill" height={50} padding={[18, 30, 0, 44]} justify="space-between" align="center">
      <Text fontSize={16} fontWeight={600} color={tint} tabularNums>
        9:41
      </Text>
      <Row gap={6} align="center">
        <Row gap={2} align="end" height={11}>
          {[4, 6, 8, 11].map((h) => (
            <Rect key={h} width={3} height={h} cornerRadius={1} fill={tint} />
          ))}
        </Row>
        <Path width={16} height={12} viewBox="0 0 16 12" d="M 1 4 C 5 0 11 0 15 4 M 3.5 6.8 C 6 4.6 10 4.6 12.5 6.8 M 6 9.5 C 7.2 8.5 8.8 8.5 10 9.5" stroke={tint} strokeWidth={1.7} strokeCap="round" />
        <Row gap={1} align="center">
          <Row width={24} height={12} padding={2} cornerRadius={3.5} stroke={tint} strokeAlign="inside">
            <Rect width={16} height="fill" cornerRadius={1.5} fill={tint} />
          </Row>
          <Rect width={1.5} height={4} cornerRadius={[0, 1, 1, 0]} fill={tint} opacity={0.5} />
        </Row>
      </Row>
    </Row>
  );
}

export function HomeIndicator({ tint = color.espresso }: { tint?: string }) {
  return (
    <Row width="fill" height={34} align="center" justify="center">
      <Rect width={134} height={5} cornerRadius={3} fill={tint} />
    </Row>
  );
}

const TABS: [IconName, string][] = [
  ["house", "首页"],
  ["coffee", "点单"],
  ["receipt", "订单"],
  ["user", "我的"],
];

/** Pinned to the bottom of its parent, frosted over the content. */
export function TabBar({ active }: { active: string }) {
  return (
    <Column name="TabBar" absolute x={0} bottom={0} width="fill" fill="rgba(255, 250, 244, 0.86)" backdropBlur={20} stroke={color.oat} strokeWidth={[1, 0, 0, 0]} strokeAlign="inside" align="stretch">
      <Row height={56} padding={[6, 12, 0, 12]}>
        {TABS.map(([icon, label]) => {
          const on = label === active;
          return (
            <Column key={label} width="fill" gap={3} align="center">
              <Icon name={icon} size={22} tint={on ? color.roast : color.muted} weight={on ? 2.2 : 1.8} />
              <Text fontSize={10} fontWeight={on ? 700 : 500} color={on ? color.roast : color.muted}>
                {label}
              </Text>
            </Column>
          );
        })}
      </Row>
      <HomeIndicator />
    </Column>
  );
}

/** An iPhone-sized artboard. */
export function Phone({ children, fill = color.crema }: { children: ReactNode; fill?: Fill }) {
  return (
    <Frame width={390} height={844} fill={fill} clip>
      {children}
    </Frame>
  );
}

// ------------------------------------------------------------------ product

export function ProductCard({ product, count = 0 }: { product: Product; count?: number }) {
  return (
    <Column name="ProductCard" padding={8} gap={10} fill={color.white} cornerRadius={radius.lg} shadow={shadow.card} align="stretch">
      <Frame width="fill" height={132} cornerRadius={12} clip>
        <Image src={product.image} width="fill" height="fill" />
        {product.tag && (
          <Row x={8} y={8} height={20} padding={[0, 7]} align="center" cornerRadius={6} fill="rgba(43, 26, 18, 0.72)" backdropBlur={6}>
            <Text fontSize={10} fontWeight={600} color={color.white}>
              {product.tag}
            </Text>
          </Row>
        )}
      </Frame>
      <Column gap={2} padding={[0, 4]} align="stretch">
        <Text width="fill" maxLines={1} fontSize={14} fontWeight={600} color={color.espresso}>
          {product.name}
        </Text>
        <Text width="fill" maxLines={1} fontSize={11} color={color.muted}>
          {product.desc}
        </Text>
      </Column>
      <Row padding={[0, 4, 4, 4]} align="center" justify="space-between">
        <Price value={product.price} size={17} />
        {count > 0 ? (
          <Stepper value={count} compact />
        ) : (
          <Row width={28} height={28} align="center" justify="center" cornerRadius={14} fill={color.roast}>
            <Icon name="plus" size={16} tint={color.white} weight={2.4} />
          </Row>
        )}
      </Row>
    </Column>
  );
}
