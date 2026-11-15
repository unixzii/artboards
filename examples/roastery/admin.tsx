// Store manager console (web, 1440 x 900): the day, week or month at a glance, with its empty, error and loading states.
import { Column, Ellipse, Frame, Grid, Image, Path, Rect, Row, Span, Text, useVariant } from "artboards";
import type { Track } from "artboards";
import type { ReactNode } from "react";
import { Avatar, Badge, Button, Icon, Input, ProgressBar, Segmented, Sparkline, plot, smoothPath, type Tone } from "./components.tsx";
import { byId } from "./data.ts";
import type { IconName } from "./icons.ts";
import { color, font, radius, shadow } from "./tokens.ts";

const side = { bg: "#21150e", hover: "#2f2017", text: "#f6ece1", muted: "#b9a797" };

function Panel({ title, children, action, width = "fill", grow }: { title: string; children: ReactNode; action?: ReactNode; width?: "fill" | number; grow?: number }) {
  return (
    <Column width={width} grow={grow} height="fill" padding={20} gap={16} fill={color.white} cornerRadius={radius.lg} shadow={shadow.card} align="stretch">
      <Row align="center" justify="space-between">
        <Text fontSize={16} fontWeight={700} color={color.espresso}>
          {title}
        </Text>
        {action}
      </Row>
      {children}
    </Column>
  );
}

// ------------------------------------------------------------------ sidebar

const NAV: [IconName, string, number?][] = [
  ["layoutDashboard", "经营概览"],
  ["receipt", "订单", 14],
  ["coffee", "商品与菜单"],
  ["package", "库存", 3],
  ["users", "会员"],
  ["ticket", "营销活动"],
  ["wallet", "财务对账"],
];

function Sidebar() {
  return (
    <Column name="Sidebar" width={248} height="fill" padding={[24, 16]} gap={24} fill={side.bg} align="stretch">
      <Row gap={10} align="center" padding={[0, 8]}>
        <Row width={36} height={36} align="center" justify="center" cornerRadius={10} fill={color.caramel}>
          <Icon name="coffee" size={19} tint={color.espresso} weight={2.2} />
        </Row>
        <Text fontFamily={font.display} fontSize={22} fontWeight={600} color={side.text}>
          焙刻 <Span italic fontWeight={400} color={color.caramel}>Studio</Span>
        </Text>
      </Row>
      <Row padding={12} gap={10} align="center" cornerRadius={12} fill={side.hover}>
        <Icon name="store" size={18} tint={side.muted} />
        <Column width="fill" gap={2}>
          <Text fontSize={13} fontWeight={600} color={side.text}>
            武康路店
          </Text>
          <Text fontSize={11} color={side.muted}>
            上海 · 3 家门店
          </Text>
        </Column>
        <Icon name="chevronRight" size={14} tint={side.muted} />
      </Row>
      <Column gap={4} align="stretch">
        <Text fontSize={11} fontWeight={600} letterSpacing={1.5} color={side.muted}>
          门店运营
        </Text>
        {NAV.map(([icon, label, count], i) => (
          <Row key={label} height={40} padding={[0, 12]} gap={12} align="center" cornerRadius={10} fill={i === 0 ? color.caramel : undefined}>
            <Icon name={icon} size={18} tint={i === 0 ? color.espresso : side.muted} />
            <Text width="fill" fontSize={14} fontWeight={i === 0 ? 700 : 500} color={i === 0 ? color.espresso : side.text}>
              {label}
            </Text>
            {count != null && (
              <Row height={20} padding={[0, 7]} align="center" cornerRadius={10} fill={label === "库存" ? color.tomato : side.hover}>
                <Text fontSize={11} fontWeight={700} tabularNums color={side.text}>
                  {count}
                </Text>
              </Row>
            )}
          </Row>
        ))}
      </Column>
      <Rect width="fill" height="fill" />
      <Row padding={12} gap={10} align="center" cornerRadius={12} stroke={side.hover} strokeAlign="inside">
        <Avatar initials="周" size={34} />
        <Column width="fill" gap={1}>
          <Text fontSize={13} fontWeight={600} color={side.text}>
            周店长
          </Text>
          <Text fontSize={11} color={side.muted}>
            Store manager
          </Text>
        </Column>
        <Icon name="settings" size={16} tint={side.muted} />
      </Row>
    </Column>
  );
}

