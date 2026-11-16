// Stress test benchmark: 200 dense artboards (~37,000+ scene nodes) across mobile,
// tablet kiosk, desktop analytics console, and design-system matrix surfaces.
// Exercises Taffy layout, Skia Paragraph shaping/rasterization, multi-level LOD
// SkPicture recording, WebGL tile caching/eviction, shadows, blurs, masks, and paths.
//
//   npm run dev -- examples/stress.tsx

import { Column, Ellipse, Frame, Grid, Image, Path, Rect, Row, Span, Text, useState, useVariant } from "artboards";
import type { ComponentType, ReactNode } from "react";
import { images, products } from "./roastery/data.ts";
import { ICONS, type IconName } from "./roastery/icons.ts";
import { font, radius, shadow } from "./roastery/tokens.ts";

// ------------------------------------------------------------------ themes & palettes

interface ThemePalette {
  id: string;
  label: string;
  city: string;
  store: string;
  bg: string;
  surface: string;
  card: string;
  border: string;
  borderStrong: string;
  ink: string;
  muted: string;
  brand: string;
  brandDark: string;
  brandSoft: string;
  accent: string;
  accentSoft: string;
  ok: string;
  okSoft: string;
  warn: string;
  warnSoft: string;
  danger: string;
  dangerSoft: string;
  heroStops: [string, string];
  sidebarBg: string;
  sidebarCard: string;
  sidebarInk: string;
  sidebarMuted: string;
}

const THEMES: ThemePalette[] = [
  {
    id: "Roast",
    label: "焙刻经典 · Classic Roast",
    city: "上海",
    store: "武康路烘焙旗舰店",
    bg: "#f6efe6",
    surface: "#fffaf4",
    card: "#ffffff",
    border: "#e9dccd",
    borderStrong: "#d6c4b1",
    ink: "#2b1a12",
    muted: "#635145",
    brand: "#5b3420",
    brandDark: "#3b2012",
    brandSoft: "#f3e1cf",
    accent: "#8f4e1e",
    accentSoft: "#faeadd",
    ok: "#2d5a3c",
    okSoft: "#e3efe4",
    warn: "#785004",
    warnSoft: "#fbefd2",
    danger: "#a32e22",
    dangerSoft: "#f9e1dd",
    heroStops: ["#4a2816", "#2b160c"],
    sidebarBg: "#1f140e",
    sidebarCard: "#2e1f16",
    sidebarInk: "#f7ede2",
    sidebarMuted: "#bfa999",
  },
  {
    id: "Matcha",
    label: "青山抹茶 · Kyoto Matcha",
    city: "杭州",
    store: "西湖灵隐茶咖工坊",
    bg: "#eef3ee",
    surface: "#f7faf7",
    card: "#ffffff",
    border: "#d5e0d5",
    borderStrong: "#b8cab8",
    ink: "#16261a",
    muted: "#485e4d",
    brand: "#234f32",
    brandDark: "#15331f",
    brandSoft: "#dfeee3",
    accent: "#3b6948",
    accentSoft: "#e6f2e9",
    ok: "#1f5c3a",
    okSoft: "#dff0e5",
    warn: "#755208",
    warnSoft: "#faefd4",
    danger: "#9e2d2b",
    dangerSoft: "#f8e2e1",
    heroStops: ["#1f472d", "#112919"],
    sidebarBg: "#111f15",
    sidebarCard: "#1b2f21",
    sidebarInk: "#eaf2ec",
    sidebarMuted: "#9eb5a4",
  },
  {
    id: "Nordic",
    label: "极光蓝调 · Nordic Fjord",
    city: "北京",
    store: "三里屯北欧概念店",
    bg: "#eef2f7",
    surface: "#f8fafd",
    card: "#ffffff",
    border: "#d7e0ec",
    borderStrong: "#bcc9db",
    ink: "#142030",
    muted: "#4a5b70",
    brand: "#1e4470",
    brandDark: "#122b47",
    brandSoft: "#dde8f6",
    accent: "#295a8f",
    accentSoft: "#e3eef9",
    ok: "#215c42",
    okSoft: "#e0f2ea",
    warn: "#785106",
    warnSoft: "#fcf0d5",
    danger: "#9e2b31",
    dangerSoft: "#f9e1e3",
    heroStops: ["#1a3b61", "#0f243c"],
    sidebarBg: "#0f1926",
    sidebarCard: "#19283b",
    sidebarInk: "#eaf0f8",
    sidebarMuted: "#9ab0c7",
  },
  {
    id: "Berry",
    label: "勃艮第红 · Velvet Berry",
    city: "成都",
    store: "太古里夜咖实验室",
    bg: "#f6eef1",
    surface: "#fcf7f9",
    card: "#ffffff",
    border: "#e8d5dc",
    borderStrong: "#d4bac4",
    ink: "#2a141d",
    muted: "#694c57",
    brand: "#69233b",
    brandDark: "#451526",
    brandSoft: "#f5dfe6",
    accent: "#852d4b",
    accentSoft: "#fae6ed",
    ok: "#26593e",
    okSoft: "#e2f0e8",
    warn: "#785004",
    warnSoft: "#fbefd2",
    danger: "#9c2828",
    dangerSoft: "#fae0e0",
    heroStops: ["#591c31", "#330e1b"],
    sidebarBg: "#210f16",
    sidebarCard: "#331923",
    sidebarInk: "#f7eaf0",
    sidebarMuted: "#c2a3b0",
  },
];

const PHOTO_LIST = [images.latte, images.iced, images.americano, images.pourOver, images.croissant, images.beans];
const ICON_KEYS = Object.keys(ICONS) as IconName[];

function artboard(name: string, render: () => ReactNode): ComponentType {
  const fn = () => render();
  Object.defineProperty(fn, "name", { value: name });
  return fn;
}

function seeded(seed: number, step: number): number {
  const x = Math.sin(seed * 97.13 + step * 31.7) * 10000;
  return x - Math.floor(x);
}

function seriesPoints(seed: number, count: number, min: number, max: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const wave = Math.sin((i / Math.max(1, count - 1)) * Math.PI * 1.8 + seed * 0.7) * 0.35 + 0.5;
    const jitter = (seeded(seed, i) - 0.5) * 0.25;
    const norm = Math.max(0.06, Math.min(0.95, wave + jitter));
    out.push(Math.round(min + norm * (max - min)));
  }
  return out;
}

function buildLinePath(values: number[], w: number, h: number, closeArea = false): string {
  if (values.length === 0) return `M0 ${h} L${w} ${h}`;
  const min = Math.min(...values);
  const max = Math.max(...values, min + 1);
  const pad = 4;
  const coords = values.map((v, i) => {
    const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w;
    const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as const;
  });
  let d = `M ${coords[0][0]} ${coords[0][1]}`;
  for (let i = 1; i < coords.length; i++) {
    const [x0, y0] = coords[i - 1];
    const [x1, y1] = coords[i];
    const cx = Math.round(((x0 + x1) / 2) * 10) / 10;
    d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
  }
  if (closeArea) {
    d += ` L ${w} ${h} L 0 ${h} Z`;
  }
  return d;
}

// ------------------------------------------------------------------ shared primitives

