// Customer app (iPhone, 390 x 844): browse, customise, pay, track, membership.
import { Column, Ellipse, Frame, Grid, Image, Path, Rect, Row, Span, Text, useState, useVariant } from "artboards";
import type { ReactNode } from "react";
import {
  Avatar,
  Badge,
  Button,
  Chip,
  Divider,
  HomeIndicator,
  Icon,
  Input,
  Phone,
  Price,
  ProductCard,
  ProgressBar,
  SectionHeader,
  Segmented,
  StatusBar,
  Stepper,
  TabBar,
} from "./components.tsx";
import { byId, images, products, yuan } from "./data.ts";
import type { IconName } from "./icons.ts";
import { color, font, radius, shadow } from "./tokens.ts";

/** Backdrop colour of the latte photo, sampled from its left edge. */
const PROMO_BG = "#e4ccb5";

/** Member card: near-black roast with a single brass accent. */
const CARD = { bg: "#1e1510", edge: "rgba(255, 236, 214, 0.08)", text: "#f6efe6", muted: "#ab9888", brass: "#c9a46a" };

// ------------------------------------------------------------------ pieces

function Card({ children, padding = 16, gap = 12 }: { children: ReactNode; padding?: number; gap?: number }) {
  return (
    <Column width="fill" padding={padding} gap={gap} fill={color.white} cornerRadius={radius.lg} shadow={shadow.card} align="stretch">
      {children}
    </Column>
  );
}

function RoundButton({ icon, light = false, badge = false }: { icon: IconName; light?: boolean; badge?: boolean }) {
  return (
    <Row width={40} height={40} align="center" justify="center" cornerRadius={20} fill={light ? "rgba(255, 255, 255, 0.92)" : color.white} shadow={shadow.card}>
      <Icon name={icon} size={20} />
      {badge && <Ellipse absolute right={9} y={9} width={9} height={9} fill={color.tomato} stroke={color.white} strokeWidth={2} strokeAlign="outside" />}
    </Row>
  );
}

function NavBar({ title }: { title: string }) {
  return (
    <Row width="fill" height={48} padding={[0, 16]} align="center" justify="space-between">
      <RoundButton icon="chevronLeft" />
      <Text fontSize={17} fontWeight={700} color={color.espresso}>
        {title}
      </Text>
      <Rect width={40} height={40} />
    </Row>
  );
}

function OptionGroup({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <Column width="fill" gap={10} align="stretch">
      <Row align="end" gap={8}>
        <Text fontSize={14} fontWeight={700} color={color.espresso}>
          {title}
        </Text>
        {note && (
          <Text fontSize={12} color={color.muted}>
            {note}
          </Text>
        )}
      </Row>
      {children}
    </Column>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <Row width={44} height={26} padding={3} cornerRadius={13} fill={on ? color.sage : color.oatStrong} justify={on ? "end" : "start"}>
      <Ellipse width={20} height={20} fill={color.white} shadow={{ y: 1, blur: 2, color: "rgba(0,0,0,0.2)" }} />
    </Row>
  );
}

function KeyValue({ label, value, tint = color.espresso, strong = false }: { label: string; value: string; tint?: string; strong?: boolean }) {
  return (
    <Row width="fill" align="center" justify="space-between">
      <Text fontSize={strong ? 15 : 14} fontWeight={strong ? 700 : 400} color={strong ? color.espresso : color.muted}>
        {label}
      </Text>
      <Text fontSize={strong ? 15 : 14} fontWeight={strong ? 700 : 500} tabularNums color={tint}>
        {value}
      </Text>
    </Row>
  );
}

// ------------------------------------------------------------------ home

