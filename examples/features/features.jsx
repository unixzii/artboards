// One artboard per capability group, for checking the engine by eye.
import { Column, Ellipse, Frame, Grid, Image, Path, Rect, Row, Span, Text } from "artboards";
import latte from "./assets/latte.png";

const INK = "#1c1917";
const MUTED = "#57534e";
const LINE = "#e7e5e4";
const BRAND = "#7c4a2d";

function Caption({ children }) {
  return (
    <Text fontSize={11} fontWeight={600} letterSpacing={0.8} color={MUTED}>
      {children}
    </Text>
  );
}

export function Layout() {
  const chips = ["Oat milk", "Extra shot", "Less ice", "Vanilla", "Caramel drizzle", "Decaf", "To go"];
  return (
    <Frame width={480} height={620} fill="#fafaf9">
      <Column width="fill" padding={24} gap={20} align="stretch">
        <Caption>ABSOLUTE INSIDE A ROW · RIGHT / BOTTOM</Caption>
        <Row height={56} padding={[0, 16]} gap={12} align="center" fill="#ffffff" cornerRadius={14} stroke={LINE}>
          <Rect width={32} height={32} cornerRadius={8} fill="#f5e6d8" />
          <Text width="fill" fontSize={15} fontWeight={600} color={INK}>Cart</Text>
          <Text fontSize={13} color={MUTED}>3 items</Text>
          <Row absolute right={-6} y={-6} width={18} height={18} cornerRadius={9} fill="#dc2626" align="center" justify="center">
            <Text fontSize={11} fontWeight={700} color="#ffffff">3</Text>
          </Row>
        </Row>

        <Caption>GROW 2 : 1 · MIN / MAX WIDTH · ALIGN SELF</Caption>
        <Row height={72} gap={8} align="start">
          <Column width="fill" grow={2} height="fill" padding={10} fill="#e7e5e4" cornerRadius={10}>
            <Text fontSize={12} color={INK}>grow 2</Text>
          </Column>
          <Column width="fill" height="fill" padding={10} fill="#e7e5e4" cornerRadius={10}>
            <Text fontSize={12} color={INK}>grow 1</Text>
          </Column>
          <Column width="fill" maxWidth={64} alignSelf="end" padding={10} fill="#d6d3d1" cornerRadius={10}>
            <Text fontSize={12} color={INK}>max 64</Text>
          </Column>
        </Row>

        <Caption>WRAP · CROSS GAP</Caption>
        <Row width="fill" wrap gap={8} crossGap={8}>
          {chips.map((c, i) => (
            <Row key={c} height={30} padding={[0, 12]} align="center" cornerRadius={15} fill={i === 1 ? BRAND : "#ffffff"} stroke={i === 1 ? undefined : LINE}>
              <Text fontSize={13} color={i === 1 ? "#ffffff" : INK}>{c}</Text>
            </Row>
          ))}
        </Row>

        <Caption>GRID · COLUMNS [1fr, 1fr, 96] · COLSPAN</Caption>
        <Grid width="fill" columns={["1fr", "1fr", 96]} gap={8}>
          <Column colSpan={2} padding={12} fill="#ffffff" stroke={LINE} cornerRadius={10}>
            <Text fontSize={12} color={MUTED}>Revenue (spans 2)</Text>
            <Text fontSize={22} fontWeight={700} tabularNums color={INK}>¥18,240</Text>
          </Column>
          <Column padding={12} fill="#ffffff" stroke={LINE} cornerRadius={10} justify="center">
            <Text fontSize={12} color={MUTED}>96px</Text>
          </Column>
          {["Orders", "Avg", "Refunds"].map((k, i) => (
            <Column key={k} padding={12} fill="#ffffff" stroke={LINE} cornerRadius={10}>
              <Text fontSize={12} color={MUTED}>{k}</Text>
              <Text fontSize={18} fontWeight={600} tabularNums color={INK}>{[412, 44.3, 2][i]}</Text>
            </Column>
          ))}
        </Grid>
      </Column>
    </Frame>
  );
}