// ------------------------------------------------------------------ data per range

type Range = "今日" | "本周" | "本月";
type Status = "正常" | "空" | "错误" | "加载";

interface KpiData {
  icon: IconName;
  label: string;
  value: string;
  unit?: string;
  delta: number;
  spark: number[];
  tint: string;
}

interface Series {
  title: string;
  legend: [current: string, previous: string];
  /** Slots on the x axis; `current` may stop early (the period is still running). */
  slots: number;
  current: number[];
  previous: number[];
  /** [slot index, label] along the x axis. */
  labels: [number, string][];
  max: number;
  tip: { at: number; title: string; value: string; delta: string; note: string };
}

interface RangeData {
  period: string;
  compare: string;
  kpis: KpiData[];
  series: Series;
  cups: number;
  shares: number[];
  top: number[];
}

const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

const RANGES: Record<Range, RangeData> = {
  今日: {
    period: "2026 年 11 月 15 日 周日",
    compare: "较上周同日",
    kpis: [
      { icon: "wallet", label: "营业额", value: "¥18,240", delta: 12.4, spark: [8, 12, 10, 14, 13, 17, 18], tint: color.caramel },
      { icon: "receipt", label: "订单数", value: "412", unit: "单", delta: 8.1, spark: [30, 34, 31, 36, 40, 38, 41], tint: color.roast },
      { icon: "users", label: "客单价", value: "¥44.3", delta: -2.6, spark: [47, 46, 46, 45, 44, 45, 44], tint: color.sky },
      { icon: "refreshCw", label: "会员复购率", value: "38", unit: "%", delta: 4.2, spark: [30, 31, 33, 32, 35, 36, 38], tint: color.sage },
    ],
    series: {
      title: "分时段出杯",
      legend: ["今日", "上周同日"],
      slots: HOURS.length,
      current: [12, 46, 58, 34, 28, 41, 52, 61],
      previous: [10, 38, 50, 36, 25, 36, 44, 47, 40, 33, 28, 26, 20, 12, 9],
      labels: HOURS.map((h, i) => [i, `${h}:00`] as [number, string]).filter((_, i) => i % 2 === 0),
      max: 75,
      tip: { at: 7, title: "14:00 – 15:00", value: "61 杯", delta: "+29.8%", note: "上周同时段 47 杯" },
    },
    cups: 412,
    shares: [0.46, 0.22, 0.12, 0.14, 0.06],
    top: [128, 96, 74, 31],
  },
  本周: {
    period: "11 月 9 日 – 15 日 · 第 46 周",
    compare: "较上周",
    kpis: [
      { icon: "wallet", label: "营业额", value: "¥121,860", delta: 6.8, spark: [15, 16, 17, 17, 20, 22, 18], tint: color.caramel },
      { icon: "receipt", label: "订单数", value: "2,958", unit: "单", delta: 5.2, spark: [362, 388, 401, 415, 468, 512, 412], tint: color.roast },
      { icon: "users", label: "客单价", value: "¥41.2", delta: 1.5, spark: [40, 41, 40, 41, 42, 42, 41], tint: color.sky },
      { icon: "refreshCw", label: "会员复购率", value: "41", unit: "%", delta: 2, spark: [38, 39, 39, 40, 40, 41, 41], tint: color.sage },
    ],
    series: {
      title: "每日出杯",
      legend: ["本周", "上周"],
      slots: 7,
      current: [362, 388, 401, 415, 468, 512, 412],
      previous: [340, 371, 392, 380, 441, 497, 486],
      labels: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((d, i) => [i, d] as [number, string]),
      max: 600,
      tip: { at: 5, title: "11 月 14 日 周六", value: "512 杯", delta: "+3.0%", note: "上周六 497 杯" },
    },
    cups: 2958,
    shares: [0.44, 0.24, 0.11, 0.15, 0.06],
    top: [842, 655, 512, 203],
  },
  本月: {
    period: "2026 年 11 月 1 日 – 15 日",
    compare: "较上月同期",
    kpis: [
      { icon: "wallet", label: "营业额", value: "¥246,300", delta: 9.1, spark: [14, 15, 16, 16, 17, 19, 20], tint: color.caramel },
      { icon: "receipt", label: "订单数", value: "5,870", unit: "单", delta: 7.4, spark: [380, 395, 410, 402, 430, 455, 470], tint: color.roast },
      { icon: "users", label: "客单价", value: "¥42.0", delta: -1.2, spark: [43, 43, 42, 42, 42, 41, 42], tint: color.sky },
      { icon: "refreshCw", label: "会员复购率", value: "40", unit: "%", delta: 3.1, spark: [35, 36, 37, 38, 38, 39, 40], tint: color.sage },
    ],
    series: {
      title: "每日出杯",
      legend: ["本月", "上月"],
      slots: 30,
      current: [372, 398, 365, 410, 455, 498, 441, 389, 402, 377, 416, 463, 505, 512, 412],
      previous: [350, 362, 371, 340, 402, 451, 430, 366, 380, 359, 371, 420, 466, 471, 405, 352, 369, 360, 388, 421, 470, 452, 361, 377, 392, 380, 428, 476, 489, 431],
      labels: [0, 4, 8, 12, 16, 20, 24, 28].map((d) => [d, `11-${String(d + 1).padStart(2, "0")}`] as [number, string]),
      max: 600,
      tip: { at: 13, title: "11 月 14 日 周六", value: "512 杯", delta: "+8.7%", note: "上月同期 471 杯" },
    },
    cups: 5870,
    shares: [0.45, 0.23, 0.12, 0.14, 0.06],
    top: [1690, 1320, 1044, 410],
  },
};

