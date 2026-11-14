// Store manager console (web, 1440 x 900): today's numbers, stock and states.
import { Column, Ellipse, Frame, Grid, Image, Path, Rect, Row, Span, Text } from "artboards";
import type { Track } from "artboards";
import type { ReactNode } from "react";
import { Avatar, Badge, Button, Icon, Input, ProgressBar, Segmented, Sparkline, plot, smoothPath, type Tone } from "./components.tsx";
import { byId, products } from "./data.ts";
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

// ------------------------------------------------------------------ KPIs

function Kpi({ icon, label, value, unit, delta, spark, tint }: { icon: IconName; label: string; value: string; unit?: string; delta: number; spark: number[]; tint: string }) {
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
      <Row align="end" justify="space-between">
        <Column gap={6}>
          <Text fontSize={28} fontWeight={700} tabularNums color={color.espresso}>
            {value}
            {unit && (
              <Span fontSize={14} fontWeight={500} color={color.muted}>
                {` ${unit}`}
              </Span>
            )}
          </Text>
          <Row gap={4} align="center">
            <Icon name={up ? "trendingUp" : "trendingDown"} size={14} tint={up ? color.sage : color.tomato} />
            <Text fontSize={12} fontWeight={600} tabularNums color={up ? color.sage : color.tomato}>
              {`${up ? "+" : ""}${delta.toFixed(1)}%`}
            </Text>
            <Text fontSize={12} color={color.muted}>
              较上周同日
            </Text>
          </Row>
        </Column>
        <Sparkline data={spark} width={96} height={40} tint={tint} />
      </Row>
    </Column>
  );
}

// ------------------------------------------------------------------ sales chart

const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const TODAY = [12, 46, 58, 34, 28, 41, 52, 61, 44, 38, 30, 24, 18, 14, 8];
const LAST_WEEK = [10, 38, 50, 36, 25, 36, 44, 47, 40, 33, 28, 26, 20, 12, 9];

function SalesChart() {
  // Plot width = panel (1128 - 16 - 440 - 2 * 20 padding) minus the y-axis column.
  const W = 600;
  const H = 210;
  const max = 70;
  const today = plot(TODAY.slice(0, 8), (W * 7) / 14, H, max, 0); // up to 14:00
  const last = plot(LAST_WEEK, W, H, max, 0);
  const line = smoothPath(today);
  const [hx, hy] = today[7];
  return (
    <Column width="fill" height="fill" gap={8} align="stretch">
      <Row width="fill" height="fill" gap={10}>
        <Column height="fill" justify="space-between" align="end" padding={[0, 0, 20, 0]}>
          {[70, 50, 25, 0].map((v) => (
            <Text key={v} fontSize={11} tabularNums color={color.muted}>
              {v}
            </Text>
          ))}
        </Column>
        <Frame name="Plot" width={W} height={H}>
          {[0, 1, 2, 3].map((i) => (
            <Rect key={i} x={0} y={Math.min(H - 1, (H * i) / 3)} width="fill" height={1} fill={i === 3 ? color.oatStrong : color.oat} />
          ))}
          <Path width={W} height={H} viewBox={[0, 0, W, H]} d={smoothPath(last)} stroke={color.subtle} strokeWidth={1.5} strokeDash={[4, 4]} />
          <Path width={W} height={H} viewBox={[0, 0, W, H]} d={`${line} L ${hx} ${H} L 0 ${H} Z`} fill={{ type: "linear", angle: 180, stops: ["rgba(196, 119, 59, 0.32)", "rgba(196, 119, 59, 0)"] }} />
          <Path width={W} height={H} viewBox={[0, 0, W, H]} d={line} stroke={color.caramel} strokeWidth={3} strokeCap="round" strokeJoin="round" />
          <Rect x={hx} y={0} width={1} height={H} fill={color.roast} opacity={0.35} />
          <Ellipse x={hx - 6} y={hy - 6} width={12} height={12} fill={color.white} stroke={color.caramel} strokeWidth={3} />
          <Column x={hx + 14} y={Math.max(0, hy - 30)} padding={[10, 12]} gap={4} cornerRadius={10} fill={color.espresso} shadow={shadow.float}>
            <Text fontSize={11} color={color.oatStrong}>
              14:00 – 15:00
            </Text>
            <Text fontSize={14} fontWeight={700} tabularNums color={color.white}>
              61 杯 <Span fontSize={11} fontWeight={600} color="#8fd19e">+29.8%</Span>
            </Text>
            <Text fontSize={11} tabularNums color={color.oatStrong}>
              上周同时段 47 杯
            </Text>
          </Column>
        </Frame>
      </Row>
      <Row padding={[0, 0, 0, 30]} justify="space-between">
        {HOURS.filter((h) => h % 2 === 1).map((h) => (
          <Text key={h} fontSize={11} tabularNums color={color.muted}>
            {`${h}:00`}
          </Text>
        ))}
      </Row>
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
  { label: "拿铁类", share: 0.46, tint: color.roast },
  { label: "美式 / 冷萃", share: 0.22, tint: color.caramel },
  { label: "手冲", share: 0.12, tint: "#8a9a5b" },
  { label: "烘焙甜点", share: 0.14, tint: "#d9b38c" },
  { label: "零售豆", share: 0.06, tint: color.oatStrong },
];

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)].map((n) => n.toFixed(2)).join(" ");
  return `M ${p(a0)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`;
}

