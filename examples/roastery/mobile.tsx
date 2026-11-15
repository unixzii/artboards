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
  type Tone,
} from "./components.tsx";
import {
  CATEGORIES,
  PROMO,
  SAMPLE_CART,
  addLine,
  byId,
  cartTotals,
  images,
  initialPicks,
  lineFor,
  products,
  setQty,
  summarize,
  unitPrice,
  yuan,
  type CartLine,
  type Picks,
  type Product,
} from "./data.ts";
import { ICONS, type IconName } from "./icons.ts";
import { color, font, radius, shadow } from "./tokens.ts";

/** Backdrop colour of the latte photo, sampled from its left edge. */
const PROMO_BG = "#e4ccb5";

// ------------------------------------------------------------------ pieces

function Card({ children, padding = 16, gap = 12 }: { children: ReactNode; padding?: number; gap?: number }) {
  return (
    <Column width="fill" padding={padding} gap={gap} fill={color.white} cornerRadius={radius.lg} shadow={shadow.card} align="stretch">
      {children}
    </Column>
  );
}

function RoundButton({ icon, light = false, badge = false, onClick }: { icon: IconName; light?: boolean; badge?: boolean; onClick?: () => void }) {
  return (
    <Row width={40} height={40} align="center" justify="center" cornerRadius={20} fill={light ? "rgba(255, 255, 255, 0.92)" : color.white} shadow={shadow.card} onClick={onClick}>
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

function Toggle({ on, onClick }: { on: boolean; onClick?: () => void }) {
  return (
    <Row width={44} height={26} padding={3} cornerRadius={13} fill={on ? color.sage : color.oatStrong} justify={on ? "end" : "start"} onClick={onClick}>
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

const minus = (n: number) => `-${yuan(n)}`;

// ------------------------------------------------------------------ home

function HomeFeed({
  category,
  onCategory,
  countOf,
  onOpen,
  onCount,
}: {
  category: string;
  onCategory: (c: string) => void;
  countOf: (p: Product) => number;
  onOpen: (p: Product) => void;
  onCount: (p: Product, count: number) => void;
}) {
  const shown = category === "推荐" ? products : products.filter((p) => p.categories.includes(category));
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
        <Frame name="Promo" width="fill" height={156} cornerRadius={20} fill={PROMO_BG} clip onClick={() => onOpen(byId.osmanthus)}>
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
          {CATEGORIES.map(([label, icon]) => (
            <Chip key={label} icon={icon} selected={label === category} onClick={() => onCategory(label)}>
              {label}
            </Chip>
          ))}
        </Row>

        <SectionHeader title={category === "推荐" ? "人气推荐" : category} action={category === "推荐" ? "全部 24 款" : `${shown.length} 款`} />
        <Grid columns={2} gap={12}>
          {shown.map((p) => (
            <ProductCard key={p.id} product={p} count={countOf(p)} onOpen={() => onOpen(p)} onCount={(n) => onCount(p, n)} />
          ))}
        </Grid>
      </Column>
    </Column>
  );
}

function CartBar({ lines }: { lines: CartLine[] }) {
  const { count, subtotal, discount } = cartTotals(lines);
  if (count === 0) return null;
  return (
    <Row name="CartBar" absolute x={16} right={16} bottom={102} height={60} padding={[0, 8, 0, 10]} gap={12} align="center" cornerRadius={30} fill={color.espresso} shadow={shadow.float}>
      <Row width={42} height={42} align="center" justify="center" cornerRadius={21} fill={color.caramel}>
        <Icon name="shoppingBag" size={20} tint={color.white} />
        <Row absolute right={-4} y={-4} height={20} padding={[0, 6]} align="center" justify="center" cornerRadius={10} fill={color.tomato} stroke={color.espresso} strokeWidth={2} strokeAlign="outside">
          <Text fontSize={11} fontWeight={700} tabularNums color={color.white}>
            {count}
          </Text>
        </Row>
      </Row>
      <Column width="fill" gap={1}>
        <Price value={subtotal - discount} size={20} tint={color.white} />
        <Text fontSize={11} color={color.oatStrong}>
          {discount > 0 ? `已减 ${yuan(discount)} · 免打包费` : "到店自取 · 免打包费"}
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

/** Product options over a dimmed Home. Picks are click state: they reset each time the sheet opens. */
function ProductSheet({ product: p, onClose, onAdd }: { product: Product; onClose: () => void; onAdd: (line: CartLine) => void }) {
  const [picks, setPicks] = useState<Picks>(() => initialPicks(p));
  const [qty, setQtyState] = useState(1);
  const [liked, setLiked] = useState(false);
  const pick = (title: string, value: string) => setPicks({ ...picks, [title]: value });
  const unit = unitPrice(p, picks);
  const was = p.was != null ? unitPrice(p, picks, p.was) : undefined;
  return (
    <>
      <Rect name="Scrim" width="fill" height="fill" fill={color.scrim} onClick={onClose} />
      <Column name="Sheet" absolute x={0} bottom={0} width="fill" padding={[10, 20, 0, 20]} gap={16} cornerRadius={[28, 28, 0, 0]} fill={color.foam} shadow={shadow.sheet} align="stretch">
        <Row width="fill" justify="center">
          <Rect width={36} height={5} cornerRadius={3} fill={color.oatStrong} />
        </Row>
        <Frame width="fill" height={150} cornerRadius={20} clip>
          <Image src={p.image} width="fill" height="fill" />
          <Row right={12} y={12}>
            <RoundButton icon="x" light onClick={onClose} />
          </Row>
          <Row x={12} bottom={12} gap={6}>
            {p.tag && <Badge tone="brand">{p.tag}</Badge>}
            {p.sold != null && (
              <Badge tone="success" dot>
                {`热销 · 今日 ${p.sold} 杯`}
              </Badge>
            )}
          </Row>
        </Frame>
        <Column gap={4} align="stretch">
          <Row align="end" justify="space-between">
            <Text fontSize={22} fontWeight={700} color={color.espresso}>
              {p.name}
            </Text>
            <Row onClick={() => setLiked(!liked)}>
              <Path width={22} height={22} viewBox="0 0 24 24" d={ICONS.heart} fill={liked ? color.tomato : undefined} stroke={color.tomato} strokeWidth={1.8} strokeJoin="round" />
            </Row>
          </Row>
          <Text fontFamily={font.display} italic fontSize={15} color={color.caramelText}>
            {p.en}
          </Text>
          <Text width="fill" maxLines={2} fontSize={13} lineHeight={19} color={color.muted}>
            {p.story ?? p.desc}
          </Text>
        </Column>
        {p.options.map((o) => (
          <OptionGroup key={o.title} title={o.title} note={o.note}>
            {o.segmented ? (
              <Segmented options={o.choices.map((c) => c.label)} value={picks[o.title]} onChange={(v) => pick(o.title, v)} />
            ) : (
              <Row width="fill" gap={8} wrap>
                {o.choices.map((c) => (
                  <Chip key={c.label} icon={c.icon} selected={picks[o.title] === c.label} onClick={() => pick(o.title, c.label)}>
                    {c.delta ? `${c.label} +¥${c.delta}` : c.label}
                  </Chip>
                ))}
              </Row>
            )}
          </OptionGroup>
        ))}
        <Column gap={0} align="stretch" stroke={color.oat} strokeWidth={[1, 0, 0, 0]} strokeAlign="inside" padding={[14, 0, 0, 0]}>
          <Row gap={16} align="center">
            <Column width="fill" gap={2}>
              <Price value={unit * qty} was={was != null ? was * qty : undefined} size={26} />
              <Text width="fill" maxLines={1} fontSize={11} color={color.muted}>
                {summarize(p, picks)}
              </Text>
            </Column>
            <Stepper value={qty} min={1} onChange={setQtyState} />
          </Row>
          <Row padding={[14, 0, 0, 0]}>
            <Button size="lg" width="fill" icon="shoppingBag" onClick={() => onAdd(lineFor(p, picks, qty))}>
              加入购物车
            </Button>
          </Row>
          <HomeIndicator />
        </Column>
      </Column>
    </>
  );
}

/**
 * Browse and order. Variants: whether the cart starts with the sample order, and whether the
 * product sheet is open. In Play mode, cards open the sheet, + and the steppers change the cart,
 * and chips filter the grid.
 */
export function Home() {
  const [cartMode] = useVariant("购物车", ["有商品", "空"]);
  const [overlay, setOverlay] = useVariant("弹层", ["无", "商品详情"]);
  // Click edits are kept per cart variant, so switching the variant shows that variant's own cart.
  const [carts, setCarts] = useState<Record<string, CartLine[]>>({});
  const lines = carts[cartMode] ?? (cartMode === "空" ? [] : SAMPLE_CART);
  const setLines = (next: CartLine[]) => setCarts({ ...carts, [cartMode]: next });
  const [category, setCategory] = useState("推荐");
  // `opened` remounts the sheet each time it opens, so its picks start fresh.
  const [sheet, setSheet] = useState({ id: "osmanthus", opened: 0 });

  const countOf = (p: Product) => lines.filter((l) => l.product.id === p.id).reduce((n, l) => n + l.qty, 0);
  const onCount = (p: Product, next: number) => {
    if (next > countOf(p)) return setLines(addLine(lines, lineFor(p)));
    const last = lines.findLast((l) => l.product.id === p.id);
    if (last) setLines(setQty(lines, last, last.qty - 1));
  };
  const open = (p: Product) => {
    setSheet({ id: p.id, opened: sheet.opened + 1 });
    setOverlay("商品详情");
  };

  return (
    <Phone>
      <HomeFeed category={category} onCategory={setCategory} countOf={countOf} onOpen={open} onCount={onCount} />
      <CartBar lines={lines} />
      <TabBar active="首页" />
      {overlay === "商品详情" && (
        <ProductSheet
          key={`${sheet.id}-${sheet.opened}`}
          product={byId[sheet.id]}
          onClose={() => setOverlay("无")}
          onAdd={(line) => {
            setLines(addLine(lines, line));
            setOverlay("无");
          }}
        />
      )}
    </Phone>
  );
}

// ------------------------------------------------------------------ checkout

function StoreCard() {
  return (
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
  );
}

function AddressCard() {
  return (
    <Card>
      <Row gap={12} align="center">
        <Row width={44} height={44} align="center" justify="center" cornerRadius={radius.md} fill={color.skySoft}>
          <Icon name="mapPin" size={22} tint={color.sky} />
        </Row>
        <Column width="fill" gap={3}>
          <Text width="fill" maxLines={1} fontSize={15} fontWeight={700} color={color.espresso}>
            湖南路 262 弄 5 号 302
          </Text>
          <Text fontSize={12} color={color.muted}>
            林小满 · 138 **** 8000
          </Text>
        </Column>
        <Icon name="chevronRight" size={16} tint={color.muted} />
      </Row>
      <Divider />
      <Row gap={8} align="center">
        <Icon name="bike" size={16} tint={color.sky} />
        <Text width="fill" fontSize={13} color={color.espresso}>
          预计 <Span fontWeight={700}>14:58</Span> 送达 · 距门店 1.2km
        </Text>
        <Text fontSize={13} fontWeight={600} color={color.roast}>
          修改时间
        </Text>
      </Row>
    </Card>
  );
}

const DELIVERY_FEE = 6;
const PACKING_FEE = 2;
const POINTS_OFF = 2.4;

/**
 * Review and pay. Variant: pickup or delivery. In Play mode the steppers, 清空 and the points
 * switch recompute every total.
 */
export function Checkout() {
  const [mode, setMode] = useVariant("配送方式", ["到店自取", "外送"]);
  const [lines, setLines] = useState(SAMPLE_CART);
  const [usePoints, setUsePoints] = useState(true);
  const delivery = mode === "外送";
  const { count, subtotal, discount } = cartTotals(lines);
  const empty = count === 0;
  const points = usePoints && !empty ? POINTS_OFF : 0;
  const fees = delivery && !empty ? DELIVERY_FEE + PACKING_FEE : 0;
  const total = Math.max(0, subtotal - discount - points + fees);
  const saved = discount + points;

  return (
    <Phone>
      <Column width="fill" height="fill" align="stretch">
        <StatusBar />
        <NavBar title="确认订单" />
        <Column width="fill" height="fill" padding={[8, 16, 140, 16]} gap={12} scroll="vertical" align="stretch">
          <Segmented options={["到店自取", "外送"]} value={mode} onChange={(v) => setMode(v === "外送" ? "外送" : "到店自取")} />
          {delivery ? <AddressCard /> : <StoreCard />}

          <Card gap={14}>
            <Row justify="space-between" align="center">
              <Text fontSize={15} fontWeight={700} color={color.espresso}>
                {`已选 ${count} 件`}
              </Text>
              {!empty && (
                <Text fontSize={13} color={color.muted} onClick={() => setLines([])}>
                  清空
                </Text>
              )}
            </Row>
            {empty && (
              <Column width="fill" padding={[20, 0]} gap={6} align="center">
                <Icon name="shoppingBag" size={28} tint={color.oatStrong} />
                <Text fontSize={14} fontWeight={600} color={color.espresso}>
                  购物车是空的
                </Text>
                <Text fontSize={12} color={color.muted}>
                  回首页挑一杯吧
                </Text>
              </Column>
            )}
            {lines.map((line, i) => [
              i > 0 && <Divider key={`d${i}`} inset={68} />,
              <Row key={`${line.product.id}/${line.options}`} gap={12} align="center">
                <Image src={line.product.image} width={56} height={56} cornerRadius={12} />
                <Column width="fill" gap={3}>
                  <Text width="fill" maxLines={1} fontSize={14} fontWeight={600} color={color.espresso}>
                    {line.product.name}
                  </Text>
                  <Text width="fill" maxLines={1} fontSize={12} color={color.muted}>
                    {line.options}
                  </Text>
                  <Price value={line.unit} size={15} />
                </Column>
                <Stepper value={line.qty} compact onChange={(n) => setLines(setQty(lines, line, n))} />
              </Row>,
            ])}
          </Card>

          <Card gap={14}>
            <Row gap={10} align="center">
              <Icon name="ticket" size={18} tint={color.tomato} />
              <Text width="fill" fontSize={14} color={color.espresso}>
                优惠券 <Span fontSize={12} color={color.muted}>{PROMO}</Span>
              </Text>
              {discount > 0 ? (
                <Text fontSize={14} fontWeight={700} tabularNums color={color.tomato}>
                  {minus(discount)}
                </Text>
              ) : (
                <Text fontSize={13} color={color.subtle}>
                  未满足条件
                </Text>
              )}
              <Icon name="chevronRight" size={14} tint={color.muted} />
            </Row>
            <Divider inset={28} />
            <Row gap={10} align="center">
              <Icon name="gift" size={18} tint={color.caramelText} />
              <Text width="fill" fontSize={14} color={color.espresso}>
                积分抵扣 <Span fontSize={12} color={color.muted}>{`240 积分抵 ${yuan(POINTS_OFF)}`}</Span>
              </Text>
              <Toggle on={usePoints} onClick={() => setUsePoints(!usePoints)} />
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
            <KeyValue label="商品金额" value={yuan(subtotal)} />
            <KeyValue label="优惠券" value={minus(discount)} tint={color.tomato} />
            <KeyValue label="积分抵扣" value={minus(points)} tint={color.tomato} />
            {delivery ? (
              <>
                <KeyValue label="配送费" value={yuan(empty ? 0 : DELIVERY_FEE)} />
                <KeyValue label="打包费" value={yuan(empty ? 0 : PACKING_FEE)} />
              </>
            ) : (
              <KeyValue label="打包费" value={yuan(0)} />
            )}
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
              <Price value={total} size={24} />
            </Row>
            {saved > 0 && (
              <Text fontSize={12} fontWeight={600} color={color.caramelText}>
                {`已为你节省 ${yuan(saved)}`}
              </Text>
            )}
          </Column>
          <Button size="lg" width={150} disabled={empty}>
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
type Step = 0 | 1 | 2 | 3;

function Steps({ current, onPick }: { current: number; onPick?: (step: Step) => void }) {
  return (
    <Frame name="Steps" width="fill" height={54}>
      <Row x={30} right={30} y={13} height={3}>
        <ProgressBar value={STEP_PROGRESS[current]} height={3} tint={color.sage} />
      </Row>
      <Row width="fill" justify="space-between">
        {STEPS.map((label, i) => {
          const state = i < current || current === STEPS.length - 1 ? "done" : i === current ? "active" : "todo";
          return (
            <Column key={label} width={60} gap={8} align="center" onClick={onPick && (() => onPick(i as Step))}>
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

/** What the sheet says at each step: status badge, the line under it, and the barista card. */
const STAGES: { tone: Tone; status: string; when: [string, string, string]; title: string; detail: string }[] = [
  { tone: "info", status: "已接单", when: ["前方 ", "3", " 单"], title: "吧台已收到你的订单", detail: "Jason 做完前面 3 单就开始做你的" },
  { tone: "warning", status: "制作中", when: ["预计 ", "14:35", " 可取"], title: "咖啡师 Jason 正在为你制作", detail: "第 2 / 4 杯 · 桂花燕麦拿铁 · 大杯热" },
  { tone: "success", status: "请取餐", when: ["已在 ", "2 号吧台", " 等你"], title: "4 件都备好了", detail: "到店出示取餐码，或报手机尾号 8000" },
  { tone: "neutral", status: "已完成", when: ["", "14:37", " 已取餐"], title: "", detail: "" },
];

function Rating({ value, onRate }: { value: number; onRate: (n: number) => void }) {
  return (
    <Column padding={16} gap={12} align="center" cornerRadius={radius.lg} fill={color.white} shadow={shadow.card}>
      <Text fontSize={15} fontWeight={700} color={color.espresso}>
        {value ? "谢谢你的评价" : "这一单还满意吗？"}
      </Text>
      <Row gap={10}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Row key={n} padding={2} onClick={() => onRate(n)}>
            <Path width={30} height={30} viewBox="0 0 24 24" d={ICONS.star} fill={n <= value ? color.caramel : undefined} stroke={n <= value ? color.caramel : color.oatStrong} strokeWidth={1.6} strokeJoin="round" />
          </Row>
        ))}
      </Row>
      <Text fontSize={12} color={color.muted}>
        {value ? `${value} 星 · 已同步给武康路店` : "评价后送 20 积分"}
      </Text>
    </Column>
  );
}

/** Order status over a map. Variant: the step; tap a step in Play mode to move to it. */
export function OrderTracking() {
  const [step, setStep] = useVariant("步骤", [0, 1, 2, 3], 1);
  const [rating, setRating] = useState(0);
  const stage = STAGES[step];
  const done = step === 3;
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
            <Text fontFamily={font.mono} fontSize={40} fontWeight={700} letterSpacing={1} color={step === 2 ? color.sage : done ? color.subtle : color.espresso}>
              A-2048
            </Text>
          </Column>
          <Column gap={6} align="end" padding={[0, 0, 6, 0]}>
            <Badge tone={stage.tone} dot>
              {stage.status}
            </Badge>
            <Text fontSize={13} color={color.espresso}>
              {stage.when[0]}
              <Span fontWeight={700} tabularNums>
                {stage.when[1]}
              </Span>
              {stage.when[2]}
            </Text>
          </Column>
        </Row>
        <Steps current={step} onPick={setStep} />
        {done ? (
          <Rating value={rating} onRate={setRating} />
        ) : (
          <Row padding={12} gap={12} align="center" cornerRadius={radius.lg} fill={color.white} shadow={shadow.card}>
            <Avatar initials="JC" size={40} />
            <Column width="fill" gap={2}>
              <Text fontSize={14} fontWeight={600} color={color.espresso}>
                {stage.title}
              </Text>
              <Text width="fill" maxLines={1} fontSize={12} color={color.muted}>
                {stage.detail}
              </Text>
            </Column>
            <Row width={36} height={36} align="center" justify="center" cornerRadius={18} fill={color.crema}>
              <Icon name="messageCircle" size={18} tint={color.roast} />
            </Row>
          </Row>
        )}
        <Row gap={12}>
          {done ? (
            <Button variant="outline" icon="refreshCw" width="fill">
              再来一单
            </Button>
          ) : (
            <Button variant="outline" icon="phone" width="fill">
              联系门店
            </Button>
          )}
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

type Tier = "金卡" | "黑卡";

/** Each tier is the same near-black card with its own metal: brass for gold, pale platinum for black. */
const TIERS: Record<Tier, { mark: string; bg: string; edge: string; metal: string; muted: string; points: string; progress: number; goal: ReactNode; goalNote: string; perks: [IconName, string][]; perkCount: number }> = {
  金卡: {
    mark: "GOLD",
    bg: "#1e1510",
    edge: "rgba(255, 236, 214, 0.08)",
    metal: "#c9a46a",
    muted: "#ab9888",
    points: "2,480",
    progress: 0.78,
    goal: (
      <>
        再消费 <Span fontWeight={700} color={color.espresso}>¥120</Span> 升级黑卡
      </>
    ),
    goalNote: "9 折 · 每月 2 张免费券",
    perks: [
      ["gift", "生日饮品"],
      ["cupSoda", "免费升杯"],
      ["sparkles", "新品尝鲜"],
      ["star", "积分翻倍"],
    ],
    perkCount: 8,
  },
  黑卡: {
    mark: "BLACK",
    bg: "#0e0d0c",
    edge: "rgba(255, 255, 255, 0.10)",
    metal: "#d9d4ca",
    muted: "#a39d95",
    points: "6,920",
    progress: 0.86,
    goal: (
      <>
        再消费 <Span fontWeight={700} color={color.espresso}>¥580</Span> 保级至 2027 年
      </>
    ),
    goalNote: "保级周期 12 个月",
    perks: [
      ["ticket", "每月 2 杯"],
      ["cupSoda", "免费升杯"],
      ["sparkles", "新品优先"],
      ["messageCircle", "专属客服"],
    ],
    perkCount: 12,
  },
};

const HISTORY = [
  { p: byId.osmanthus, when: "11-15 14:21", status: "制作中", tone: "warning" as const, total: 91.6 },
  { p: byId.americano, when: "11-13 08:42", status: "已完成", tone: "success" as const, total: 22 },
  { p: byId.beans, when: "11-09 19:05", status: "已退款", tone: "neutral" as const, total: 98 },
];

/** Profile and member card. Variant: membership tier. */
export function Membership() {
  const [tier] = useVariant("等级", ["金卡", "黑卡"] as Tier[]);
  const t = TIERS[tier];
  return (
    <Phone>
      <Column width="fill" height="fill" clip align="stretch">
        <StatusBar />
        <Column height="fill" scroll="vertical" padding={[6, 20, 120, 20]} gap={18} align="stretch">
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
          <Column name="MemberCard" width="fill" height={204} padding={22} cornerRadius={20} fill={t.bg} stroke={t.edge} strokeAlign="inside" shadow={shadow.card} justify="space-between" align="stretch">
            <Row align="center" justify="space-between">
              <Text fontFamily={font.display} fontSize={18} fontWeight={600} color={color.crema}>
                焙刻 <Span italic fontWeight={400}>Roastery</Span>
              </Text>
              <Text fontSize={11} fontWeight={700} letterSpacing={2.5} color={t.metal}>
                {t.mark}
              </Text>
            </Row>
            <Column gap={2}>
              <Text fontSize={11} letterSpacing={1} color={t.muted}>
                可用积分
              </Text>
              <Text fontFamily={font.display} fontSize={40} lineHeight={44} fontWeight={500} tabularNums color={color.crema}>
                {t.points}
              </Text>
            </Column>
            <Row align="end" justify="space-between">
              <Column gap={3}>
                <Text fontSize={14} fontWeight={600} color={color.crema}>
                  林小满
                </Text>
                <Text fontFamily={font.mono} fontSize={11} letterSpacing={1.5} color={t.muted}>
                  6228 0412 2048
                </Text>
              </Column>
              <Icon name="qrCode" size={26} tint={t.metal} />
            </Row>
          </Column>

          <Column gap={8} align="stretch">
            <Row justify="space-between" align="center">
              <Text fontSize={13} color={color.muted}>
                {t.goal}
              </Text>
              <Text fontSize={12} color={color.subtle}>
                {t.goalNote}
              </Text>
            </Row>
            <ProgressBar value={t.progress} height={4} tint={color.roast} track={color.oat} />
          </Column>

          <Row width="fill" padding={[16, 0]} fill={color.white} cornerRadius={radius.lg} shadow={shadow.card}>
            {[
              ["优惠券", tier === "黑卡" ? "9" : "5", "张"],
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

          <SectionHeader title="会员权益" action={`全部 ${t.perkCount} 项`} />
          <Grid columns={4} gap={10}>
            {t.perks.map(([icon, label]) => (
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