function HomeBody() {
  return (
    <Column width="fill" height="fill" clip align="stretch">
      <StatusBar />
      {/* Bottom padding keeps the last cards clear of the cart bar and tab bar. */}
      <Column name="Feed" height="fill" scroll="vertical" padding={[6, 20, 180, 20]} gap={16} align="stretch">
        <Row align="center" justify="space-between">
          <Column gap={4}>
            <Text fontSize={22} fontWeight={700} color={color.espresso}>
              早上好，林小满
            </Text>
            <Row gap={4} align="center">
              <Icon name="mapPin" size={14} tint={color.caramelText} />
              <Text fontSize={13} color={color.muted}>
                焙刻 · 武康路店 <Span color={color.subtle}>· 320m</Span>
              </Text>
              <Icon name="chevronRight" size={12} tint={color.muted} />
            </Row>
          </Column>
          <RoundButton icon="bell" badge />
        </Row>

        <Row gap={10} align="center">
          <Input placeholder="搜索 桂花拿铁、冷萃、可颂…" icon="search" />
          <Row width={44} height={44} align="center" justify="center" cornerRadius={radius.md} fill={color.espresso}>
            <Icon name="slidersHorizontal" size={18} tint={color.white} />
          </Row>
        </Row>

        {/* Editorial banner: the photo's own backdrop colour carries the copy, so there is no seam and no decoration. */}
        <Frame name="Promo" width="fill" height={156} cornerRadius={20} fill={PROMO_BG} clip>
          <Image src={images.latte} right={-28} y={0} width={234} height={156} />
          <Rect x={144} y={0} width={64} height="fill" fill={{ type: "linear", angle: 90, stops: [PROMO_BG, `${PROMO_BG}00`] }} />
          <Column x={20} y={20} width={170} gap={4}>
            <Text fontSize={11} fontWeight={700} letterSpacing={1.5} color={color.roast}>
              秋季限定 · AUTUMN
            </Text>
            <Text fontFamily={font.display} fontSize={28} lineHeight={30} fontWeight={600} color={color.espresso}>
              Osmanthus <Span italic fontWeight={400}>Latte</Span>
            </Text>
          </Column>
          <Row x={20} bottom={18} gap={6} align="center">
            <Text fontSize={13} fontWeight={600} color={color.espresso}>
              第二杯半价
            </Text>
            <Icon name="arrowRight" size={14} tint={color.espresso} weight={2.2} />
          </Row>
          <Row right={14} bottom={14} gap={4}>
            <Rect width={14} height={4} cornerRadius={2} fill={color.espresso} />
            <Rect width={4} height={4} cornerRadius={2} fill="rgba(43, 26, 18, 0.25)" />
            <Rect width={4} height={4} cornerRadius={2} fill="rgba(43, 26, 18, 0.25)" />
          </Row>
        </Frame>

        <Row width="fill" gap={8} scroll="horizontal">
          <Chip selected>推荐</Chip>
          <Chip icon="coffee">拿铁</Chip>
          <Chip>美式</Chip>
          <Chip icon="snowflake">冷萃</Chip>
          <Chip>手冲</Chip>
          <Chip icon="croissant">烘焙</Chip>
        </Row>

        <SectionHeader title="人气推荐" action="全部 24 款" />
        <Grid columns={2} gap={12}>
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} count={i === 0 ? 1 : 0} />
          ))}
        </Grid>
      </Column>
    </Column>
  );
}

function CartBar() {
  return (
    <Row name="CartBar" absolute x={16} right={16} bottom={102} height={60} padding={[0, 8, 0, 10]} gap={12} align="center" cornerRadius={30} fill={color.espresso} shadow={shadow.float}>
      <Row width={42} height={42} align="center" justify="center" cornerRadius={21} fill={color.caramel}>
        <Icon name="shoppingBag" size={20} tint={color.white} />
        <Row absolute right={-4} y={-4} width={20} height={20} align="center" justify="center" cornerRadius={10} fill={color.tomato} stroke={color.espresso} strokeWidth={2} strokeAlign="outside">
          <Text fontSize={11} fontWeight={700} color={color.white}>
            3
          </Text>
        </Row>
      </Row>
      <Column width="fill" gap={1}>
        <Price value={78} size={20} tint={color.white} />
        <Text fontSize={11} color={color.oatStrong}>
          已减 ¥8 · 免打包费
        </Text>
      </Column>
      <Row height={44} padding={[0, 20]} align="center" cornerRadius={22} fill={color.caramelSoft}>
        <Text fontSize={15} fontWeight={700} color={color.roast}>
          去结算
        </Text>
      </Row>
    </Row>
  );
}

export function Home() {
  return (
    <Phone>
      <HomeBody />
      <CartBar />
      <TabBar active="首页" />
    </Phone>
  );
}

// ------------------------------------------------------------------ product sheet

const TEMPS = [
  ["热", "flame"],
  ["冰", "snowflake"],
  ["少冰", undefined],
  ["去冰", undefined],
] as const satisfies readonly (readonly [string, IconName | undefined])[];