function Donut() {
  const size = 140;
  const r = 56;
  const gap = 0.04;
  let at = 0;
  return (
    <Row gap={24} align="center">
      <Frame width={size} height={size}>
        {CATEGORIES.map((c) => {
          const a0 = at * Math.PI * 2 + gap;
          at += c.share;
          const a1 = at * Math.PI * 2 - gap;
          return <Path key={c.label} width={size} height={size} viewBox={[0, 0, size, size]} d={arc(size / 2, size / 2, r, a0, a1)} stroke={c.tint} strokeWidth={18} strokeCap="round" />;
        })}
        <Column width="fill" height="fill" align="center" justify="center" gap={0}>
          <Text fontSize={24} fontWeight={700} tabularNums color={color.espresso}>
            412
          </Text>
          <Text fontSize={11} color={color.muted}>
            今日杯数
          </Text>
        </Column>
      </Frame>
      <Column width="fill" gap={8} align="stretch">
        {CATEGORIES.map((c) => (
          <Row key={c.label} gap={8} align="center">
            <Rect width={10} height={10} cornerRadius={3} fill={c.tint} />
            <Text width="fill" fontSize={13} color={color.espresso}>
              {c.label}
            </Text>
            <Text fontSize={13} fontWeight={600} tabularNums color={color.espresso}>
              {`${Math.round(c.share * 100)}%`}
            </Text>
          </Row>
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

const TOP = [
  { p: byId.osmanthus, cups: 128 },
  { p: byId.iced, cups: 96 },
  { p: byId.americano, cups: 74 },
  { p: byId.pourover, cups: 31 },
];

function TopProducts() {
  return (
    <Column gap={14} align="stretch">
      {TOP.map(({ p, cups }, i) => (
        <Row key={p.id} gap={12} align="center">
          <Text width={14} fontFamily={font.mono} fontSize={13} fontWeight={700} color={i === 0 ? color.caramelText : color.muted}>
            {i + 1}
          </Text>
          <Image src={p.image} width={36} height={36} cornerRadius={8} />
          <Column width="fill" gap={6} align="stretch">
            <Row justify="space-between">
              <Text width="fill" maxLines={1} fontSize={13} fontWeight={600} color={color.espresso}>
                {p.name}
              </Text>
              <Text fontSize={13} fontWeight={600} tabularNums color={color.espresso}>
                {cups}
                <Span fontSize={11} fontWeight={400} color={color.muted}>
                  {" 杯"}
                </Span>
              </Text>
            </Row>
            <ProgressBar value={cups / TOP[0].cups} height={5} tint={i === 0 ? color.caramel : color.oatStrong} track={color.crema} />
          </Column>
        </Row>
      ))}
    </Column>
  );
}

// ------------------------------------------------------------------ page

export function Dashboard() {
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
              <Text fontSize={13} color={color.muted}>
                武康路店 · 2026 年 11 月 15 日 周日 · 数据更新于 <Span fontFamily={font.mono}>14:32</Span>
              </Text>
            </Column>
            <Input placeholder="搜索订单号、会员、商品" icon="search" width={260} />
            <Segmented options={["今日", "本周", "本月"]} value="今日" width={210} />
            <Button variant="outline" icon="download">
              导出报表
            </Button>
          </Row>

          <Grid columns={4} gap={16}>
            <Kpi icon="wallet" label="营业额" value="¥18,240" delta={12.4} spark={[8, 12, 10, 14, 13, 17, 18]} tint={color.caramel} />
            <Kpi icon="receipt" label="订单数" value="412" unit="单" delta={8.1} spark={[30, 34, 31, 36, 40, 38, 41]} tint={color.roast} />
            <Kpi icon="users" label="客单价" value="¥44.3" delta={-2.6} spark={[47, 46, 46, 45, 44, 45, 44]} tint={color.sky} />
            <Kpi icon="refreshCw" label="会员复购率" value="38" unit="%" delta={4.2} spark={[30, 31, 33, 32, 35, 36, 38]} tint={color.sage} />
          </Grid>

          <Row height={330} gap={16} align="stretch">
            <Panel
              title="分时段出杯"
              grow={2}
              action={
                <Row gap={16}>
                  <Legend tint={color.caramel} label="今日" />
                  <Legend tint={color.subtle} label="上周同日" dashed />
                </Row>
              }
            >
              <SalesChart />
            </Panel>
            <Panel title="品类占比" width={440} action={<Text fontSize={12} color={color.muted}>按杯数</Text>}>
              <Donut />
              <Row padding={12} gap={10} align="center" cornerRadius={12} fill={color.caramelSoft}>
                <Icon name="sparkles" size={16} tint={color.roast} />
                <Text width="fill" fontSize={12} lineHeight={17} color={color.roast}>
                  桂花拿铁上线 9 天，拉动拿铁类占比 <Span fontWeight={700}>+7%</Span>，可考虑在午市加推第二杯半价。
                </Text>
              </Row>
            </Panel>
          </Row>

          <Row height="fill" gap={16} align="stretch">
            <Panel
              title="库存预警"
              grow={2}
              action={
                <Button variant="secondary" size="sm" icon="package">
                  一键补货
                </Button>
              }
            >
              <StockTable />
            </Panel>
            <Panel title="热销单品" width={440} action={<Text fontSize={12} color={color.muted}>今日 · 杯</Text>}>
              <TopProducts />
            </Panel>
          </Row>
        </Column>
      </Row>
    </Frame>
  );
}

// ------------------------------------------------------------------ states

function StateCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Column width="fill" gap={12} align="stretch">
      <Text fontFamily={font.mono} fontSize={11} color={color.muted}>
        {title}
      </Text>
      <Column width="fill" height={300} padding={20} gap={16} fill={color.white} cornerRadius={radius.lg} shadow={shadow.card} align="stretch">
        {children}
      </Column>
    </Column>
  );
}

const SHIMMER = { type: "linear" as const, angle: 90, stops: [color.crema, "#efe5d9", color.crema] };

export function DashboardStates() {
  return (
    <Row width={1200} padding={32} gap={24} fill={color.crema}>
      <StateCard title="empty · 今日暂无订单">
        <Text fontSize={16} fontWeight={700} color={color.espresso}>
          今日订单
        </Text>
        <Column width="fill" height="fill" gap={12} align="center" justify="center" cornerRadius={radius.md} stroke={color.oatStrong} strokeDash={[6, 5]} strokeAlign="inside">
          <Row width={56} height={56} align="center" justify="center" cornerRadius={28} fill={color.caramelSoft}>
            <Icon name="coffee" size={26} tint={color.roast} />
          </Row>
          <Text fontSize={15} fontWeight={700} color={color.espresso}>
            还没有订单
          </Text>
          <Text width={220} textAlign="center" fontSize={13} lineHeight={19} color={color.muted}>
            开门营业后，小程序与外卖订单会实时出现在这里。
          </Text>
          <Button variant="secondary" size="sm" icon="store">
            开始营业
          </Button>
        </Column>
      </StateCard>

      <StateCard title="error · 加载失败">
        <Text fontSize={16} fontWeight={700} color={color.espresso}>
          库存预警
        </Text>
        <Column width="fill" height="fill" gap={12} align="center" justify="center" cornerRadius={radius.md} fill={color.tomatoSoft}>
          <Row width={56} height={56} align="center" justify="center" cornerRadius={28} fill={color.white}>
            <Icon name="triangleAlert" size={26} tint={color.tomato} />
          </Row>
          <Text fontSize={15} fontWeight={700} color={color.espresso}>
            库存数据加载失败
          </Text>
          <Text width={240} textAlign="center" fontSize={13} lineHeight={19} color={color.muted}>
            门店 POS 暂时无法连接，已显示的数字可能不是最新。
          </Text>
          <Row gap={8} align="center">
            <Button variant="danger" size="sm" icon="refreshCw">
              重试
            </Button>
            <Text fontFamily={font.mono} fontSize={11} color={color.muted}>
              ERR_POS_TIMEOUT · 14:31
            </Text>
          </Row>
        </Column>
      </StateCard>

      <StateCard title="loading · 骨架屏">
        <Rect width={120} height={16} cornerRadius={6} fill={SHIMMER} />
        {[0, 1, 2, 3].map((i) => (
          <Row key={i} gap={12} align="center">
            <Rect width={40} height={40} cornerRadius={10} fill={SHIMMER} />
            <Column width="fill" gap={8} align="stretch">
              <Rect width={i % 2 ? 140 : 180} height={12} cornerRadius={5} fill={SHIMMER} />
              <Rect width="fill" height={10} cornerRadius={5} fill={SHIMMER} opacity={0.7} />
            </Column>
            <Rect width={48} height={22} cornerRadius={11} fill={SHIMMER} />
          </Row>
        ))}
      </StateCard>
    </Row>
  );
}

export { products };