const SHIMMER = { type: "linear" as const, angle: 90, stops: [color.crema, "#efe5d9", color.crema] };

/** A grey placeholder block for the loading state. */
function Bone({ width, height, radius: r = 6, opacity }: { width: number | "fill"; height: number | "fill"; radius?: number; opacity?: number }) {
  return <Rect width={width} height={height} cornerRadius={r} fill={SHIMMER} opacity={opacity} />;
}

/** Centred message for a panel with nothing to show. */
function EmptyState({ icon, title, body, action, tone = "empty" }: { icon: IconName; title: string; body?: string; action?: ReactNode; tone?: "empty" | "error" }) {
  const error = tone === "error";
  return (
    <Column
      width="fill"
      height="fill"
      gap={10}
      align="center"
      justify="center"
      cornerRadius={radius.md}
      fill={error ? color.tomatoSoft : undefined}
      stroke={error ? undefined : color.oatStrong}
      strokeDash={error ? undefined : [6, 5]}
      strokeAlign="inside"
    >
      <Row width={48} height={48} align="center" justify="center" cornerRadius={24} fill={error ? color.white : color.caramelSoft}>
        <Icon name={icon} size={22} tint={error ? color.tomato : color.roast} />
      </Row>
      <Text fontSize={15} fontWeight={700} color={color.espresso}>
        {title}
      </Text>
      {body && (
        <Text width={260} textAlign="center" fontSize={13} lineHeight={19} color={color.muted}>
          {body}
        </Text>
      )}
      {action}
    </Column>
  );
}

// ------------------------------------------------------------------ KPIs