function Icon({ name, size = 18, tint = "#2b1a12", weight = 2 }: { name: IconName; size?: number; tint?: string; weight?: number }) {
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

function Pill({
  label,
  bg,
  fg,
  icon,
}: {
  label: string;
  bg: string;
  fg: string;
  icon?: IconName;
}) {
  return (
    <Row height={22} padding={[0, 8]} gap={4} align="center" cornerRadius={11} fill={bg}>
      {icon && <Icon name={icon} size={12} tint={fg} />}
      <Text fontSize={11} fontWeight={600} color={fg} maxLines={1}>
        {label}
      </Text>
    </Row>
  );
}

function SparklineCard({
  theme,
  title,
  value,
  delta,
  series,
  icon,
}: {
  theme: ThemePalette;
  title: string;
  value: string;
  delta: number;
  series: number[];
  icon: IconName;
}) {
  const up = delta >= 0;
  const toneFg = up ? theme.ok : theme.danger;
  const toneBg = up ? theme.okSoft : theme.dangerSoft;
  const w = 132;
  const h = 38;
  return (
    <Column
      width="fill"
      padding={14}
      gap={10}
      fill={theme.card}
      cornerRadius={radius.md}
      stroke={theme.border}
      strokeAlign="inside"
      shadow={shadow.card}
      align="stretch"
    >
      <Row align="center" justify="space-between">
        <Row gap={6} align="center">
          <Row width={26} height={26} align="center" justify="center" cornerRadius={8} fill={theme.brandSoft}>
            <Icon name={icon} size={14} tint={theme.brand} />
          </Row>
          <Text fontSize={12} fontWeight={600} color={theme.muted} maxLines={1}>
            {title}
          </Text>
        </Row>
        <Pill label={`${up ? "+" : ""}${delta.toFixed(1)}%`} bg={toneBg} fg={toneFg} icon={up ? "trendingUp" : "trendingDown"} />
      </Row>
      <Row align="end" justify="space-between" gap={8}>
        <Column gap={2}>
          <Text fontSize={22} fontWeight={700} tabularNums color={theme.ink}>
            {value}
          </Text>
          <Text fontFamily={font.mono} fontSize={10} color={theme.muted}>
            7D TREND · LIVE
          </Text>
        </Column>
        <Frame width={w} height={h}>
          <Path width={w} height={h} viewBox={`0 0 ${w} ${h}`} d={buildLinePath(series, w, h, true)} fill={toneBg} />
          <Path width={w} height={h} viewBox={`0 0 ${w} ${h}`} d={buildLinePath(series, w, h, false)} stroke={toneFg} strokeWidth={2} strokeCap="round" />
        </Frame>
      </Row>
    </Column>
  );
}

// ==================================================================
// 1. MOBILE APP ARTBOARDS (48 artboards, 390 x 844)
// ==================================================================

const STORE_TABS = ["推荐", "经典拿铁", "手冲单品", "烘焙轻食"] as const;
const ORDER_STEPS = [0, 1, 2, 3] as const;
const KIOSK_CHANNELS = ["全部", "到店", "外卖", "小程序"] as const;
const OPS_RANGES = ["今日", "本周", "本月"] as const;

function MobileStorefront({ index }: { index: number }) {
  const theme = THEMES[index % THEMES.length];
  const [tab, setTab] = useVariant("Category", STORE_TABS, STORE_TABS[index % 4]);
  const [cartCount, setCartCount] = useState(2 + (index % 5));
  const series = seriesPoints(index + 1, 8, 18, 95);
  const heroPhoto = PHOTO_LIST[index % PHOTO_LIST.length];

  return (
    <Frame width={390} height={844} fill={theme.bg} clip>
      <Column width="fill" height="fill" align="stretch">
        {/* Status bar */}
        <Row height={44} padding={[0, 22]} align="center" justify="space-between" fill={theme.surface}>
          <Text fontSize={14} fontWeight={700} tabularNums color={theme.ink}>
            09:{String(10 + (index % 49)).padStart(2, "0")}
          </Text>
          <Row gap={8} align="center">
            <Pill label={`${theme.city} · #${index + 1}`} bg={theme.brandSoft} fg={theme.brand} />
            <Icon name="bell" size={15} tint={theme.ink} />
          </Row>
        </Row>

        {/* Top store header */}
        <Column padding={[10, 16, 12, 16]} gap={10} fill={theme.surface} stroke={theme.border} strokeWidth={[0, 0, 1, 0]} strokeAlign="inside" align="stretch">
          <Row align="center" justify="space-between">
            <Column gap={2}>
              <Row gap={6} align="center">
                <Icon name="store" size={16} tint={theme.brand} />
                <Text fontSize={16} fontWeight={700} color={theme.ink}>
                  {theme.store}
                </Text>
              </Row>
              <Text fontSize={11} color={theme.muted}>
                距您 {120 + index * 15}m · 预计 {4 + (index % 6)} 分钟出品
              </Text>
            </Column>
            <Row height={30} padding={[0, 10]} gap={4} align="center" cornerRadius={15} fill={theme.brand} onClick={() => setCartCount((c) => c + 1)}>
              <Icon name="bike" size={13} tint="#ffffff" />
              <Text fontSize={11} fontWeight={600} color="#ffffff">
                自提/外送
              </Text>
            </Row>
          </Row>

          {/* Hero banner with gradient + masked image */}
          <Frame
            width="fill"
            height={118}
            cornerRadius={radius.lg}
            fill={{ type: "linear", angle: 135, stops: theme.heroStops }}
            shadow={shadow.card}
            clip
          >
            <Column x={16} y={14} width={224} gap={6}>
              <Row gap={6} align="center">
                <Pill label={`SEASONAL · S${index + 1}`} bg={theme.brandSoft} fg={theme.brandDark} />
                <Text fontFamily={font.mono} fontSize={10} color="#f5e6d8">
                  BATCH #{1024 + index * 7}
                </Text>
              </Row>
              <Text fontFamily={font.display} fontSize={20} fontWeight={600} color="#ffffff" maxLines={1}>
                {products[index % products.length].name}
              </Text>
              <Text fontSize={11} lineHeight={16} color="#f3e1cf" maxLines={2}>
                {products[index % products.length].desc} · 今日已售 {88 + index * 9} 杯
              </Text>
            </Column>
            <Image
              x={258}
              y={11}
              width={96}
              height={96}
              src={heroPhoto}
              fit="cover"
              mask={<Ellipse width="fill" height="fill" fill="#ffffff" />}
            />
            <Row
              x={254}
              y={82}
              height={24}
              padding={[0, 10]}
              align="center"
              justify="center"
              cornerRadius={12}
              backdropBlur={10}
              fill="rgba(255, 255, 255, 0.86)"
              stroke="rgba(255, 255, 255, 0.5)"
              strokeAlign="inside"
            >
              <Text fontSize={10} fontWeight={700} color={theme.ink}>
                TOP #{(index % 9) + 1}
              </Text>
            </Row>
          </Frame>

          {/* Category tabs */}
          <Row gap={6} width="fill">
            {STORE_TABS.map((c) => {
              const active = c === tab;
              return (
                <Row
                  key={c}
                  width="fill"
                  height={30}
                  align="center"
                  justify="center"
                  cornerRadius={15}
                  fill={active ? theme.brand : theme.card}
                  stroke={active ? undefined : theme.border}
                  strokeAlign="inside"
                  onClick={() => setTab(c)}
                >
                  <Text fontSize={12} fontWeight={active ? 700 : 500} color={active ? "#ffffff" : theme.ink}>
                    {c}
                  </Text>
                </Row>
              );
            })}
          </Row>
        </Column>

        {/* Scrollable product feed */}
        <Column width="fill" height="fill" scroll="vertical" padding={14} gap={10} align="stretch">
          <SparklineCard
            theme={theme}
            title="门店实时杯量指数"
            value={`${310 + index * 14} 杯`}
            delta={4.2 + (index % 7) * 1.3}
            series={series}
            icon="coffee"
          />

          {products.slice(0, 5).map((item, idx) => {
            const price = item.price + ((index + idx) % 4);
            return (
              <Row
                key={item.id}
                width="fill"
                padding={10}
                gap={12}
                align="center"
                fill={theme.card}
                cornerRadius={radius.md}
                stroke={theme.border}
                strokeAlign="inside"
                shadow={shadow.card}
              >
                <Image
                  src={PHOTO_LIST[(index + idx) % PHOTO_LIST.length]}
                  width={64}
                  height={64}
                  fit="cover"
                  cornerRadius={10}
                />
                <Column width="fill" gap={4} align="stretch">
                  <Row align="center" justify="space-between">
                    <Text fontSize={14} fontWeight={700} color={theme.ink} maxLines={1}>
                      {item.name}
                    </Text>
                    {item.tag && <Pill label={item.tag} bg={theme.accentSoft} fg={theme.accent} />}
                  </Row>
                  <Text fontSize={11} color={theme.muted} maxLines={1}>
                    {item.en} · {item.desc}
                  </Text>
                  <Row align="center" justify="space-between">
                    <Text fontSize={13} color={theme.ink}>
                      ¥<Span fontSize={17} fontWeight={700} tabularNums>{price}</Span>
                      <Span fontSize={11} color={theme.muted}> / 大杯</Span>
                    </Text>
                    <Row
                      width={26}
                      height={26}
                      align="center"
                      justify="center"
                      cornerRadius={13}
                      fill={theme.brand}
                      onClick={() => setCartCount((c) => c + 1)}
                    >
                      <Icon name="plus" size={14} tint="#ffffff" />
                    </Row>
                  </Row>
                </Column>
              </Row>
            );
          })}
        </Column>

        {/* Bottom cart bar */}
        <Column padding={[10, 16, 18, 16]} gap={8} fill={theme.surface} stroke={theme.border} strokeWidth={[1, 0, 0, 0]} strokeAlign="inside" align="stretch">
          <Row
            height={48}
            padding={[0, 14]}
            align="center"
            justify="space-between"
            cornerRadius={24}
            fill={theme.sidebarBg}
            shadow={shadow.float}
          >
            <Row gap={10} align="center">
              <Row width={32} height={32} align="center" justify="center" cornerRadius={16} fill={theme.brand}>
                <Icon name="shoppingBag" size={16} tint="#ffffff" />
              </Row>
              <Column gap={1}>
                <Text fontSize={14} fontWeight={700} tabularNums color="#ffffff">
                  ¥{cartCount * 29} · {cartCount} 件商品
                </Text>
                <Text fontSize={10} color={theme.sidebarMuted}>
                  已享满减优惠 ¥{(index % 4) + 4}
                </Text>
              </Column>
            </Row>
            <Row height={34} padding={[0, 16]} align="center" cornerRadius={17} fill={theme.brandSoft}>
              <Text fontSize={13} fontWeight={700} color={theme.brandDark}>
                去结算
              </Text>
            </Row>
          </Row>
        </Column>
      </Column>
    </Frame>
  );
}

function MobileOrderDetail({ index }: { index: number }) {
  const theme = THEMES[index % THEMES.length];
  const [step, setStep] = useVariant("Step", ORDER_STEPS, ORDER_STEPS[index % 4]);
  const steps = ["已接单", "萃取中", "打包中", "待取餐"] as const;
  const code = `A-${2040 + index}`;
  const gaugeSeries = seriesPoints(index + 50, 10, 30, 92);

  return (
    <Frame width={390} height={844} fill={theme.bg} clip>
      <Column width="fill" height="fill" align="stretch">
        <Row height={44} padding={[0, 22]} align="center" justify="space-between" fill={theme.surface}>
          <Text fontSize={14} fontWeight={700} tabularNums color={theme.ink}>
            10:{String(12 + (index % 45)).padStart(2, "0")}
          </Text>
          <Text fontFamily={font.mono} fontSize={11} color={theme.muted}>
            ORDER #{code}
          </Text>
        </Row>

        <Column width="fill" height="fill" padding={16} gap={12} align="stretch">
          {/* Order pickup hero card */}
          <Column
            padding={18}
            gap={14}
            fill={theme.card}
            cornerRadius={radius.lg}
            stroke={theme.border}
            strokeAlign="inside"
            shadow={shadow.card}
            align="stretch"
          >
            <Row align="center" justify="space-between">
              <Column gap={2}>
                <Text fontSize={11} fontWeight={600} letterSpacing={1.2} color={theme.muted}>
                  PICKUP CODE · 取餐号
                </Text>
                <Text fontFamily={font.mono} fontSize={34} fontWeight={700} tabularNums color={theme.ink}>
                  {code}
                </Text>
              </Column>
              <Column align="end" gap={4}>
                <Pill label={steps[step]} bg={theme.okSoft} fg={theme.ok} icon="clock" />
                <Text fontSize={11} color={theme.muted}>
                  {theme.store}
                </Text>
              </Column>
            </Row>

            {/* Stepper bar */}
            <Grid columns={4} gap={8} width="fill">
              {ORDER_STEPS.map((sIdx) => {
                const label = steps[sIdx];
                const done = sIdx <= step;
                return (
                  <Column key={label} gap={6} align="stretch" onClick={() => setStep(sIdx)}>
                    <Rect height={6} cornerRadius={3} fill={done ? theme.brand : theme.border} />
                    <Text fontSize={11} fontWeight={done ? 700 : 500} color={done ? theme.ink : theme.muted} textAlign="center">
                      {label}
                    </Text>
                  </Column>
                );
              })}
            </Grid>
          </Column>

          {/* Extraction telemetry card with SVG chart */}
          <Column
            padding={16}
            gap={10}
            fill={theme.card}
            cornerRadius={radius.lg}
            stroke={theme.border}
            strokeAlign="inside"
            shadow={shadow.card}
            align="stretch"
          >
            <Row align="center" justify="space-between">
              <Text fontSize={14} fontWeight={700} color={theme.ink}>
                实时意式萃取曲线 · 9.2 Bar
              </Text>
              <Text fontFamily={font.mono} fontSize={11} color={theme.brand}>
                93.5°C · 28s
              </Text>
            </Row>
            <Frame width={326} height={74} fill={theme.surface} cornerRadius={10} clip>
              <Path width={326} height={74} viewBox="0 0 326 74" d={buildLinePath(gaugeSeries, 326, 74, true)} fill={theme.brandSoft} />
              <Path width={326} height={74} viewBox="0 0 326 74" d={buildLinePath(gaugeSeries, 326, 74, false)} stroke={theme.brand} strokeWidth={2.5} strokeCap="round" />
            </Frame>
            <Grid columns={3} gap={8} width="fill">
              {[
                ["粉水比", `1 : ${(1.8 + (index % 4) * 0.1).toFixed(1)}`],
                ["烘焙度", index % 2 === 0 ? "中深烘" : "浅中烘"],
                ["风味指数", `${91 + (index % 8)} pts`],
              ].map(([k, v]) => (
                <Column key={k} padding={8} gap={2} fill={theme.surface} cornerRadius={8}>
                  <Text fontSize={10} color={theme.muted}>
                    {k}
                  </Text>
                  <Text fontSize={13} fontWeight={700} tabularNums color={theme.ink}>
                    {v}
                  </Text>
                </Column>
              ))}
            </Grid>
          </Column>

          {/* Order items list */}
          <Column
            width="fill"
            height="fill"
            padding={16}
            gap={10}
            fill={theme.card}
            cornerRadius={radius.lg}
            stroke={theme.border}
            strokeAlign="inside"
            shadow={shadow.card}
            align="stretch"
          >
            <Row align="center" justify="space-between">
              <Text fontSize={14} fontWeight={700} color={theme.ink}>
                订单明细 ({3 + (index % 3)} 项)
              </Text>
              <Text fontFamily={font.mono} fontSize={11} color={theme.muted}>
                PAID · WECHAT
              </Text>
            </Row>
            {[0, 1, 2].map((offset) => {
              const p = products[(index + offset) % products.length];
              return (
                <Row
                  key={p.id}
                  padding={[8, 0]}
                  gap={10}
                  align="center"
                  stroke={theme.border}
                  strokeWidth={[0, 0, 1, 0]}
                  strokeAlign="inside"
                >
                  <Image src={p.image} width={44} height={44} fit="cover" cornerRadius={8} />
                  <Column width="fill" gap={2}>
                    <Text fontSize={13} fontWeight={700} color={theme.ink} maxLines={1}>
                      {p.name}
                    </Text>
                    <Text fontSize={11} color={theme.muted} maxLines={1}>
                      大杯 · 少冰 · 燕麦奶 · 少甜
                    </Text>
                  </Column>
                  <Column align="end" gap={2}>
                    <Text fontSize={13} fontWeight={700} tabularNums color={theme.ink}>
                      ¥{p.price}
                    </Text>
                    <Text fontSize={11} color={theme.muted}>
                      ×{1 + ((index + offset) % 2)}
                    </Text>
                  </Column>
                </Row>
              );
            })}
            <Row align="center" justify="space-between" padding={[4, 0, 0, 0]}>
              <Text fontSize={13} color={theme.muted}>
                实付合计 (含包装与积分抵扣)
              </Text>
              <Text fontSize={18} fontWeight={700} tabularNums color={theme.brand}>
                ¥{76 + (index % 9) * 4}.00
              </Text>
            </Row>
          </Column>
        </Column>
      </Column>
    </Frame>
  );
}

// ==================================================================
// 2. TABLET / KIOSK KANBAN BOARDS (24 artboards, 1024 x 768)
// ==================================================================

function KioskKanbanBoard({ index }: { index: number }) {
  const theme = THEMES[index % THEMES.length];
  const [filter, setFilter] = useVariant("Channel", KIOSK_CHANNELS, "全部");

  const lanes = [
    { title: "待制作 · QUEUED", badge: 4 + (index % 4), tint: theme.warn, soft: theme.warnSoft },
    { title: "制作中 · IN PROGRESS", badge: 3 + (index % 3), tint: theme.brand, soft: theme.brandSoft },
    { title: "待取餐 · READY", badge: 5 + (index % 5), tint: theme.ok, soft: theme.okSoft },
  ];

  return (
    <Frame width={1024} height={768} fill={theme.sidebarBg} clip>
      <Column width="fill" height="fill" padding={20} gap={16} align="stretch">
        {/* Top bar */}
        <Row
          height={56}
          padding={[0, 18]}
          align="center"
          justify="space-between"
          fill={theme.sidebarCard}
          cornerRadius={radius.md}
        >
          <Row gap={12} align="center">
            <Row width={36} height={36} align="center" justify="center" cornerRadius={10} fill={theme.brand}>
              <Icon name="coffee" size={18} tint="#ffffff" />
            </Row>
            <Column gap={2}>
              <Text fontSize={16} fontWeight={700} color={theme.sidebarInk}>
                {theme.store} · KDS 智能吧台看板 #{index + 1}
              </Text>
              <Text fontFamily={font.mono} fontSize={11} color={theme.sidebarMuted}>
                SLA 98.{(index % 9) + 1}% · AVG WAIT 02:{String(10 + (index % 45)).padStart(2, "0")}
              </Text>
            </Column>
          </Row>

          <Row gap={8} align="center">
            {KIOSK_CHANNELS.map((ch) => {
              const active = ch === filter;
              return (
                <Row
                  key={ch}
                  height={32}
                  padding={[0, 14]}
                  align="center"
                  cornerRadius={16}
                  fill={active ? theme.brand : theme.sidebarBg}
                  onClick={() => setFilter(ch)}
                >
                  <Text fontSize={12} fontWeight={active ? 700 : 500} color="#ffffff">
                    {ch}
                  </Text>
                </Row>
              );
            })}
          </Row>
        </Row>

        {/* 3 Kanban columns */}
        <Grid columns={3} gap={16} width="fill" height="fill">
          {lanes.map((lane, lIdx) => (
            <Column
              key={lane.title}
              height="fill"
              padding={14}
              gap={12}
              fill={theme.sidebarCard}
              cornerRadius={radius.lg}
              align="stretch"
            >
              <Row align="center" justify="space-between">
                <Text fontSize={13} fontWeight={700} letterSpacing={0.8} color={theme.sidebarInk}>
                  {lane.title}
                </Text>
                <Pill label={`${lane.badge} 单`} bg={lane.soft} fg={lane.tint} />
              </Row>

              <Column width="fill" height="fill" gap={10} align="stretch">
                {[0, 1, 2].map((tIdx) => {
                  const ticketNo = 2100 + index * 10 + lIdx * 3 + tIdx;
                  const p1 = products[(index + lIdx + tIdx) % products.length];
                  const p2 = products[(index + lIdx + tIdx + 2) % products.length];
                  const urgent = tIdx === 0 && lIdx === 0;
                  return (
                    <Column
                      key={ticketNo}
                      width="fill"
                      padding={12}
                      gap={8}
                      fill={theme.card}
                      cornerRadius={radius.md}
                      shadow={shadow.card}
                      align="stretch"
                    >
                      <Row align="center" justify="space-between">
                        <Row gap={8} align="center">
                          <Text fontFamily={font.mono} fontSize={18} fontWeight={700} tabularNums color={theme.ink}>
                            A-{ticketNo}
                          </Text>
                          <Pill
                            label={["小程序", "外卖", "到店"][(index + tIdx) % 3]}
                            bg={urgent ? theme.dangerSoft : theme.brandSoft}
                            fg={urgent ? theme.danger : theme.brand}
                          />
                        </Row>
                        <Text fontFamily={font.mono} fontSize={12} fontWeight={700} color={urgent ? theme.danger : theme.muted}>
                          0{1 + tIdx}:{String(15 + ((index * 7 + tIdx * 13) % 40)).padStart(2, "0")}
                        </Text>
                      </Row>

                      <Column gap={4} align="stretch">
                        <Row justify="space-between" align="center">
                          <Text fontSize={13} fontWeight={700} color={theme.ink} maxLines={1}>
                            {1 + (tIdx % 2)}× {p1.name}
                          </Text>
                          <Pill label="燕麦奶·少冰" bg={theme.surface} fg={theme.muted} />
                        </Row>
                        <Row justify="space-between" align="center">
                          <Text fontSize={12} color={theme.muted} maxLines={1}>
                            1× {p2.name}
                          </Text>
                          <Text fontFamily={font.mono} fontSize={11} color={theme.muted}>
                            大杯 · 热
                          </Text>
                        </Row>
                      </Column>

                      {/* Progress bar */}
                      <Row height={6} width="fill" cornerRadius={3} fill={theme.border} clip>
                        <Rect width={80 + ((index * 23 + lIdx * 60 + tIdx * 45) % 180)} height="fill" fill={urgent ? theme.danger : lane.tint} />
                      </Row>
                    </Column>
                  );
                })}
              </Column>
            </Column>
          ))}
        </Grid>
      </Column>
    </Frame>
  );
}

// ==================================================================
// 3. DESKTOP ANALYTICS & OPS DASHBOARDS (32 artboards, 1440 x 900)
// ==================================================================

function DesktopAnalyticsConsole({ index }: { index: number }) {
  const theme = THEMES[index % THEMES.length];
  const [range, setRange] = useVariant("Range", OPS_RANGES, OPS_RANGES[index % 3]);
  const mainSeries = seriesPoints(index * 3 + 7, 16, 120, 680);
  const prevSeries = seriesPoints(index * 3 + 19, 16, 100, 620);

  return (
    <Frame width={1440} height={900} fill={theme.bg} clip>
      <Row width="fill" height="fill" align="stretch">
        {/* Sidebar */}
        <Column width={236} height="fill" padding={[22, 14]} gap={18} fill={theme.sidebarBg} align="stretch">
          <Row gap={10} align="center" padding={[0, 8]}>
            <Row width={34} height={34} align="center" justify="center" cornerRadius={10} fill={theme.brand}>
              <Icon name="layoutDashboard" size={18} tint="#ffffff" />
            </Row>
            <Column gap={1}>
              <Text fontFamily={font.display} fontSize={18} fontWeight={600} color={theme.sidebarInk}>
                焙刻 <Span italic color="#f3e1cf">Ops</Span>
              </Text>
              <Text fontFamily={font.mono} fontSize={10} color={theme.sidebarMuted}>
                NODE #{index + 1} · {theme.city}
              </Text>
            </Column>
          </Row>

          <Column gap={4} align="stretch">
            {[
              ["layoutDashboard", "全域经营概览", true],
              ["receipt", "实时订单流水", false],
              ["coffee", "商品与配方库", false],
              ["package", "智能仓储调拨", false],
              ["users", "会员增长漏斗", false],
              ["chartColumn", "财务对账报表", false],
              ["settings", "门店终端配置", false],
            ].map(([ic, label, active]) => (
              <Row
                key={String(label)}
                height={38}
                padding={[0, 12]}
                gap={10}
                align="center"
                cornerRadius={10}
                fill={active ? theme.brand : undefined}
              >
                <Icon name={ic as IconName} size={16} tint={active ? "#ffffff" : theme.sidebarMuted} />
                <Text fontSize={13} fontWeight={active ? 700 : 500} color={active ? "#ffffff" : theme.sidebarInk}>
                  {String(label)}
                </Text>
              </Row>
            ))}
          </Column>

          <Rect width="fill" height="fill" />

          <Column padding={12} gap={8} cornerRadius={12} fill={theme.sidebarCard} align="stretch">
            <Row align="center" justify="space-between">
              <Text fontSize={11} fontWeight={600} color={theme.sidebarInk}>
                集群渲染负载
              </Text>
              <Text fontFamily={font.mono} fontSize={11} color="#f3e1cf">
                {62 + (index % 31)}%
              </Text>
            </Row>
            <Row height={6} width="fill" cornerRadius={3} fill={theme.sidebarBg} clip>
              <Rect width={110 + (index % 70)} height="fill" fill={theme.brand} />
            </Row>
            <Text fontSize={11} color={theme.sidebarMuted}>
              {theme.store}
            </Text>
          </Column>
        </Column>

        {/* Main workspace */}
        <Column width="fill" height="fill" padding={24} gap={18} align="stretch">
          {/* Top header */}
          <Row align="center" justify="space-between">
            <Column gap={3}>
              <Row gap={8} align="center">
                <Text fontFamily={font.display} fontSize={26} fontWeight={600} color={theme.ink}>
                  {theme.city}区域 · {theme.store}经营中枢
                </Text>
                <Pill label={`BOARD #${index + 1}`} bg={theme.brandSoft} fg={theme.brand} />
              </Row>
              <Text fontSize={12} color={theme.muted}>
                实时聚合 POS、小程序与外卖三端遥测数据 · 周期：{range}
              </Text>
            </Column>

            <Row gap={8} align="center">
              {OPS_RANGES.map((r) => {
                const active = r === range;
                return (
                  <Row
                    key={r}
                    height={34}
                    padding={[0, 14]}
                    align="center"
                    cornerRadius={17}
                    fill={active ? theme.brand : theme.card}
                    stroke={active ? undefined : theme.border}
                    strokeAlign="inside"
                    onClick={() => setRange(r)}
                  >
                    <Text fontSize={12} fontWeight={active ? 700 : 500} color={active ? "#ffffff" : theme.ink}>
                      {r}
                    </Text>
                  </Row>
                );
              })}
            </Row>
          </Row>

          {/* 4 KPI cards */}
          <Grid columns={4} gap={14} width="fill">
            <SparklineCard
              theme={theme}
              title="GMV 实收营业额"
              value={`¥${(24800 + index * 1340).toLocaleString()}`}
              delta={8.4 + (index % 6) * 1.1}
              series={seriesPoints(index + 10, 8, 20, 90)}
              icon="wallet"
            />
            <SparklineCard
              theme={theme}
              title="总出品杯量"
              value={`${840 + index * 37} 杯`}
              delta={5.1 + (index % 5) * 0.9}
              series={seriesPoints(index + 20, 8, 25, 95)}
              icon="coffee"
            />
            <SparklineCard
              theme={theme}
              title="会员复购率"
              value={`${42.5 + (index % 15) * 1.2}%`}
              delta={-1.4 + (index % 4) * 1.2}
              series={seriesPoints(index + 30, 8, 30, 85)}
              icon="users"
            />
            <SparklineCard
              theme={theme}
              title="平均出杯耗时"
              value={`${118 + (index % 35)} 秒`}
              delta={-3.2 + (index % 3) * 0.8}
              series={seriesPoints(index + 40, 8, 15, 80)}
              icon="timer"
            />
          </Grid>

          {/* Middle row: dual chart + product ranking */}
          <Grid columns={["2fr", "1fr"]} gap={16} width="fill" height={260}>
            <Column
              height="fill"
              padding={18}
              gap={12}
              fill={theme.card}
              cornerRadius={radius.lg}
              stroke={theme.border}
              strokeAlign="inside"
              shadow={shadow.card}
              align="stretch"
            >
              <Row align="center" justify="space-between">
                <Column gap={2}>
                  <Text fontSize={15} fontWeight={700} color={theme.ink}>
                    分时营收与客流拟合曲线 ({range})
                  </Text>
                  <Text fontSize={11} color={theme.muted}>
                    实线：当期实时曲线 · 虚线：上期基准对照
                  </Text>
                </Column>
                <Row gap={12} align="center">
                  <Row gap={6} align="center">
                    <Ellipse width={8} height={8} fill={theme.brand} />
                    <Text fontSize={11} color={theme.ink}>当期营收</Text>
                  </Row>
                  <Row gap={6} align="center">
                    <Ellipse width={8} height={8} fill={theme.muted} />
                    <Text fontSize={11} color={theme.muted}>同期基准</Text>
                  </Row>
                </Row>
              </Row>

              <Frame width={720} height={176} fill={theme.surface} cornerRadius={12} clip>
                <Path width={720} height={176} viewBox="0 0 720 176" d={buildLinePath(mainSeries, 720, 176, true)} fill={theme.brandSoft} />
                <Path
                  width={720}
                  height={176}
                  viewBox="0 0 720 176"
                  d={buildLinePath(prevSeries, 720, 176, false)}
                  stroke={theme.muted}
                  strokeWidth={1.75}
                  strokeDash={[5, 4]}
                />
                <Path
                  width={720}
                  height={176}
                  viewBox="0 0 720 176"
                  d={buildLinePath(mainSeries, 720, 176, false)}
                  stroke={theme.brand}
                  strokeWidth={2.75}
                  strokeCap="round"
                />
              </Frame>
            </Column>

            <Column
              height="fill"
              padding={18}
              gap={10}
              fill={theme.card}
              cornerRadius={radius.lg}
              stroke={theme.border}
              strokeAlign="inside"
              shadow={shadow.card}
              align="stretch"
            >
              <Row align="center" justify="space-between">
                <Text fontSize={15} fontWeight={700} color={theme.ink}>
                  TOP 5 单品销量榜
                </Text>
                <Pill label="LIVE" bg={theme.okSoft} fg={theme.ok} />
              </Row>
              {products.slice(0, 4).map((p, rank) => {
                const count = 260 - rank * 38 + ((index * 11) % 30);
                return (
                  <Row key={p.id} gap={10} align="center" padding={[4, 0]}>
                    <Row width={22} height={22} align="center" justify="center" cornerRadius={6} fill={rank === 0 ? theme.brand : theme.brandSoft}>
                      <Text fontFamily={font.mono} fontSize={11} fontWeight={700} color={rank === 0 ? "#ffffff" : theme.brand}>
                        {rank + 1}
                      </Text>
                    </Row>
                    <Column width="fill" gap={3} align="stretch">
                      <Row justify="space-between" align="center">
                        <Text fontSize={12} fontWeight={600} color={theme.ink} maxLines={1}>
                          {p.name}
                        </Text>
                        <Text fontFamily={font.mono} fontSize={11} fontWeight={700} tabularNums color={theme.ink}>
                          {count} 杯
                        </Text>
                      </Row>
                      <Row height={5} width="fill" cornerRadius={3} fill={theme.border} clip>
                        <Rect width={Math.max(40, 210 - rank * 42)} height="fill" fill={theme.brand} />
                      </Row>
                    </Column>
                  </Row>
                );
              })}
            </Column>
          </Grid>

          {/* Bottom dense table */}
          <Column
            width="fill"
            height="fill"
            padding={18}
            gap={10}
            fill={theme.card}
            cornerRadius={radius.lg}
            stroke={theme.border}
            strokeAlign="inside"
            shadow={shadow.card}
            align="stretch"
          >
            <Row align="center" justify="space-between">
              <Text fontSize={15} fontWeight={700} color={theme.ink}>
                门店设备与库存健康度矩阵
              </Text>
              <Text fontFamily={font.mono} fontSize={11} color={theme.muted}>
                UPDATED 00:0{1 + (index % 8)} AGO
              </Text>
            </Row>

            <Grid columns={["1.5fr", "1fr", "1fr", "1fr", "1fr", "1fr"]} gap={8} width="fill">
              {["物料 / 终端名称", "批次编号", "实时余量", "日耗速率", "目标阈值", "状态"].map((h) => (
                <Text key={h} fontSize={11} fontWeight={700} color={theme.muted}>
                  {h}
                </Text>
              ))}
              {[0, 1, 2, 3, 4].map((rowIdx) => {
                const item = products[(index + rowIdx) % products.length];
                const low = (index + rowIdx) % 4 === 0;
                return [
                  <Text key={`n-${rowIdx}`} fontSize={12} fontWeight={600} color={theme.ink} maxLines={1}>
                    {item.name} · 原料仓 #{rowIdx + 1}
                  </Text>,
                  <Text key={`b-${rowIdx}`} fontFamily={font.mono} fontSize={11} color={theme.muted}>
                    LOT-{3040 + index * 5 + rowIdx}
                  </Text>,
                  <Text key={`q-${rowIdx}`} fontSize={12} fontWeight={700} tabularNums color={theme.ink}>
                    {48 + ((index * 17 + rowIdx * 29) % 140)} kg
                  </Text>,
                  <Text key={`r-${rowIdx}`} fontSize={12} tabularNums color={theme.muted}>
                    {(3.2 + ((index + rowIdx) % 7) * 0.6).toFixed(1)} kg/h
                  </Text>,
                  <Text key={`t-${rowIdx}`} fontSize={12} tabularNums color={theme.muted}>
                    98.{(index + rowIdx) % 9}%
                  </Text>,
                  <Row key={`s-${rowIdx}`}>
                    <Pill
                      label={low ? "需补货" : "正常充足"}
                      bg={low ? theme.warnSoft : theme.okSoft}
                      fg={low ? theme.warn : theme.ok}
                    />
                  </Row>,
                ];
              })}
            </Grid>
          </Column>
        </Column>
      </Row>
    </Frame>
  );
}

// ==================================================================
// 4. DESIGN SYSTEM & LOD MATRIX BOARDS (16 artboards, 1200 x 960)
// ==================================================================

function DesignSystemMatrix({ index }: { index: number }) {
  const theme = THEMES[index % THEMES.length];
  const typeScale: [string, number, number][] = [
    ["micro", 10, 14],
    ["caption", 11, 15],
    ["footnote", 12, 16],
    ["subhead", 13, 18],
    ["body", 14, 20],
    ["callout", 16, 22],
    ["headline", 18, 24],
    ["title3", 21, 28],
    ["title2", 26, 32],
    ["title1", 34, 40],
  ];

  return (
    <Frame width={1200} height={960} fill={theme.surface} clip>
      <Column width="fill" height="fill" padding={36} gap={24} align="stretch">
        {/* Header */}
        <Row align="end" justify="space-between" padding={[0, 0, 16, 0]} stroke={theme.border} strokeWidth={[0, 0, 1, 0]} strokeAlign="inside">
          <Column gap={4}>
            <Text fontFamily={font.mono} fontSize={11} fontWeight={700} letterSpacing={2} color={theme.brand}>
              DESIGN SYSTEM SPECIMEN · EDITION #{index + 1}
            </Text>
            <Text fontFamily={font.display} fontSize={38} fontWeight={600} color={theme.ink}>
              {theme.label}
            </Text>
          </Column>
          <Row gap={8} align="center">
            <Pill label={`THEME: ${theme.id.toUpperCase()}`} bg={theme.brandSoft} fg={theme.brand} />
            <Pill label="WCAG AA VERIFIED" bg={theme.okSoft} fg={theme.ok} icon="check" />
          </Row>
        </Row>

        {/* Top grid: 10-step Typography Scale (stresses LOD text thresholds) + Swatches & Effects */}
        <Grid columns={["1.2fr", "1fr"]} gap={24} width="fill">
          <Column
            padding={20}
            gap={10}
            fill={theme.card}
            cornerRadius={radius.lg}
            stroke={theme.border}
            strokeAlign="inside"
            shadow={shadow.card}
            align="stretch"
          >
            <Text fontSize={14} fontWeight={700} color={theme.ink}>
              10-Step Multi-Script Type Scale (LOD Threshold Stress)
            </Text>
            {typeScale.map(([name, size, lh]) => (
              <Row key={name} gap={12} align="center">
                <Text width={92} fontFamily={font.mono} fontSize={11} color={theme.muted}>
                  {`${name} ${size}/${lh}`}
                </Text>
                <Text
                  width="fill"
                  maxLines={1}
                  fontSize={size}
                  lineHeight={lh}
                  fontWeight={size >= 21 ? 700 : 500}
                  color={theme.ink}
                >
                  焙刻 Roastery #{index + 1} · Freshly Roasted ¥{28 + index}
                </Text>
              </Row>
            ))}
          </Column>

          <Column gap={16} align="stretch">
            {/* Color tokens */}
            <Column
              padding={20}
              gap={12}
              fill={theme.card}
              cornerRadius={radius.lg}
              stroke={theme.border}
              strokeAlign="inside"
              shadow={shadow.card}
              align="stretch"
            >
              <Text fontSize={14} fontWeight={700} color={theme.ink}>
                Semantic Surface & Brand Tokens
              </Text>
              <Grid columns={4} gap={10} width="fill">
                {[
                  ["Ink", theme.ink],
                  ["Brand", theme.brand],
                  ["Accent", theme.accent],
                  ["Success", theme.ok],
                  ["Warning", theme.warn],
                  ["Danger", theme.danger],
                  ["Soft", theme.brandSoft],
                  ["Surface", theme.bg],
                ].map(([role, hex]) => (
                  <Column key={role} gap={4} align="stretch">
                    <Rect height={44} cornerRadius={8} fill={hex} stroke={theme.border} strokeAlign="inside" />
                    <Text fontSize={11} fontWeight={700} color={theme.ink}>
                      {role}
                    </Text>
                    <Text fontFamily={font.mono} fontSize={10} color={theme.muted}>
                      {hex}
                    </Text>
                  </Column>
                ))}
              </Grid>
            </Column>

            {/* Shadows, gradients, inset shadow & blur showcase */}
            <Column
              padding={20}
              gap={12}
              fill={theme.card}
              cornerRadius={radius.lg}
              stroke={theme.border}
              strokeAlign="inside"
              shadow={shadow.card}
              align="stretch"
            >
              <Text fontSize={14} fontWeight={700} color={theme.ink}>
                Shaders, Shadows & Mask Primitives
              </Text>
              <Grid columns={4} gap={12} width="fill" height={110}>
                <Column
                  height="fill"
                  padding={12}
                  justify="end"
                  cornerRadius={12}
                  fill={{ type: "linear", angle: 135, stops: theme.heroStops }}
                >
                  <Text fontSize={12} fontWeight={700} color="#ffffff">Linear 135°</Text>
                  <Text fontFamily={font.mono} fontSize={10} color="#f3e1cf">2-Stop Shader</Text>
                </Column>
                <Column
                  height="fill"
                  padding={12}
                  justify="end"
                  cornerRadius={12}
                  fill={{ type: "radial", center: [0.3, 0.25], radius: 0.9, stops: theme.heroStops }}
                >
                  <Text fontSize={12} fontWeight={700} color="#ffffff">Radial 0.9</Text>
                  <Text fontFamily={font.mono} fontSize={10} color="#f3e1cf">Focal Shader</Text>
                </Column>
                <Column
                  height="fill"
                  padding={12}
                  justify="end"
                  cornerRadius={12}
                  fill={theme.surface}
                  shadow={{ y: 2, blur: 6, color: "rgba(0,0,0,0.18)", inset: true }}
                  stroke={theme.borderStrong}
                  strokeAlign="inside"
                >
                  <Text fontSize={12} fontWeight={700} color={theme.ink}>Inset Shadow</Text>
                  <Text fontFamily={font.mono} fontSize={10} color={theme.muted}>Inner Cavity</Text>
                </Column>
                <Column
                  height="fill"
                  padding={12}
                  justify="end"
                  cornerRadius={12}
                  fill={theme.brandSoft}
                  stroke={theme.brand}
                  strokeWidth={1.5}
                  strokeDash={[6, 4]}
                  strokeAlign="inside"
                >
                  <Text fontSize={12} fontWeight={700} color={theme.brandDark}>Dashed Path</Text>
                  <Text fontFamily={font.mono} fontSize={10} color={theme.brand}>Stroke [6, 4]</Text>
                </Column>
              </Grid>
            </Column>
          </Column>
        </Grid>

        {/* Bottom Icon & Component Matrix */}
        <Column
          width="fill"
          height="fill"
          padding={20}
          gap={14}
          fill={theme.card}
          cornerRadius={radius.lg}
          stroke={theme.border}
          strokeAlign="inside"
          shadow={shadow.card}
          align="stretch"
        >
          <Row align="center" justify="space-between">
            <Text fontSize={14} fontWeight={700} color={theme.ink}>
              Vector Icon & Interactive Pill Matrix (24 Lucide Paths)
            </Text>
            <Text fontFamily={font.mono} fontSize={11} color={theme.muted}>
              24 PATHS × STROKE-CAP ROUND
            </Text>
          </Row>
          <Grid columns={8} gap={10} width="fill">
            {ICON_KEYS.slice(0, 24).map((iconName, idx) => {
              const active = (index + idx) % 5 === 0;
              return (
                <Row
                  key={iconName}
                  height={42}
                  padding={[0, 10]}
                  gap={8}
                  align="center"
                  cornerRadius={10}
                  fill={active ? theme.brand : theme.surface}
                  stroke={active ? undefined : theme.border}
                  strokeAlign="inside"
                >
                  <Icon name={iconName} size={16} tint={active ? "#ffffff" : theme.brand} />
                  <Text width="fill" fontSize={11} fontWeight={600} color={active ? "#ffffff" : theme.ink} maxLines={1}>
                    {iconName}
                  </Text>
                </Row>
              );
            })}
          </Grid>
        </Column>
      </Column>
    </Frame>
  );
}

// ==================================================================
// 200 EXPORTED ARTBOARDS (20 Suites × 10 Artboards per Suite)
// ==================================================================
// Each suite represents a regional store / brand deployment containing:
// - 2 Mobile Storefront artboards
// - 2 Mobile Order & Telemetry artboards
// - 2 Tablet Kiosk Kanban artboards
// - 3 Desktop Operations & Analytics Console artboards
// - 1 Design System & LOD Matrix artboard

function makeBoard(index: number): ComponentType {
  const suite = Math.floor(index / 10) + 1;
  const slot = index % 10;
  const theme = THEMES[index % THEMES.length];
  const pad = (n: number) => String(n).padStart(2, "0");
  if (slot === 0 || slot === 1) {
    return artboard(`S${pad(suite)}_${theme.id}_Mobile_Store_${slot + 1}`, () => <MobileStorefront index={index} />);
  }
  if (slot === 2 || slot === 3) {
    return artboard(`S${pad(suite)}_${theme.id}_Mobile_Order_${slot - 1}`, () => <MobileOrderDetail index={index} />);
  }
  if (slot === 4 || slot === 5) {
    return artboard(`S${pad(suite)}_${theme.id}_Kiosk_Board_${slot - 3}`, () => <KioskKanbanBoard index={index} />);
  }
  if (slot === 6 || slot === 7 || slot === 8) {
    return artboard(`S${pad(suite)}_${theme.id}_Desktop_Console_${slot - 5}`, () => <DesktopAnalyticsConsole index={index} />);
  }
  return artboard(`S${pad(suite)}_${theme.id}_System_Matrix`, () => <DesignSystemMatrix index={index} />);
}

export const Board001 = makeBoard(0);
export const Board002 = makeBoard(1);
export const Board003 = makeBoard(2);
export const Board004 = makeBoard(3);
export const Board005 = makeBoard(4);
export const Board006 = makeBoard(5);
export const Board007 = makeBoard(6);
export const Board008 = makeBoard(7);
export const Board009 = makeBoard(8);
export const Board010 = makeBoard(9);

export const Board011 = makeBoard(10);
export const Board012 = makeBoard(11);
export const Board013 = makeBoard(12);
export const Board014 = makeBoard(13);
export const Board015 = makeBoard(14);
export const Board016 = makeBoard(15);
export const Board017 = makeBoard(16);
export const Board018 = makeBoard(17);
export const Board019 = makeBoard(18);
export const Board020 = makeBoard(19);

export const Board021 = makeBoard(20);
export const Board022 = makeBoard(21);
export const Board023 = makeBoard(22);
export const Board024 = makeBoard(23);
export const Board025 = makeBoard(24);
export const Board026 = makeBoard(25);
export const Board027 = makeBoard(26);
export const Board028 = makeBoard(27);
export const Board029 = makeBoard(28);
export const Board030 = makeBoard(29);

export const Board031 = makeBoard(30);
export const Board032 = makeBoard(31);
export const Board033 = makeBoard(32);
export const Board034 = makeBoard(33);
export const Board035 = makeBoard(34);
export const Board036 = makeBoard(35);
export const Board037 = makeBoard(36);
export const Board038 = makeBoard(37);
export const Board039 = makeBoard(38);
export const Board040 = makeBoard(39);

export const Board041 = makeBoard(40);
export const Board042 = makeBoard(41);
export const Board043 = makeBoard(42);
export const Board044 = makeBoard(43);
export const Board045 = makeBoard(44);
export const Board046 = makeBoard(45);
export const Board047 = makeBoard(46);
export const Board048 = makeBoard(47);
export const Board049 = makeBoard(48);
export const Board050 = makeBoard(49);

export const Board051 = makeBoard(50);
export const Board052 = makeBoard(51);
export const Board053 = makeBoard(52);
export const Board054 = makeBoard(53);
export const Board055 = makeBoard(54);
export const Board056 = makeBoard(55);
export const Board057 = makeBoard(56);
export const Board058 = makeBoard(57);
export const Board059 = makeBoard(58);
export const Board060 = makeBoard(59);

export const Board061 = makeBoard(60);
export const Board062 = makeBoard(61);
export const Board063 = makeBoard(62);
export const Board064 = makeBoard(63);
export const Board065 = makeBoard(64);
export const Board066 = makeBoard(65);
export const Board067 = makeBoard(66);
export const Board068 = makeBoard(67);
export const Board069 = makeBoard(68);
export const Board070 = makeBoard(69);

export const Board071 = makeBoard(70);
export const Board072 = makeBoard(71);
export const Board073 = makeBoard(72);
export const Board074 = makeBoard(73);
export const Board075 = makeBoard(74);
export const Board076 = makeBoard(75);
export const Board077 = makeBoard(76);
export const Board078 = makeBoard(77);
export const Board079 = makeBoard(78);
export const Board080 = makeBoard(79);

export const Board081 = makeBoard(80);
export const Board082 = makeBoard(81);
export const Board083 = makeBoard(82);
export const Board084 = makeBoard(83);
export const Board085 = makeBoard(84);
export const Board086 = makeBoard(85);
export const Board087 = makeBoard(86);
export const Board088 = makeBoard(87);
export const Board089 = makeBoard(88);
export const Board090 = makeBoard(89);

export const Board091 = makeBoard(90);
export const Board092 = makeBoard(91);
export const Board093 = makeBoard(92);
export const Board094 = makeBoard(93);
export const Board095 = makeBoard(94);
export const Board096 = makeBoard(95);
export const Board097 = makeBoard(96);
export const Board098 = makeBoard(97);
export const Board099 = makeBoard(98);
export const Board100 = makeBoard(99);

export const Board101 = makeBoard(100);
export const Board102 = makeBoard(101);
export const Board103 = makeBoard(102);
export const Board104 = makeBoard(103);
export const Board105 = makeBoard(104);
export const Board106 = makeBoard(105);
export const Board107 = makeBoard(106);
export const Board108 = makeBoard(107);
export const Board109 = makeBoard(108);
export const Board110 = makeBoard(109);

export const Board111 = makeBoard(110);
export const Board112 = makeBoard(111);
export const Board113 = makeBoard(112);
export const Board114 = makeBoard(113);
export const Board115 = makeBoard(114);
export const Board116 = makeBoard(115);
export const Board117 = makeBoard(116);
export const Board118 = makeBoard(117);
export const Board119 = makeBoard(118);
export const Board120 = makeBoard(119);

export const Board121 = makeBoard(120);
export const Board122 = makeBoard(121);
export const Board123 = makeBoard(122);
export const Board124 = makeBoard(123);
export const Board125 = makeBoard(124);
export const Board126 = makeBoard(125);
export const Board127 = makeBoard(126);
export const Board128 = makeBoard(127);
export const Board129 = makeBoard(128);
export const Board130 = makeBoard(129);

export const Board131 = makeBoard(130);
export const Board132 = makeBoard(131);
export const Board133 = makeBoard(132);
export const Board134 = makeBoard(133);
export const Board135 = makeBoard(134);
export const Board136 = makeBoard(135);
export const Board137 = makeBoard(136);
export const Board138 = makeBoard(137);
export const Board139 = makeBoard(138);
export const Board140 = makeBoard(139);

export const Board141 = makeBoard(140);
export const Board142 = makeBoard(141);
export const Board143 = makeBoard(142);
export const Board144 = makeBoard(143);
export const Board145 = makeBoard(144);
export const Board146 = makeBoard(145);
export const Board147 = makeBoard(146);
export const Board148 = makeBoard(147);
export const Board149 = makeBoard(148);
export const Board150 = makeBoard(149);

export const Board151 = makeBoard(150);
export const Board152 = makeBoard(151);
export const Board153 = makeBoard(152);
export const Board154 = makeBoard(153);
export const Board155 = makeBoard(154);
export const Board156 = makeBoard(155);
export const Board157 = makeBoard(156);
export const Board158 = makeBoard(157);
export const Board159 = makeBoard(158);
export const Board160 = makeBoard(159);

export const Board161 = makeBoard(160);
export const Board162 = makeBoard(161);
export const Board163 = makeBoard(162);
export const Board164 = makeBoard(163);
export const Board165 = makeBoard(164);
export const Board166 = makeBoard(165);
export const Board167 = makeBoard(166);
export const Board168 = makeBoard(167);
export const Board169 = makeBoard(168);
export const Board170 = makeBoard(169);

export const Board171 = makeBoard(170);
export const Board172 = makeBoard(171);
export const Board173 = makeBoard(172);
export const Board174 = makeBoard(173);
export const Board175 = makeBoard(174);
export const Board176 = makeBoard(175);
export const Board177 = makeBoard(176);
export const Board178 = makeBoard(177);
export const Board179 = makeBoard(178);
export const Board180 = makeBoard(179);

export const Board181 = makeBoard(180);
export const Board182 = makeBoard(181);
export const Board183 = makeBoard(182);
export const Board184 = makeBoard(183);
export const Board185 = makeBoard(184);
export const Board186 = makeBoard(185);
export const Board187 = makeBoard(186);
export const Board188 = makeBoard(187);
export const Board189 = makeBoard(188);
export const Board190 = makeBoard(189);

export const Board191 = makeBoard(190);
export const Board192 = makeBoard(191);
export const Board193 = makeBoard(192);
export const Board194 = makeBoard(193);
export const Board195 = makeBoard(194);
export const Board196 = makeBoard(195);
export const Board197 = makeBoard(196);
export const Board198 = makeBoard(197);
export const Board199 = makeBoard(198);
export const Board200 = makeBoard(199);