export function ProductSheet() {
  const p = byId.osmanthus;
  const [size, setSize] = useState("大杯 16oz");
  const [temp, setTemp] = useVariant("温度", TEMPS.map(([t]) => t));
  return (
    <Phone>
      <HomeBody />
      <Rect name="Scrim" width="fill" height="fill" fill={color.scrim} />
      <Column name="Sheet" absolute x={0} bottom={0} width="fill" padding={[10, 20, 0, 20]} gap={16} cornerRadius={[28, 28, 0, 0]} fill={color.foam} shadow={shadow.sheet} align="stretch">
        <Row width="fill" justify="center">
          <Rect width={36} height={5} cornerRadius={3} fill={color.oatStrong} />
        </Row>
        <Frame width="fill" height={150} cornerRadius={20} clip>
          <Image src={p.image} width="fill" height="fill" />
          <Row right={12} y={12}>
            <RoundButton icon="x" light />
          </Row>
          <Row x={12} bottom={12} gap={6}>
            <Badge tone="brand">{p.tag}</Badge>
            <Badge tone="success" dot>
              热销 · 今日 128 杯
            </Badge>
          </Row>
        </Frame>
        <Column gap={4} align="stretch">
          <Row align="end" justify="space-between">
            <Text fontSize={22} fontWeight={700} color={color.espresso}>
              {p.name}
            </Text>
            <Icon name="heart" size={22} tint={color.tomato} />
          </Row>
          <Text fontFamily={font.display} italic fontSize={15} color={color.caramelText}>
            {p.en}
          </Text>
          <Text width="fill" maxLines={2} fontSize={13} lineHeight={19} color={color.muted}>
            自熬金桂糖浆搭配燕麦奶与双份浓缩，入口是桂花的清甜，尾韵带一点烘焙坚果香。
          </Text>
        </Column>
        <OptionGroup title="杯型">
          <Segmented options={["中杯 12oz", "大杯 16oz", "超大杯 20oz"]} value={size} onChange={setSize} />
        </OptionGroup>
        <OptionGroup title="温度">
          <Row gap={8}>
            {TEMPS.map(([t, icon]) => (
              <Chip key={t} icon={icon} selected={t === temp} onClick={() => setTemp(t)}>
                {t}
              </Chip>
            ))}
          </Row>
        </OptionGroup>
        <OptionGroup title="奶基" note="燕麦奶 +¥3 已含">
          <Row gap={8}>
            <Chip icon="leaf" selected>
              燕麦奶
            </Chip>
            <Chip icon="milk">全脂奶</Chip>
            <Chip>生椰乳</Chip>
          </Row>
        </OptionGroup>
        <OptionGroup title="甜度">
          <Row gap={8}>
            <Chip>标准</Chip>
            <Chip selected>少甜</Chip>
            <Chip>不另外加糖</Chip>
          </Row>
        </OptionGroup>
        <Column gap={0} align="stretch" stroke={color.oat} strokeWidth={[1, 0, 0, 0]} strokeAlign="inside" padding={[14, 0, 0, 0]}>
          <Row gap={16} align="center">
            <Column width="fill" gap={2}>
              <Price value={p.price} was={p.was} size={26} />
              <Text fontSize={11} color={color.muted}>
                {`${size.split(" ")[0]} · ${temp} · 燕麦奶 · 少甜`}
              </Text>
            </Column>
            <Stepper value={1} />
          </Row>
          <Row padding={[14, 0, 0, 0]}>
            <Button size="lg" width="fill" icon="shoppingBag">
              加入购物车
            </Button>
          </Row>
          <HomeIndicator />
        </Column>
      </Column>
    </Phone>
  );
}

// ------------------------------------------------------------------ checkout

const CART = [
  { product: byId.osmanthus, options: "大杯 · 热 · 燕麦奶 · 少甜", qty: 2 },
  { product: byId.iced, options: "大杯 · 少冰 · 标准甜", qty: 1 },
  { product: byId.croissant, options: "加热", qty: 1 },
];