function Kpi({ data, compare, empty = false }: { data: KpiData; compare: string; empty?: boolean }) {
  const { icon, label, value, unit, delta, spark, tint } = data;
  const up = delta >= 0;
  return (
    <Column padding={18} gap={12} fill={color.white} cornerRadius={radius.lg} shadow={shadow.card} align="stretch">
      <Row gap={8} align="center">
        <Row width={28} height={28} align="center" justify="center" cornerRadius={8} fill={`${tint}1f`}>
          <Icon name={icon} size={15} tint={tint} />
        </Row>
        <Text width="fill" fontSize={13} color={color.muted}>
          {label}
        </Text>
        <Icon name="ellipsis" size={16} tint={color.subtle} />
      </Row>
      <Row height={64} align="end" justify="space-between">
        <Column gap={6}>
          <Text fontSize={28} fontWeight={700} tabularNums color={empty ? color.subtle : color.espresso}>
            {empty ? "—" : value}
            {unit && !empty && (
              <Span fontSize={14} fontWeight={500} color={color.muted}>
                {` ${unit}`}
              </Span>
            )}
          </Text>
          {empty ? (
            <Text fontSize={12} color={color.muted}>
              暂无数据
            </Text>
          ) : (
            <Row gap={4} align="center">
              <Icon name={up ? "trendingUp" : "trendingDown"} size={14} tint={up ? color.sage : color.tomato} />
              <Text fontSize={12} fontWeight={600} tabularNums color={up ? color.sage : color.tomato}>
                {`${up ? "+" : ""}${delta.toFixed(1)}%`}
              </Text>
              <Text fontSize={12} color={color.muted}>
                {compare}
              </Text>
            </Row>
          )}
        </Column>
        {!empty && <Sparkline data={spark} width={96} height={40} tint={tint} />}
      </Row>
    </Column>
  );
}

function KpiSkeleton() {
  return (
    <Column padding={18} gap={12} fill={color.white} cornerRadius={radius.lg} shadow={shadow.card} align="stretch">
      <Row gap={8} align="center">
        <Bone width={28} height={28} radius={8} />
        <Bone width={72} height={12} />
      </Row>
      <Column height={64} gap={10} justify="end">
        <Bone width={132} height={26} />
        <Bone width={160} height={10} opacity={0.7} />
      </Column>
    </Column>
  );
}

// ------------------------------------------------------------------ sales chart

// Plot width = panel (1128 - 16 - 440 - 2 * 20 padding = 632) minus the y-axis column and its gap.
const AXIS = 32;
const W = 632 - AXIS - 10 - 2;
const H = 210;

