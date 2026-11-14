// Barista order board (iPad landscape, 1194 x 834). Dark, glanceable, big type.
import { Column, Ellipse, Frame, Grid, Rect, Row, Span, Text } from "artboards";
import type { ReactNode } from "react";
import { Icon, ProgressBar } from "./components.tsx";
import type { IconName } from "./icons.ts";
import { color, font } from "./tokens.ts";

// The board's own dark palette, derived from the brand tokens.
const dark = {
  bg: "#160e09",
  lane: "#20150e",
  card: "#2c1f16",
  line: "#3d2c20",
  text: "#fbf3ea",
  muted: "#c2b1a2",
  dim: "#9c8a7b",
};

type Urgency = "ok" | "soon" | "late";
const URGENCY: Record<Urgency, string> = { ok: "#7fbf8e", soon: "#f0b44c", late: "#f0796a" };
const LATE_HEADER = "#6b2a22";
const LATE_INK = "#2a0f0b";

interface Item {
  qty: number;
  name: string;
  options: string[];
  /** Options the barista must not miss. */
  special?: string[];
}

interface Ticket {
  code: string;
  channel: "小程序" | "外卖" | "到店";
  wait: string;
  urgency: Urgency;
  items: Item[];
  note?: string;
  progress?: number;
}


const QUEUE: Ticket[] = [
  {
    code: "A-2051",
    channel: "小程序",
    wait: "00:48",
    urgency: "ok",
    items: [
      { qty: 2, name: "桂花燕麦拿铁", options: ["大杯", "热"], special: ["少甜"] },
      { qty: 1, name: "黄油可颂", options: ["加热"] },
    ],
  },
  {
    code: "W-0317",
    channel: "外卖",
    wait: "01:32",
    urgency: "ok",
    items: [
      { qty: 1, name: "冰摇生椰拿铁", options: ["大杯"], special: ["少冰"] },
      { qty: 1, name: "美式", options: ["中杯", "冰"] },
    ],
    note: "骑手预计 14:40 到店",
  },
  {
    code: "A-2052",
    channel: "到店",
    wait: "02:05",
    urgency: "soon",
    items: [{ qty: 1, name: "手冲 · 耶加雪菲", options: ["热"], special: ["不加糖"] }],
    note: "杯套写 Happy Birthday, Lin!",
  },
];

const MAKING: Ticket[] = [
  {
    code: "A-2048",
    channel: "小程序",
    wait: "06:12",
    urgency: "late",
    progress: 0.5,
    items: [
      { qty: 2, name: "桂花燕麦拿铁", options: ["大杯", "热"], special: ["燕麦奶", "少甜"] },
      { qty: 1, name: "冰摇生椰拿铁", options: ["大杯"], special: ["少冰"] },
      { qty: 1, name: "黄油可颂", options: ["加热"] },
    ],
  },
  {
    code: "A-2049",
    channel: "小程序",
    wait: "03:20",
    urgency: "soon",
    progress: 0.75,
    items: [{ qty: 1, name: "美式", options: ["大杯", "热"] }],
  },
  {
    code: "W-0316",
    channel: "外卖",
    wait: "02:10",
    urgency: "ok",
    progress: 0.2,
    items: [{ qty: 3, name: "冰摇生椰拿铁", options: ["大杯", "冰"] }],
  },
];

const READY = [
  { code: "A-2045", summary: "美式 ×2", waited: "4 分钟", calls: 2 },
  { code: "A-2046", summary: "桂花燕麦拿铁 · 可颂", waited: "2 分钟", calls: 1 },
  { code: "W-0315", summary: "外卖 · 骑手已到店", waited: "1 分钟", calls: 0 },
  { code: "A-2047", summary: "手冲 · 耶加雪菲", waited: "刚刚", calls: 0 },
];

// ------------------------------------------------------------------ pieces

function Stat({ icon, label, value, tint = dark.text }: { icon: IconName; label: string; value: string; tint?: string }) {
  return (
    <Row height={44} padding={[0, 16]} gap={10} align="center" cornerRadius={22} fill={dark.lane} stroke={dark.line} strokeAlign="inside">
      <Icon name={icon} size={18} tint={tint} />
      <Text fontSize={13} color={dark.muted}>
        {label}
      </Text>
      <Text fontFamily={font.mono} fontSize={17} fontWeight={700} color={tint}>
        {value}
      </Text>
    </Row>
  );
}