export function Checkout() {
  return (
    <Phone>
      <Column width="fill" height="fill" align="stretch">
        <StatusBar />
        <NavBar title="确认订单" />
        <Column width="fill" height="fill" padding={[8, 16, 140, 16]} gap={12} clip align="stretch">
          <Segmented options={["到店自取", "外送"]} value="到店自取" />
          <Card>
            <Row gap={12} align="center">
              <Row width={44} height={44} align="center" justify="center" cornerRadius={radius.md} fill={color.caramelSoft}>
                <Icon name="store" size={22} tint={color.roast} />
              </Row>
              <Column width="fill" gap={3}>
                <Text fontSize={15} fontWeight={700} color={color.espresso}>
                  焙刻 · 武康路店
                </Text>
                <Text width="fill" maxLines={1} fontSize={12} color={color.muted}>
                  徐汇区武康路 378 号 · 距你 320m · 步行 4 分钟
                </Text>
              </Column>
              <Badge tone="success" dot>
                营业中
              </Badge>
            </Row>
            <Divider />
            <Row gap={8} align="center">
              <Icon name="clock" size={16} tint={color.caramelText} />
              <Text width="fill" fontSize={13} color={color.espresso}>
                预计 <Span fontWeight={700}>14:35</Span> 可取 · 前方 3 单
              </Text>
              <Text fontSize={13} fontWeight={600} color={color.roast}>
                修改时间
              </Text>
            </Row>
          </Card>

          <Card gap={14}>
            <Row justify="space-between" align="center">
              <Text fontSize={15} fontWeight={700} color={color.espresso}>
                已选 4 件
              </Text>
              <Text fontSize={13} color={color.muted}>
                清空
              </Text>
            </Row>
            {CART.map(({ product, options, qty }, i) => [
              i > 0 && <Divider key={`d${i}`} inset={68} />,
              <Row key={product.id} gap={12} align="center">
                <Image src={product.image} width={56} height={56} cornerRadius={12} />
                <Column width="fill" gap={3}>
                  <Text width="fill" maxLines={1} fontSize={14} fontWeight={600} color={color.espresso}>
                    {product.name}
                  </Text>
                  <Text width="fill" maxLines={1} fontSize={12} color={color.muted}>
                    {options}
                  </Text>
                  <Price value={product.price} size={15} />
                </Column>
                <Stepper value={qty} compact />
              </Row>,
            ])}
          </Card>

          <Card gap={14}>
            <Row gap={10} align="center">
              <Icon name="ticket" size={18} tint={color.tomato} />
              <Text width="fill" fontSize={14} color={color.espresso}>
                优惠券 <Span fontSize={12} color={color.muted}>秋季第二杯半价</Span>
              </Text>
              <Text fontSize={14} fontWeight={700} tabularNums color={color.tomato}>
                -¥8.00
              </Text>
              <Icon name="chevronRight" size={14} tint={color.muted} />
            </Row>
            <Divider inset={28} />
            <Row gap={10} align="center">
              <Icon name="gift" size={18} tint={color.caramelText} />
              <Text width="fill" fontSize={14} color={color.espresso}>
                积分抵扣 <Span fontSize={12} color={color.muted}>240 积分抵 ¥2.40</Span>
              </Text>
              <Toggle on />
            </Row>
            <Divider inset={28} />
            <Row gap={10} align="center">
              <Icon name="wallet" size={18} tint={color.sage} />
              <Text width="fill" fontSize={14} color={color.espresso}>
                支付方式
              </Text>
              <Text fontSize={14} color={color.muted}>
                微信支付
              </Text>
              <Icon name="chevronRight" size={14} tint={color.muted} />
            </Row>
          </Card>

          <Card gap={10}>
            <KeyValue label="商品金额" value={yuan(114)} />
            <KeyValue label="优惠券" value="-¥8.00" tint={color.tomato} />
            <KeyValue label="积分抵扣" value="-¥2.40" tint={color.tomato} />
            <KeyValue label="打包费" value={yuan(0)} />
          </Card>
        </Column>
      </Column>

      <Column name="PayBar" absolute x={0} bottom={0} width="fill" fill={color.white} stroke={color.oat} strokeWidth={[1, 0, 0, 0]} strokeAlign="inside" align="stretch">
        <Row padding={[14, 20, 4, 20]} gap={16} align="center">
          <Column width="fill" gap={2}>
            <Row gap={6} align="end">
              <Text fontSize={13} color={color.muted}>
                合计
              </Text>
              <Price value={103.6} size={24} />
            </Row>
            <Text fontSize={12} fontWeight={600} color={color.caramelText}>
              已为你节省 ¥10.40
            </Text>
          </Column>
          <Button size="lg" width={150}>
            立即支付
          </Button>
        </Row>
        <HomeIndicator />
      </Column>
    </Phone>
  );
}