function SalesChart({ s }: { s: Series }) {
  const x = (slot: number) => (W * slot) / (s.slots - 1);
  const current = plot(s.current, x(s.current.length - 1), H, s.max, 0);
  const previous = plot(s.previous, W, H, s.max, 0);
  const line = smoothPath(current);
  const [hx, hy] = current[s.tip.at];
  const [ex] = current[current.length - 1];
  // The tooltip sits right of the point, or left of it near the right edge.
  const flip = hx > W - 180;
  return (
    <Column width="fill" height="fill" gap={8} align="stretch">
      <Row width="fill" height="fill" gap={10}>
        {/* Each value sits level with its gridline. */}
        <Frame width={AXIS} height={H}>
          {[3, 2, 1, 0].map((i) => (
            <Text key={i} right={0} y={Math.max(0, Math.min(H - 14, (H * (3 - i)) / 3 - 7))} fontSize={11} tabularNums color={color.muted}>
              {String((s.max * i) / 3)}
            </Text>
          ))}
        </Frame>
        <Frame name="Plot" width={W} height={H}>
          {[0, 1, 2, 3].map((i) => (
            <Rect key={i} x={0} y={Math.min(H - 1, (H * i) / 3)} width="fill" height={1} fill={i === 3 ? color.oatStrong : color.oat} />
          ))}
          <Path width={W} height={H} viewBox={[0, 0, W, H]} d={smoothPath(previous)} stroke={color.subtle} strokeWidth={1.5} strokeDash={[4, 4]} />
          <Path width={W} height={H} viewBox={[0, 0, W, H]} d={`${line} L ${ex} ${H} L 0 ${H} Z`} fill={{ type: "linear", angle: 180, stops: ["rgba(196, 119, 59, 0.32)", "rgba(196, 119, 59, 0)"] }} />
          <Path width={W} height={H} viewBox={[0, 0, W, H]} d={line} stroke={color.caramel} strokeWidth={3} strokeCap="round" strokeJoin="round" />
          <Rect x={hx} y={0} width={1} height={H} fill={color.roast} opacity={0.35} />
          <Ellipse x={hx - 6} y={hy - 6} width={12} height={12} fill={color.white} stroke={color.caramel} strokeWidth={3} />
          <Column
            x={flip ? undefined : hx + 14}
            right={flip ? W - hx + 14 : undefined}
            y={Math.max(0, Math.min(H - 76, hy - 30))}
            padding={[10, 12]}
            gap={4}
            cornerRadius={10}
            fill={color.espresso}
            shadow={shadow.float}
          >
            <Text fontSize={11} color={color.oatStrong}>
              {s.tip.title}
            </Text>
            <Text fontSize={14} fontWeight={700} tabularNums color={color.white}>
              {`${s.tip.value} `}
              <Span fontSize={11} fontWeight={600} color="#8fd19e">
                {s.tip.delta}
              </Span>
            </Text>
            <Text fontSize={11} tabularNums color={color.oatStrong}>
              {s.tip.note}
            </Text>
          </Column>
        </Frame>
      </Row>
      {/* Each label is centred under its slot. */}
      <Row gap={10}>
        <Rect width={AXIS} height={1} />
        <Frame width={W} height={14}>
          {s.labels.map(([slot, label]) => (
            <Text key={label} x={Math.max(0, Math.min(W - 44, x(slot) - 22))} width={44} textAlign="center" fontSize={11} tabularNums color={color.muted}>
              {label}
            </Text>
          ))}
        </Frame>
      </Row>
    </Column>
  );
}

function ChartSkeleton() {
  const bars = [0.35, 0.6, 0.75, 0.5, 0.45, 0.62, 0.7, 0.82, 0.58, 0.5, 0.42, 0.36, 0.3, 0.22, 0.15];
  return (
    <Column width="fill" height="fill" gap={8} align="stretch">
      <Row width="fill" height="fill" gap={10} align="end">
        {bars.map((b, i) => (
          <Bone key={i} width="fill" height={Math.round(H * b)} radius={4} />
        ))}
      </Row>
      <Bone width="fill" height={10} opacity={0.7} />
    </Column>
  );
}

function Legend({ tint, label, dashed = false }: { tint: string; label: string; dashed?: boolean }) {
  return (
    <Row gap={6} align="center">
      <Path width={18} height={4} viewBox="0 0 18 4" d="M 1 2 L 17 2" stroke={tint} strokeWidth={dashed ? 1.5 : 3} strokeCap="round" strokeDash={dashed ? [3, 3] : undefined} />
      <Text fontSize={12} color={color.muted}>
        {label}
      </Text>
    </Row>
  );
}

// ------------------------------------------------------------------ category donut

const CATEGORIES = [
  { label: "拿铁类", tint: color.roast },
  { label: "美式 / 冷萃", tint: color.caramel },
  { label: "手冲", tint: "#8a9a5b" },
  { label: "烘焙甜点", tint: "#d9b38c" },
  { label: "零售豆", tint: color.oatStrong },
];

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)].map((n) => n.toFixed(2)).join(" ");
  return `M ${p(a0)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`;
}

const DONUT = 140;