export function Paint() {
  return (
    <Frame width={480} height={760} fill="#fafaf9">
      <Column width="fill" padding={24} gap={18} align="stretch">
        <Caption>GRADIENT FILLS · LINEAR / RADIAL</Caption>
        <Row gap={12} height={96}>
          <Column width="fill" height="fill" padding={14} justify="end" cornerRadius={16} fill={{ type: "linear", angle: 135, stops: ["#5b3420", "#9a5b14"] }}>
            <Text fontSize={13} fontWeight={600} color="#ffffff">135°</Text>
          </Column>
          <Column width="fill" height="fill" padding={14} justify="end" cornerRadius={16} fill={{ type: "radial", center: [0.3, 0.25], radius: 0.9, stops: ["#b45309", "#451a03"] }}>
            <Text fontSize={13} fontWeight={600} color="#ffffff">radial</Text>
          </Column>
          <Column width="fill" height="fill" padding={14} justify="end" cornerRadius={16} stroke={{ type: "linear", angle: 90, stops: ["#7c3aed", "#db2777"] }} strokeWidth={3} strokeAlign="inside">
            <Text fontSize={13} fontWeight={600} color={INK}>stroke</Text>
          </Column>
        </Row>

        <Caption>STROKE ALIGN · INSIDE / CENTER / OUTSIDE (8px)</Caption>
        <Row gap={28} padding={[0, 8]}>
          {/** @type {const} */ (["inside", "center", "outside"]).map((a) => (
            <Rect key={a} width={96} height={48} cornerRadius={12} fill="#ffffff" stroke="rgba(124,74,45,0.6)" strokeWidth={8} strokeAlign={a} />
          ))}
        </Row>

        <Caption>PER-SIDE STROKE · PER-CORNER RADIUS · DASH</Caption>
        <Row gap={12} height={88} align="stretch">
          <Column width="fill" padding={12} fill="#ffffff" stroke={BRAND} strokeWidth={[0, 0, 3, 0]} strokeAlign="inside">
            <Text fontSize={12} color={INK}>bottom border only</Text>
          </Column>
          <Column width="fill" padding={12} fill="#f5e6d8" cornerRadius={[24, 24, 0, 0]}>
            <Text fontSize={12} color={INK}>sheet corners</Text>
          </Column>
          <Column width="fill" padding={12} align="center" justify="center" cornerRadius={12} stroke="#a8a29e" strokeWidth={1.5} strokeDash={[6, 4]} strokeAlign="inside">
            <Text fontSize={12} color={MUTED}>Drop photo</Text>
          </Column>
        </Row>

        <Caption>OPACITY · ROTATION</Caption>
        <Frame width="fill" height={120}>
          <Row x={0} y={20} height={44} padding={[0, 20]} align="center" cornerRadius={22} fill={BRAND}>
            <Text fontSize={15} fontWeight={600} color="#ffffff">Pay now</Text>
          </Row>
          <Row x={130} y={20} height={44} padding={[0, 20]} align="center" cornerRadius={22} fill={BRAND} opacity={0.4}>
            <Text fontSize={15} fontWeight={600} color="#ffffff">Disabled</Text>
          </Row>
          <Row x={290} y={30} height={36} padding={[0, 14]} align="center" cornerRadius={8} fill="#facc15" rotation={-8} shadow={{ y: 4, blur: 10, color: "rgba(0,0,0,0.15)" }}>
            <Text fontSize={14} fontWeight={800} color={INK}>NEW · 新品</Text>
          </Row>
          <Path x={396} y={16} width={28} height={28} viewBox="0 0 24 24" rotation={45} d="M12 2 L15 9 L22 9 L16.5 13.5 L18.5 21 L12 16.5 L5.5 21 L7.5 13.5 L2 9 L9 9 Z" fill="#f59e0b" />
        </Frame>

        <Caption>LAYER BLUR · 0 PX / 12 PX</Caption>
        <Row gap={24}>
          <Image src={latte} width={160} height={120} cornerRadius={12} />
          <Image src={latte} width={160} height={120} cornerRadius={12} blur={12} />
        </Row>
      </Column>
    </Frame>
  );
}