// ------------------------------------------------------------------ tracking

const STEPS = ["已下单", "制作中", "待取餐", "已完成"];
/** Where the progress line stops for each step: just past that step's circle. */
const STEP_PROGRESS = [0.04, 0.38, 0.71, 1];
const STEP_ICONS: IconName[] = ["receipt", "coffee", "shoppingBag", "check"];

function Steps({ current }: { current: number }) {
  return (
    <Frame name="Steps" width="fill" height={54}>
      <Row x={30} right={30} y={13} height={3}>
        <ProgressBar value={STEP_PROGRESS[current]} height={3} tint={color.sage} />
      </Row>
      <Row width="fill" justify="space-between">
        {STEPS.map((label, i) => {
          const state = i < current ? "done" : i === current ? "active" : "todo";
          return (
            <Column key={label} width={60} gap={8} align="center">
              {state === "done" && (
                <Row width={28} height={28} align="center" justify="center" cornerRadius={14} fill={color.sage}>
                  <Icon name="check" size={16} tint={color.white} weight={2.6} />
                </Row>
              )}
              {state === "active" && (
                <Row width={28} height={28} align="center" justify="center" cornerRadius={14} fill={color.caramel} stroke="rgba(196, 119, 59, 0.25)" strokeWidth={6} strokeAlign="outside">
                  <Icon name={STEP_ICONS[i]} size={15} tint={color.white} weight={2.4} />
                </Row>
              )}
              {state === "todo" && <Rect width={28} height={28} cornerRadius={14} fill={color.foam} stroke={color.oatStrong} strokeWidth={2} strokeAlign="inside" />}
              <Text fontSize={12} fontWeight={state === "todo" ? 400 : 700} color={state === "todo" ? color.muted : color.espresso}>
                {label}
              </Text>
            </Column>
          );
        })}
      </Row>
    </Frame>
  );
}

function MapView() {
  return (
    <Frame name="Map" width="fill" height={420} fill="#ede4d7" clip>
      <Path width={390} height={420} viewBox="0 0 390 420" d="M 230 0 L 390 0 L 390 150 C 330 170 280 120 230 60 Z" fill="#d7e3cc" />
      <Path width={390} height={420} viewBox="0 0 390 420" d="M -20 330 C 80 300 160 360 260 330 C 320 312 360 290 410 300" stroke="#cfe0ea" strokeWidth={28} strokeCap="round" />
      <Path width={390} height={420} viewBox="0 0 390 420" d="M 0 120 L 390 210 M 120 0 L 60 420 M 300 0 L 250 420 M 0 260 L 390 250" stroke="#ffffff" strokeWidth={16} />
      <Path width={390} height={420} viewBox="0 0 390 420" d="M 0 40 L 390 90 M 190 0 L 170 420 M 0 190 L 390 330 M 30 0 L 0 140 M 360 120 L 330 420" stroke="#fbf7f1" strokeWidth={7} />
      <Text x={196} y={100} rotation={6} fontSize={11} fontWeight={600} letterSpacing={1} color={color.muted}>
        武康路
      </Text>
      <Text x={70} y={210} rotation={-80} fontSize={11} fontWeight={600} letterSpacing={1} color={color.muted}>
        湖南路
      </Text>
      <Path width={390} height={420} viewBox="0 0 390 420" d="M 104 300 C 120 250 150 235 175 222 C 205 206 236 190 262 150" stroke={color.roast} strokeWidth={4} strokeCap="round" strokeDash={[2, 8]} />
      <Ellipse x={80} y={276} width={48} height={48} fill={{ type: "radial", stops: ["rgba(47, 102, 144, 0.35)", "rgba(47, 102, 144, 0)"] }} />
      <Ellipse x={96} y={292} width={16} height={16} fill={color.sky} stroke={color.white} strokeWidth={3} strokeAlign="outside" />
      <Column x={240} y={92} align="center">
        <Row width={44} height={44} align="center" justify="center" cornerRadius={22} fill={color.roast} stroke={color.white} strokeWidth={3} strokeAlign="outside" shadow={shadow.float}>
          <Icon name="coffee" size={20} tint={color.white} />
        </Row>
        <Path width={14} height={8} viewBox="0 0 14 8" d="M 0 0 L 14 0 L 7 8 Z" fill={color.roast} />
      </Column>
      <Row x={150} y={168} height={30} padding={[0, 12]} gap={6} align="center" cornerRadius={15} fill={color.white} shadow={shadow.card}>
        <Icon name="navigation" size={13} tint={color.sky} />
        <Text fontSize={12} fontWeight={600} color={color.espresso}>
          320m · 步行 4 分钟
        </Text>
      </Row>
    </Frame>
  );
}