function Donut({ range, data }: { range: Range; data: RangeData }) {
  const r = 56;
  const gap = 0.04;
  let at = 0;
  return (
    <Row gap={24} align="center">
      <Frame width={DONUT} height={DONUT}>
        {CATEGORIES.map((c, i) => {
          const a0 = at * Math.PI * 2 + gap;
          at += data.shares[i];
          const a1 = at * Math.PI * 2 - gap;
          return <Path key={c.label} width={DONUT} height={DONUT} viewBox={[0, 0, DONUT, DONUT]} d={arc(DONUT / 2, DONUT / 2, r, a0, a1)} stroke={c.tint} strokeWidth={18} strokeCap="round" />;
        })}
        <Column width="fill" height="fill" align="center" justify="center" gap={0}>
          <Text fontSize={24} fontWeight={700} tabularNums color={color.espresso}>
            {data.cups.toLocaleString("en-US")}
          </Text>
          <Text fontSize={11} color={color.muted}>
            {`${range}杯数`}
          </Text>
        </Column>
      </Frame>
      <Column width="fill" gap={8} align="stretch">
        {CATEGORIES.map((c, i) => (
          <Row key={c.label} gap={8} align="center">
            <Rect width={10} height={10} cornerRadius={3} fill={c.tint} />
            <Text width="fill" fontSize={13} color={color.espresso}>
              {c.label}
            </Text>
            <Text fontSize={13} fontWeight={600} tabularNums color={color.espresso}>
              {`${Math.round(data.shares[i] * 100)}%`}
            </Text>
          </Row>
        ))}
      </Column>
    </Row>
  );
}

function DonutSkeleton() {
  return (
    <Row gap={24} align="center">
      <Ellipse width={DONUT} height={DONUT} stroke="#efe5d9" strokeWidth={18} strokeAlign="inside" />
      <Column width="fill" gap={12} align="stretch">
        {[0, 1, 2, 3, 4].map((i) => (
          <Bone key={i} width="fill" height={10} opacity={i % 2 ? 0.7 : 1} />
        ))}
      </Column>
    </Row>
  );
}

// ------------------------------------------------------------------ stock table

const STOCK_COLUMNS: Track[] = ["2.2fr", "1fr", "1fr", "1.6fr", "1fr"];

const STOCK: { item: string; spec: string; left: string; daily: string; days: number; tone: Tone; status: string }[] = [
  { item: "燕麦奶", spec: "Oatly 咖啡师版 1L", left: "6 盒", daily: "9 盒", days: 0.7, tone: "danger", status: "告急" },
  { item: "金桂糖浆", spec: "自制 · 750ml", left: "2 瓶", daily: "1.5 瓶", days: 1.3, tone: "warning", status: "偏低" },
  { item: "耶加雪菲熟豆", spec: "浅烘 · 批次 1108", left: "3.2 kg", daily: "1.1 kg", days: 2.9, tone: "warning", status: "偏低" },
  { item: "冰杯 16oz", spec: "PET · 带盖", left: "1,200 只", daily: "310 只", days: 3.9, tone: "success", status: "充足" },
];

function StockRow({ cells, header = false, last = false }: { cells: ReactNode[]; header?: boolean; last?: boolean }) {
  return (
    <Grid columns={STOCK_COLUMNS} columnGap={12} align="center" padding={[header ? 0 : 10, 4, header ? 10 : 10, 4]} stroke={color.oat} strokeWidth={last ? 0 : [0, 0, 1, 0]} strokeAlign="inside">
      {cells}
    </Grid>
  );
}

function StockTable() {
  return (
    <Column gap={0} align="stretch">
      <StockRow
        header
        cells={["品项", "库存", "日均消耗", "预计可用", "状态"].map((h) => (
          <Text key={h} fontSize={12} fontWeight={600} color={color.muted}>
            {h}
          </Text>
        ))}
      />
      {STOCK.map((s, i) => (
        <StockRow
          key={s.item}
          last={i === STOCK.length - 1}
          cells={[
            <Text key="i" width="fill" maxLines={1} fontSize={14} fontWeight={600} color={color.espresso}>
              {s.item}
              <Span fontSize={12} fontWeight={400} color={color.muted}>
                {`  ${s.spec}`}
              </Span>
            </Text>,
            <Text key="l" fontSize={14} tabularNums color={color.espresso}>
              {s.left}
            </Text>,
            <Text key="d" fontSize={14} tabularNums color={color.muted}>
              {s.daily}
            </Text>,
            <Row key="b" gap={8} align="center">
              <ProgressBar value={Math.min(1, s.days / 5)} height={6} tint={s.tone === "danger" ? color.tomato : s.tone === "warning" ? "#d9a03a" : color.sage} />
              <Text width={44} fontSize={13} fontWeight={600} tabularNums color={color.espresso}>
                {`${s.days} 天`}
              </Text>
            </Row>,
            <Row key="s">
              <Badge tone={s.tone} dot>
                {s.status}
              </Badge>
            </Row>,
          ]}
        />
      ))}
    </Column>
  );
}