function Lane({ title, count, tint, children, footer }: { title: string; count: number; tint: string; children: ReactNode; footer?: string }) {
  return (
    <Column name={`Lane/${title}`} height="fill" padding={12} gap={12} cornerRadius={20} fill={dark.lane} clip align="stretch">
      <Row padding={[4, 4, 0, 4]} gap={10} align="center">
        <Ellipse width={10} height={10} fill={tint} />
        <Text width="fill" fontSize={17} fontWeight={700} color={dark.text}>
          {title}
        </Text>
        <Row height={26} padding={[0, 10]} align="center" cornerRadius={13} fill={dark.card}>
          <Text fontFamily={font.mono} fontSize={14} fontWeight={700} color={dark.text}>
            {count}
          </Text>
        </Row>
      </Row>
      {children}
      {footer && (
        <Row width="fill" height={40} align="center" justify="center" cornerRadius={12} stroke={dark.line} strokeDash={[5, 4]} strokeAlign="inside">
          <Text fontSize={13} color={dark.muted}>
            {footer}
          </Text>
        </Row>
      )}
    </Column>
  );
}

function Tag({ children, special = false }: { children: ReactNode; special?: boolean }) {
  return (
    <Row height={22} padding={[0, 8]} align="center" cornerRadius={6} fill={special ? "#4a3510" : dark.lane} stroke={special ? "#8a6420" : undefined} strokeAlign="inside">
      <Text fontSize={12} fontWeight={special ? 700 : 500} color={special ? "#ffd27a" : dark.muted}>
        {children}
      </Text>
    </Row>
  );
}

function TicketCard({ t, stage }: { t: Ticket; stage: "queue" | "making" }) {
  const accent = URGENCY[t.urgency];
  const late = t.urgency === "late";
  // Urgency lives in the timer; a late ticket's whole header turns red so it reads across the room.
  return (
    <Column name={`Ticket/${t.code}`} cornerRadius={14} fill={dark.card} clip align="stretch">
      <Row padding={[12, 14]} gap={10} align="center" fill={late ? LATE_HEADER : undefined} stroke={dark.line} strokeWidth={[0, 0, 1, 0]} strokeAlign="inside">
        <Text fontFamily={font.mono} fontSize={22} fontWeight={700} color={dark.text}>
          {t.code}
        </Text>
        <Text fontSize={13} fontWeight={600} color={late ? "#f6d6cf" : dark.muted}>
          {t.channel}
        </Text>
        <Rect width="fill" height={1} />
        <Row height={30} padding={[0, 10]} gap={6} align="center" cornerRadius={8} fill={late ? accent : `${accent}24`}>
          <Icon name="timer" size={16} tint={late ? LATE_INK : accent} weight={2.2} />
          <Text fontFamily={font.mono} fontSize={16} fontWeight={700} color={late ? LATE_INK : accent}>
            {late ? `超时 ${t.wait}` : t.wait}
          </Text>
        </Row>
      </Row>

      <Column padding={[12, 14, 14, 14]} gap={12} align="stretch">
        <Column gap={10} align="stretch">
          {t.items.map((it) => (
            <Row key={it.name} gap={10} align="start">
              <Text width={28} fontFamily={font.mono} fontSize={16} fontWeight={700} color={color.caramel}>
                {`${it.qty}×`}
              </Text>
              <Column width="fill" gap={6}>
                <Text width="fill" maxLines={1} fontSize={16} fontWeight={600} color={dark.text}>
                  {it.name}
                </Text>
                <Row width="fill" gap={4} wrap crossGap={4}>
                  {it.options.map((o) => (
                    <Tag key={o}>{o}</Tag>
                  ))}
                  {(it.special ?? []).map((o) => (
                    <Tag key={o} special>
                      {o}
                    </Tag>
                  ))}
                </Row>
              </Column>
            </Row>
          ))}
        </Column>

        {t.note && (
          <Row padding={[8, 10]} gap={8} align="center" cornerRadius={8} fill="#3a2a12">
            <Icon name="info" size={15} tint="#ffd27a" />
            <Text width="fill" maxLines={1} fontSize={13} color="#ffe3a8">
              {t.note}
            </Text>
          </Row>
        )}

        {stage === "making" && t.progress != null && (
          <Row gap={10} align="center">
            <ProgressBar value={t.progress} height={4} tint={accent} track={dark.line} />
            <Text fontSize={12} color={dark.muted} tabularNums>
              {`${Math.round(t.progress * 4)}/4 杯`}
            </Text>
          </Row>
        )}

        <Row height={44} gap={8} align="center" justify="center" cornerRadius={12} fill={stage === "queue" ? color.caramel : "#3f6b4b"}>
          <Icon name={stage === "queue" ? "coffee" : "check"} size={18} tint={stage === "queue" ? color.espresso : color.white} weight={2.4} />
          <Text fontSize={15} fontWeight={700} color={stage === "queue" ? color.espresso : color.white}>
            {stage === "queue" ? "开始制作" : "完成并叫号"}
          </Text>
        </Row>
      </Column>
    </Column>
  );
}