export function OrderTracking() {
  const [step] = useVariant("步骤", [0, 1, 2, 3], 1);
  return (
    <Phone>
      <MapView />
      <Column absolute x={0} y={0} width="fill" align="stretch">
        <StatusBar />
        <Row padding={[4, 16]} justify="space-between">
          <RoundButton icon="chevronLeft" light />
          <RoundButton icon="ellipsis" light />
        </Row>
      </Column>
      <Column name="Sheet" absolute x={0} y={372} bottom={0} width="fill" padding={[10, 20, 0, 20]} gap={18} cornerRadius={[28, 28, 0, 0]} fill={color.foam} shadow={shadow.sheet} align="stretch">
        <Row width="fill" justify="center">
          <Rect width={36} height={5} cornerRadius={3} fill={color.oatStrong} />
        </Row>
        <Row align="end" justify="space-between">
          <Column gap={2}>
            <Text fontSize={12} color={color.muted}>
              取餐码
            </Text>
            <Text fontFamily={font.mono} fontSize={40} fontWeight={700} letterSpacing={1} color={color.espresso}>
              A-2048
            </Text>
          </Column>
          <Column gap={6} align="end" padding={[0, 0, 6, 0]}>
            <Badge tone="warning" dot>
              制作中
            </Badge>
            <Text fontSize={13} color={color.espresso}>
              预计 <Span fontWeight={700} tabularNums>14:35</Span> 可取
            </Text>
          </Column>
        </Row>
        <Steps current={step} />
        <Row padding={12} gap={12} align="center" cornerRadius={radius.lg} fill={color.white} shadow={shadow.card}>
          <Avatar initials="JC" size={40} />
          <Column width="fill" gap={2}>
            <Text fontSize={14} fontWeight={600} color={color.espresso}>
              咖啡师 Jason 正在为你制作
            </Text>
            <Text width="fill" maxLines={1} fontSize={12} color={color.muted}>
              第 2 / 4 杯 · 桂花燕麦拿铁 · 大杯热
            </Text>
          </Column>
          <Row width={36} height={36} align="center" justify="center" cornerRadius={18} fill={color.crema}>
            <Icon name="messageCircle" size={18} tint={color.roast} />
          </Row>
        </Row>
        <Row gap={12}>
          <Button variant="outline" icon="phone" width="fill">
            联系门店
          </Button>
          <Button variant="secondary" icon="receipt" width="fill">
            查看小票
          </Button>
        </Row>
      </Column>
      <Column absolute x={0} bottom={0} width="fill">
        <HomeIndicator />
      </Column>
    </Phone>
  );
}

// ------------------------------------------------------------------ membership

const PERKS: [IconName, string][] = [
  ["gift", "生日饮品"],
  ["cupSoda", "免费升杯"],
  ["sparkles", "新品尝鲜"],
  ["star", "积分翻倍"],
];

const HISTORY = [
  { p: byId.osmanthus, when: "11-15 14:21", status: "制作中", tone: "warning" as const, total: 103.6 },
  { p: byId.americano, when: "11-13 08:42", status: "已完成", tone: "success" as const, total: 22 },
  { p: byId.beans, when: "11-09 19:05", status: "已退款", tone: "neutral" as const, total: 98 },
];