// ------------------------------------------------------------------ top products

const TOP = [byId.osmanthus, byId.iced, byId.americano, byId.pourover];

function TopProducts({ cups }: { cups: number[] }) {
  return (
    <Column gap={14} align="stretch">
      {TOP.map((p, i) => (
        <Row key={p.id} gap={12} align="center">
          <Text width={14} fontFamily={font.mono} fontSize={13} fontWeight={700} color={i === 0 ? color.caramelText : color.muted}>
            {String(i + 1)}
          </Text>
          <Image src={p.image} width={36} height={36} cornerRadius={8} />
          <Column width="fill" gap={6} align="stretch">
            <Row justify="space-between">
              <Text width="fill" maxLines={1} fontSize={13} fontWeight={600} color={color.espresso}>
                {p.name}
              </Text>
              <Text fontSize={13} fontWeight={600} tabularNums color={color.espresso}>
                {cups[i].toLocaleString("en-US")}
                <Span fontSize={11} fontWeight={400} color={color.muted}>
                  {" 杯"}
                </Span>
              </Text>
            </Row>
            <ProgressBar value={cups[i] / cups[0]} height={5} tint={i === 0 ? color.caramel : color.oatStrong} track={color.crema} />
          </Column>
        </Row>
      ))}
    </Column>
  );
}

/** Rows of placeholders for a list or table that is still loading. */
function ListSkeleton({ rows, thumb = true }: { rows: number; thumb?: boolean }) {
  return (
    <Column gap={14} align="stretch">
      {Array.from({ length: rows }, (_, i) => (
        <Row key={i} gap={12} align="center">
          {thumb && <Bone width={36} height={36} radius={8} />}
          <Column width="fill" gap={8} align="stretch">
            <Bone width={i % 2 ? 140 : 180} height={12} />
            <Bone width="fill" height={8} opacity={0.7} />
          </Column>
          <Bone width={48} height={20} radius={10} />
        </Row>
      ))}
    </Column>
  );
}

// ------------------------------------------------------------------ page

/**
 * The manager's overview. Variants: the reporting range, and the data state (normal, empty
 * before opening, POS error, loading). In Play mode the range control switches ranges, and
 * 开始营业 / 重试 move the empty and error states back to normal.
 */