function ReadyCard({ code, summary, waited, calls }: (typeof READY)[number]) {
  return (
    <Row padding={14} gap={12} align="center" cornerRadius={14} fill={dark.card}>
      <Column width="fill" gap={4}>
        <Text fontFamily={font.mono} fontSize={26} fontWeight={700} color={dark.text}>
          {code}
        </Text>
        <Text width="fill" maxLines={1} fontSize={13} color={dark.muted}>
          {summary}
        </Text>
        <Text fontSize={12} color={calls > 1 ? URGENCY.soon : dark.dim}>
          {`等候 ${waited}`}
          {calls > 0 && ` · 已叫号 ${calls} 次`}
        </Text>
      </Column>
      <Column gap={8} align="stretch">
        <Row height={36} padding={[0, 14]} gap={6} align="center" cornerRadius={10} fill={dark.lane} stroke={dark.line} strokeAlign="inside">
          <Icon name="bell" size={15} tint={dark.text} />
          <Text fontSize={13} fontWeight={600} color={dark.text}>
            叫号
          </Text>
        </Row>
        <Row height={36} padding={[0, 14]} gap={6} align="center" cornerRadius={10} fill={dark.text}>
          <Icon name="check" size={15} tint={color.espresso} weight={2.4} />
          <Text fontSize={13} fontWeight={700} color={color.espresso}>
            已取
          </Text>
        </Row>
      </Column>
    </Row>
  );
}

// ------------------------------------------------------------------ board

export function BaristaBoard() {
  return (
    <Frame width={1194} height={834} fill={dark.bg}>
      <Column width="fill" height="fill" align="stretch">
        <Row height={84} padding={[0, 24]} gap={16} align="center">
          <Row width={44} height={44} align="center" justify="center" cornerRadius={12} fill={color.caramel}>
            <Icon name="coffee" size={22} tint={color.espresso} weight={2.2} />
          </Row>
          <Column gap={2}>
            <Text fontFamily={font.display} fontSize={22} fontWeight={600} color={dark.text}>
              焙刻 <Span italic fontWeight={400} color={color.caramel}>Bar</Span>
            </Text>
            <Text fontSize={12} letterSpacing={1} color={dark.muted}>
              武康路店 · 2 号吧台 · Jason
            </Text>
          </Column>
          <Rect width="fill" height={1} />
          <Stat icon="cupSoda" label="待出杯" value="14" />
          <Stat icon="timer" label="平均出杯" value="3:42" />
          <Stat icon="triangleAlert" label="超时" value="1" tint={URGENCY.late} />
          <Column gap={0} align="end" padding={[0, 0, 0, 8]}>
            <Text fontFamily={font.mono} fontSize={28} fontWeight={700} color={dark.text}>
              14:32
            </Text>
            <Row gap={6} align="center">
              <Ellipse width={7} height={7} fill={URGENCY.ok} />
              <Text fontSize={11} color={dark.muted}>
                营业中 · 高峰模式
              </Text>
            </Row>
          </Column>
        </Row>

        <Grid width="fill" height="fill" columns={3} rows={["1fr"]} gap={14} padding={[0, 20, 20, 20]}>
          <Lane title="待制作" count={5} tint={color.caramel} footer="还有 2 单 · 下拉查看">
            {QUEUE.map((t) => (
              <TicketCard key={t.code} t={t} stage="queue" />
            ))}
          </Lane>
          <Lane title="制作中" count={3} tint={URGENCY.soon}>
            {MAKING.map((t) => (
              <TicketCard key={t.code} t={t} stage="making" />
            ))}
          </Lane>
          <Lane title="待取餐" count={4} tint={URGENCY.ok}>
            {READY.map((r) => (
              <ReadyCard key={r.code} {...r} />
            ))}
            <Frame width="fill" height="fill" cornerRadius={14} fill={dark.card} clip>
              <Column width="fill" height="fill" align="center" justify="center" gap={6}>
                <Text fontSize={12} letterSpacing={2} color={dark.muted}>
                  NOW SERVING · 请取餐
                </Text>
                <Text fontFamily={font.mono} fontSize={44} fontWeight={700} color={URGENCY.ok}>
                  A-2045
                </Text>
              </Column>
            </Frame>
          </Lane>
        </Grid>
      </Column>
    </Frame>
  );
}