export function Membership() {
  return (
    <Phone>
      <Column width="fill" height="fill" clip align="stretch">
        <StatusBar />
        <Column padding={[6, 20, 120, 20]} gap={18} align="stretch">
          <Row align="center" justify="space-between">
            <Text fontFamily={font.display} fontSize={30} fontWeight={600} color={color.espresso}>
              我的
            </Text>
            <Row gap={10}>
              <RoundButton icon="bell" />
              <RoundButton icon="settings" />
            </Row>
          </Row>

          {/* A physical-card feel from type and one metal colour, not from glow. */}
          <Column name="MemberCard" width="fill" height={204} padding={22} cornerRadius={20} fill={CARD.bg} stroke={CARD.edge} strokeAlign="inside" shadow={shadow.card} justify="space-between" align="stretch">
            <Row align="center" justify="space-between">
              <Text fontFamily={font.display} fontSize={18} fontWeight={600} color={CARD.text}>
                焙刻 <Span italic fontWeight={400}>Roastery</Span>
              </Text>
              <Text fontSize={11} fontWeight={700} letterSpacing={2.5} color={CARD.brass}>
                GOLD
              </Text>
            </Row>
            <Column gap={2}>
              <Text fontSize={11} letterSpacing={1} color={CARD.muted}>
                可用积分
              </Text>
              <Text fontFamily={font.display} fontSize={40} lineHeight={44} fontWeight={500} tabularNums color={CARD.text}>
                2,480
              </Text>
            </Column>
            <Row align="end" justify="space-between">
              <Column gap={3}>
                <Text fontSize={14} fontWeight={600} color={CARD.text}>
                  林小满
                </Text>
                <Text fontFamily={font.mono} fontSize={11} letterSpacing={1.5} color={CARD.muted}>
                  6228 0412 2048
                </Text>
              </Column>
              <Icon name="qrCode" size={26} tint={CARD.brass} />
            </Row>
          </Column>

          <Column gap={8} align="stretch">
            <Row justify="space-between" align="center">
              <Text fontSize={13} color={color.muted}>
                再消费 <Span fontWeight={700} color={color.espresso}>¥120</Span> 升级黑卡
              </Text>
              <Text fontSize={12} color={color.subtle}>
                9 折 · 每月 2 张免费券
              </Text>
            </Row>
            <ProgressBar value={0.78} height={4} tint={color.roast} track={color.oat} />
          </Column>

          <Row width="fill" padding={[16, 0]} fill={color.white} cornerRadius={radius.lg} shadow={shadow.card}>
            {[
              ["优惠券", "5", "张"],
              ["余额", "128.00", "元"],
              ["本月杯数", "14", "杯"],
            ].map(([k, v, unit], i) => (
              <Column key={k} width="fill" gap={4} align="center" stroke={color.oat} strokeWidth={i < 2 ? [0, 1, 0, 0] : 0} strokeAlign="inside">
                <Text fontSize={20} fontWeight={700} tabularNums color={color.espresso}>
                  {v}
                  <Span fontSize={12} fontWeight={500} color={color.muted}>
                    {` ${unit}`}
                  </Span>
                </Text>
                <Text fontSize={12} color={color.muted}>
                  {k}
                </Text>
              </Column>
            ))}
          </Row>

          <SectionHeader title="会员权益" action="全部 8 项" />
          <Grid columns={4} gap={10}>
            {PERKS.map(([icon, label]) => (
              <Column key={label} padding={[14, 0]} gap={8} align="center" cornerRadius={radius.lg} fill={color.white} shadow={shadow.card}>
                <Row width={40} height={40} align="center" justify="center" cornerRadius={20} fill={color.caramelSoft}>
                  <Icon name={icon} size={20} tint={color.roast} />
                </Row>
                <Text fontSize={12} fontWeight={600} color={color.espresso}>
                  {label}
                </Text>
              </Column>
            ))}
          </Grid>

          <SectionHeader title="最近订单" action="全部" />
          <Card gap={12}>
            {HISTORY.map(({ p, when, status, tone, total }, i) => [
              i > 0 && <Divider key={`d${i}`} inset={56} />,
              <Row key={p.id} gap={12} align="center">
                <Image src={p.image} width={44} height={44} cornerRadius={10} />
                <Column width="fill" gap={3}>
                  <Text width="fill" maxLines={1} fontSize={14} fontWeight={600} color={color.espresso}>
                    {p.name}
                  </Text>
                  <Text fontFamily={font.mono} fontSize={11} color={color.muted}>
                    {when}
                  </Text>
                </Column>
                <Column gap={4} align="end">
                  <Text fontSize={14} fontWeight={600} tabularNums color={tone === "neutral" ? color.muted : color.espresso} textDecoration={tone === "neutral" ? "line-through" : "none"}>
                    {yuan(total)}
                  </Text>
                  <Badge tone={tone}>{status}</Badge>
                </Column>
              </Row>,
            ])}
          </Card>
        </Column>
      </Column>
      <TabBar active="我的" />
    </Phone>
  );
}