export function Dashboard() {
  const [range, setRange] = useVariant("时间范围", ["今日", "本周", "本月"] as Range[]);
  const [status, setStatus] = useVariant("数据状态", ["正常", "空", "错误", "加载"] as Status[]);
  const data = RANGES[range];
  const loading = status === "加载";
  const empty = status === "空";
  const error = status === "错误";

  return (
    <Frame width={1440} height={900} fill={color.crema}>
      <Row width="fill" height="fill" align="stretch">
        <Sidebar />
        <Column width="fill" height="fill" padding={[24, 32]} gap={20} align="stretch">
          <Row gap={16} align="center">
            <Column width="fill" gap={4}>
              <Text fontFamily={font.display} fontSize={30} fontWeight={600} color={color.espresso}>
                经营概览
              </Text>
              {error ? (
                <Row gap={6} align="center">
                  <Icon name="triangleAlert" size={14} tint={color.tomato} />
                  <Text fontSize={13} color={color.tomato}>
                    门店 POS 连接超时，数据停留在 <Span fontFamily={font.mono}>14:31</Span>
                  </Text>
                  <Text fontSize={13} fontWeight={700} color={color.tomato} textDecoration="underline" onClick={() => setStatus("正常")}>
                    重试
                  </Text>
                </Row>
              ) : (
                <Text fontSize={13} color={color.muted}>
                  {`武康路店 · ${data.period} · `}
                  {loading ? "正在同步门店数据…" : "数据更新于 "}
                  {!loading && <Span fontFamily={font.mono}>14:32</Span>}
                </Text>
              )}
            </Column>
            <Input placeholder="搜索订单号、会员、商品" icon="search" width={260} />
            <Segmented options={["今日", "本周", "本月"]} value={range} onChange={(v) => setRange(v as Range)} width={210} />
            <Button variant="outline" icon="download" disabled={loading || empty}>
              导出报表
            </Button>
          </Row>

          <Grid columns={4} gap={16}>
            {data.kpis.map((k) => (loading ? <KpiSkeleton key={k.label} /> : <Kpi key={k.label} data={k} compare={data.compare} empty={empty} />))}
          </Grid>

          <Row height={330} gap={16} align="stretch">
            <Panel
              title={data.series.title}
              grow={2}
              action={
                !loading &&
                !empty && (
                  <Row gap={16}>
                    <Legend tint={color.caramel} label={data.series.legend[0]} />
                    <Legend tint={color.subtle} label={data.series.legend[1]} dashed />
                  </Row>
                )
              }
            >
              {loading ? (
                <ChartSkeleton />
              ) : empty ? (
                <EmptyState
                  icon="coffee"
                  title="还没有订单"
                  body="开门营业后，小程序与外卖订单会实时出现在这里。"
                  action={
                    <Button variant="secondary" size="sm" icon="store" onClick={() => setStatus("正常")}>
                      开始营业
                    </Button>
                  }
                />
              ) : (
                <SalesChart s={data.series} />
              )}
            </Panel>
            <Panel title="品类占比" width={440} action={<Text fontSize={12} color={color.muted}>按杯数</Text>}>
              {loading ? (
                <DonutSkeleton />
              ) : empty ? (
                <EmptyState icon="chartColumn" title="暂无数据" body="有订单后按品类统计杯数。" />
              ) : (
                <>
                  <Donut range={range} data={data} />
                  <Row padding={12} gap={10} align="center" cornerRadius={12} fill={color.caramelSoft}>
                    <Icon name="sparkles" size={16} tint={color.roast} />
                    <Text width="fill" fontSize={12} lineHeight={17} color={color.roast}>
                      桂花拿铁上线 9 天，拉动拿铁类占比 <Span fontWeight={700}>+7%</Span>，可考虑在午市加推第二杯半价。
                    </Text>
                  </Row>
                </>
              )}
            </Panel>
          </Row>

          <Row height="fill" gap={16} align="stretch">
            <Panel
              title="库存预警"
              grow={2}
              action={
                !loading &&
                !error && (
                  <Button variant="secondary" size="sm" icon="package">
                    一键补货
                  </Button>
                )
              }
            >
              {loading ? (
                <ListSkeleton rows={4} thumb={false} />
              ) : error ? (
                <EmptyState
                  tone="error"
                  icon="triangleAlert"
                  title="库存数据加载失败"
                  action={
                    <Row gap={8} align="center">
                      <Button variant="danger" size="sm" icon="refreshCw" onClick={() => setStatus("正常")}>
                        重试
                      </Button>
                      <Text fontFamily={font.mono} fontSize={11} color={color.muted}>
                        ERR_POS_TIMEOUT · 14:31
                      </Text>
                    </Row>
                  }
                />
              ) : (
                <StockTable />
              )}
            </Panel>
            <Panel title="热销单品" width={440} action={<Text fontSize={12} color={color.muted}>{`${range} · 杯`}</Text>}>
              {loading ? <ListSkeleton rows={4} /> : empty ? <EmptyState icon="cupSoda" title="暂无销量" /> : <TopProducts cups={data.top} />}
            </Panel>
          </Row>
        </Column>
      </Row>
    </Frame>
  );
}