export function Typography() {
  return (
    <Frame width={480} height={620} fill="#ffffff">
      <Column width="fill" padding={24} gap={18} align="stretch">
        <Caption>SPAN · MIXED SIZES ON ONE BASELINE</Caption>
        <Text fontSize={14} color={INK}>
          ¥<Span fontSize={32} fontWeight={700}>28</Span>.00 <Span color="#78716c" textDecoration="line-through">¥36</Span>{" "}
          <Span color="#dc2626" fontWeight={600}>限时 7.8 折</Span>
        </Text>

        <Caption>FONT FAMILIES · ITALIC · LETTER SPACING</Caption>
        <Text fontFamily="Fraunces" fontSize={34} fontWeight={600} color={BRAND}>
          Roastery <Span italic fontWeight={400}>& Co.</Span>
        </Text>
        <Text fontSize={12} fontWeight={700} letterSpacing={3} color={MUTED}>SINGLE ORIGIN · 单一产地</Text>
        <Text fontFamily="JetBrains Mono" fontSize={13} color={INK}>
          ORDER #A-2048 · <Span fontWeight={700}>pickup 14:35</Span>
        </Text>
        <Text fontSize={15} italic color={INK}>Italic Inter, 中文为合成斜体</Text>

        <Caption>TABULAR NUMS (RIGHT) VS PROPORTIONAL (LEFT)</Caption>
        <Row gap={32}>
          <Column gap={2} align="end">
            {["1,111.11", "8,888.88", "11.10"].map((n) => (
              <Text key={n} fontSize={16} color={INK}>{n}</Text>
            ))}
          </Column>
          <Column gap={2} align="end">
            {["1,111.11", "8,888.88", "11.10"].map((n) => (
              <Text key={n} fontSize={16} tabularNums color={INK}>{n}</Text>
            ))}
          </Column>
        </Row>

        <Caption>MAX LINES · ELLIPSIS · UNDERLINE</Caption>
        <Text width="fill" maxLines={2} fontSize={14} lineHeight={20} color={INK}>
          Ethiopia Yirgacheffe, washed process — notes of jasmine, bergamot and stone fruit with a tea-like body and a long, sweet finish that lingers well after the cup is gone.
        </Text>
        <Text fontSize={14} textDecoration="underline" color="#2563eb">View origin story</Text>
      </Column>
    </Frame>
  );
}

export function Images() {
  return (
    <Frame width={480} height={620} fill="#fafaf9">
      <Column width="fill" padding={24} gap={16} align="stretch">
        <Caption>FIT · COVER / CONTAIN / FILL</Caption>
        <Row gap={12}>
          {/** @type {const} */ (["cover", "contain", "fill"]).map((fit) => (
            <Column key={fit} gap={6}>
              <Image src={latte} width={132} height={132} fit={fit} fill="#e7e5e4" cornerRadius={12} />
              <Text fontSize={12} color={MUTED}>{fit}</Text>
            </Column>
          ))}
        </Row>

        <Caption>BOTTOM-ANCHORED OVERLAY ON AN IMAGE</Caption>
        <Frame width="fill" height={200}>
          <Image src={latte} width="fill" height="fill" cornerRadius={20} />
          <Column x={16} bottom={16} padding={[10, 14]} gap={2} cornerRadius={12} backdropBlur={16} fill="rgba(28,25,23,0.45)">
            <Text fontSize={15} fontWeight={600} color="#ffffff">Flat White</Text>
            <Text fontSize={12} color="#e7e5e4">Double ristretto · whole milk</Text>
          </Column>
        </Frame>

        <Caption>PLACEHOLDER (NO SRC)</Caption>
        <Row gap={12}>
          <Image width={64} height={64} cornerRadius={32} />
          <Image width={160} height={64} cornerRadius={8} />
          <Image src={latte} width={86} />
        </Row>
        <Text fontSize={12} color={MUTED}>Last image: width only, height follows the 4:3 file.</Text>
      </Column>
    </Frame>
  );
}

export function Masks() {
  return (
    <Frame width={480} height={240} fill="#fafaf9">
      <Row width="fill" padding={24} gap={16}>
        <Column width="fill" gap={10}>
          <Caption>ELLIPSE MASK</Caption>
          <Image
            src={latte}
            width="fill"
            height={156}
            mask={<Ellipse width="fill" height="fill" fill="#fff" />}
          />
        </Column>
        <Column width="fill" gap={10}>
          <Caption>GRADIENT FADE</Caption>
          <Image
            src={latte}
            width="fill"
            height={156}
            mask={
              <Rect
                width="fill"
                height="fill"
                fill={{ type: "linear", angle: 180, stops: [{ color: "#fff", position: 0.3 }, "#ffffff00"] }}
              />
            }
          />
        </Column>
      </Row>
    </Frame>
  );
}
