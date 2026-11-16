import { Column, Ellipse, Frame, Path, Rect, Row, Text, useState, type MouseEvent } from "artboards";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

function rgbHex(r: number, g: number, b: number): string {
  const byte = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

function lampColor(warmth: number, tint: number): string {
  // Interpolate cool daylight (#93c5fd) -> warm tungsten (#fb923c), then apply rose/mint tint.
  const r = 147 + warmth * (251 - 147) + (tint - 0.5) * 32;
  const g = 197 + warmth * (146 - 197) - Math.abs(tint - 0.5) * 28;
  const b = 253 + warmth * (60 - 253) + (0.5 - tint) * 36;
  return rgbHex(r, g, b);
}

const SLIDER_W = 372;
const PAD_W = 372;
const PAD_H = 144;

function Slider({
  label,
  valueText,
  value,
  accent,
  onChange,
}: {
  label: string;
  valueText: string;
  value: number;
  accent: string;
  onChange: (next: number) => void;
}) {
  const thumb = 20;
  const fillW = Math.max(8, value * SLIDER_W);
  const thumbX = value * (SLIDER_W - thumb);
  const update = (e: MouseEvent) => onChange(clamp01(e.x / SLIDER_W));

  return (
    <Column width="fill" gap={6} align="stretch">
      <Row width="fill" justify="space-between" align="center">
        <Text fontSize={13} fontWeight={500} color="#cbd5e1">
          {label}
        </Text>
        <Text fontSize={12} fontWeight={600} color="#f8fafc" tabularNums>
          {valueText}
        </Text>
      </Row>
      <Frame
        name={label}
        width={SLIDER_W}
        height={28}
        onMouseDown={(e) => update(e)}
        onMouseMove={(e) => e.pressed && update(e)}
      >
        <Rect y={10} width={SLIDER_W} height={8} cornerRadius={4} fill="#334155" />
        <Rect y={10} width={fillW} height={8} cornerRadius={4} fill={accent} />
        <Ellipse
          x={thumbX}
          y={4}
          width={thumb}
          height={thumb}
          fill="#ffffff"
          stroke={accent}
          strokeWidth={3}
          shadow={{ y: 2, blur: 6, color: "rgba(0, 0, 0, 0.45)" }}
        />
      </Frame>
    </Column>
  );
}

export function LightingControl() {
  const [power, setPower] = useState(true);
  const [brightness, setBrightness] = useState(0.76);
  const [glow, setGlow] = useState(0.54);
  const [warmth, setWarmth] = useState(0.62);
  const [tint, setTint] = useState(0.35);
  const [resetPressed, setResetPressed] = useState(false);

  const color = lampColor(warmth, tint);
  const kelvin = Math.round(6500 - warmth * 3800);
  const padKnob = 22;
  const padX = warmth * (PAD_W - padKnob);
  const padY = tint * (PAD_H - padKnob);
  const previewGlowSize = Math.round(72 + glow * 108);

  const updatePad = (e: MouseEvent) => {
    setWarmth(clamp01(e.x / PAD_W));
    setTint(clamp01(e.y / PAD_H));
  };

  const resetAll = () => {
    setPower(true);
    setBrightness(0.76);
    setGlow(0.54);
    setWarmth(0.62);
    setTint(0.35);
  };

  return (
    <Frame width={420} height={600} fill="#0f172a">
      <Column width="fill" height="fill" padding={24} gap={18} align="stretch">
        <Row width="fill" justify="space-between" align="center">
          <Column gap={2}>
            <Text fontSize={20} fontWeight={700} color="#f8fafc">
              Studio Light
            </Text>
            <Text fontSize={12} color="#94a3b8">
              Play mode · drag XY pad & sliders
            </Text>
          </Column>
          <Row
            padding={[5, 10]}
            gap={6}
            align="center"
            cornerRadius={99}
            fill={power ? "#14532d" : "#1e293b"}
            stroke={power ? "#22c55e" : "#475569"}
            onClick={() => setPower((p) => !p)}
          >
            <Ellipse width={7} height={7} fill={power ? "#4ade80" : "#94a3b8"} />
            <Text fontSize={11} fontWeight={600} color="#f8fafc">
              {power ? "ON" : "STANDBY"}
            </Text>
          </Row>
        </Row>

        {/* Live Lamp Preview */}
        <Frame width={372} height={106} cornerRadius={14} fill="#0b1120" stroke="#1e293b" clip>
          {power && (
            <Ellipse
              x={292 - previewGlowSize / 2}
              y={53 - previewGlowSize / 2}
              width={previewGlowSize}
              height={previewGlowSize}
              fill={color}
              opacity={0.18 + brightness * 0.42}
              blur={22}
            />
          )}
          <Ellipse
            x={268}
            y={29}
            width={48}
            height={48}
            fill={power ? color : "#334155"}
            opacity={power ? 0.35 + brightness * 0.65 : 0.7}
            stroke="rgba(255, 255, 255, 0.35)"
            strokeWidth={1.5}
          />
          <Column x={18} y={18} gap={6}>
            <Text fontSize={28} fontWeight={700} color="#f8fafc" tabularNums>
              {power ? `${Math.round(brightness * 100)}%` : "OFF"}
            </Text>
            <Text fontSize={12} color="#94a3b8" tabularNums>
              {kelvin}K · Glow {Math.round(glow * 100)}% · {color.toUpperCase()}
            </Text>
          </Column>
        </Frame>

        {/* 2D XY Warmth & Tint Pad */}
        <Column width="fill" gap={6} align="stretch">
          <Row width="fill" justify="space-between" align="center">
            <Text fontSize={13} fontWeight={500} color="#cbd5e1">
              Color Temperature & Tint
            </Text>
            <Text fontSize={12} color="#94a3b8" tabularNums>
              ({Math.round(warmth * 100)}, {Math.round(tint * 100)})
            </Text>
          </Row>
          <Frame
            name="XY Pad"
            width={PAD_W}
            height={PAD_H}
            cornerRadius={14}
            clip
            stroke="#334155"
            onMouseDown={(e) => updatePad(e)}
            onMouseMove={(e) => e.pressed && updatePad(e)}
          >
            <Rect
              width={PAD_W}
              height={PAD_H}
              fill={{ type: "linear", angle: 90, stops: ["#60a5fa", "#fde68a", "#fb923c"] }}
            />
            <Rect
              width={PAD_W}
              height={PAD_H}
              fill={{
                type: "linear",
                angle: 180,
                stops: ["rgba(244, 114, 182, 0.38)", "rgba(15, 23, 42, 0.08)", "rgba(52, 211, 153, 0.38)"],
              }}
            />
            <Rect x={padX + padKnob / 2} y={0} width={1} height={PAD_H} fill="rgba(15, 23, 42, 0.35)" />
            <Rect x={0} y={padY + padKnob / 2} width={PAD_W} height={1} fill="rgba(15, 23, 42, 0.35)" />
            <Ellipse
              x={padX}
              y={padY}
              width={padKnob}
              height={padKnob}
              fill={color}
              stroke="#ffffff"
              strokeWidth={3}
              shadow={{ y: 2, blur: 8, color: "rgba(0, 0, 0, 0.45)" }}
            />
          </Frame>
        </Column>

        {/* Continuous Sliders */}
        <Column width="fill" gap={12} align="stretch">
          <Slider
            label="Brightness"
            valueText={`${Math.round(brightness * 100)}%`}
            value={brightness}
            accent="#f59e0b"
            onChange={setBrightness}
          />
          <Slider
            label="Glow Spread"
            valueText={`${Math.round(glow * 100)}%`}
            value={glow}
            accent="#38bdf8"
            onChange={setGlow}
          />
        </Column>

        {/* Tactile Press Buttons */}
        <Row width="fill" gap={10} align="center">
          <Row
            name="Reset Button"
            width="fill"
            height={40}
            align="center"
            justify="center"
            cornerRadius={10}
            fill={resetPressed ? "#1e293b" : "#334155"}
            stroke={resetPressed ? "#64748b" : "#475569"}
            onMouseDown={() => setResetPressed(true)}
            onMouseUp={() => setResetPressed(false)}
            onClick={resetAll}
          >
            <Text fontSize={13} fontWeight={600} color="#f8fafc">
              {resetPressed ? "Release to Reset" : "Reset Preset"}
            </Text>
          </Row>
          <Row
            name="Toggle Power"
            width="fill"
            height={40}
            align="center"
            justify="center"
            cornerRadius={10}
            fill={power ? "#2563eb" : "#1d4ed8"}
            onClick={() => setPower((p) => !p)}
          >
            <Text fontSize={13} fontWeight={600} color="#ffffff">
              {power ? "Turn Off" : "Turn On"}
            </Text>
          </Row>
        </Row>
      </Column>
    </Frame>
  );
}

interface CardItem {
  id: string;
  title: string;
  subtitle: string;
  fill: string;
  stroke: string;
  x: number;
  y: number;
}

const CHART_W = 432;
const CHART_H = 140;
const SERIES = [24, 38, 31, 56, 48, 72, 65, 89, 82, 94];

function sampleSeries(x: number): { value: number; py: number } {
  const t = clamp01(x / CHART_W) * (SERIES.length - 1);
  const i = Math.min(SERIES.length - 2, Math.floor(t));
  const f = t - i;
  const value = SERIES[i] + (SERIES[i + 1] - SERIES[i]) * f;
  const py = CHART_H - 18 - (value / 100) * (CHART_H - 42);
  return { value, py };
}

const BOARD_W = 432;
const BOARD_H = 236;
const CARD_W = 148;
const CARD_H = 74;

const INITIAL_CARDS: CardItem[] = [
  { id: "a", title: "Wireframes", subtitle: "Drag anywhere", fill: "#fef3c7", stroke: "#f59e0b", x: 20, y: 22 },
  { id: "b", title: "Prototype", subtitle: "Local coords", fill: "#dbeafe", stroke: "#3b82f6", x: 196, y: 42 },
  { id: "c", title: "Design QA", subtitle: "Release outside", fill: "#dcfce7", stroke: "#22c55e", x: 108, y: 132 },
];

export function InteractiveCanvas() {
  const [scrubX, setScrubX] = useState(258);
  const [pinnedX, setPinnedX] = useState<number | null>(144);
  const [cards, setCards] = useState<CardItem[]>(INITIAL_CARDS);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);

  const sample = sampleSeries(scrubX);
  const pinnedSample = pinnedX != null ? sampleSeries(pinnedX) : null;
  const tipW = 104;
  const tipX = clamp(scrubX - tipW / 2, 6, CHART_W - tipW - 6);

  const sparkD = SERIES.map((v, idx) => {
    const px = Math.round((idx / (SERIES.length - 1)) * CHART_W);
    const py = Math.round(CHART_H - 18 - (v / 100) * (CHART_H - 42));
    return `${idx === 0 ? "M" : "L"} ${px} ${py}`;
  }).join(" ");

  const moveCard = (id: string, nextX: number, nextY: number) => {
    const x = clamp(nextX, 8, BOARD_W - CARD_W - 8);
    const y = clamp(nextY, 8, BOARD_H - CARD_H - 8);
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, x, y } : c)));
  };

  return (
    <Frame width={480} height={600} fill="#ffffff">
      <Column width="fill" height="fill" padding={24} gap={18} align="stretch">
        <Row width="fill" justify="space-between" align="center">
          <Column gap={2}>
            <Text fontSize={20} fontWeight={700} color="#0f172a">
              Pointer Interactions
            </Text>
            <Text fontSize={12} color="#475569">
              Hover chart to scrub · drag cards on the board
            </Text>
          </Column>
          <Row
            padding={[5, 10]}
            cornerRadius={8}
            fill="#f1f5f9"
            stroke="#cbd5e1"
            onClick={() => {
              setCards(INITIAL_CARDS);
              setPinnedX(144);
              setScrubX(258);
            }}
          >
            <Text fontSize={12} fontWeight={600} color="#0f172a">
              Reset
            </Text>
          </Row>
        </Row>

        {/* Hover Scrubber Chart */}
        <Column width="fill" gap={6} align="stretch">
          <Row width="fill" justify="space-between" align="center">
            <Text fontSize={13} fontWeight={600} color="#0f172a">
              Hover Scrubber (onMouseMove)
            </Text>
            <Text fontSize={12} color="#475569" tabularNums>
              {pinnedSample ? `Pinned ${Math.round(pinnedSample.value)} pts` : "Click chart to pin"}
            </Text>
          </Row>
          <Frame
            name="Hover Chart"
            width={CHART_W}
            height={CHART_H}
            cornerRadius={12}
            fill="#f8fafc"
            stroke="#e2e8f0"
            clip
            onMouseMove={(e) => setScrubX(clamp(e.x, 0, CHART_W))}
            onMouseDown={(e) => setPinnedX(clamp(e.x, 0, CHART_W))}
          >
            <Path
              x={0}
              y={0}
              width={CHART_W}
              height={CHART_H}
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              d={sparkD}
              stroke="#2563eb"
              strokeWidth={3}
              strokeCap="round"
              strokeJoin="round"
            />
            {pinnedX != null && pinnedSample && (
              <>
                <Rect x={pinnedX} y={10} width={1.5} height={CHART_H - 20} fill="#94a3b8" />
                <Ellipse x={pinnedX - 4} y={pinnedSample.py - 4} width={8} height={8} fill="#475569" />
              </>
            )}
            <Rect x={scrubX} y={10} width={1.5} height={CHART_H - 20} fill="#2563eb" />
            <Ellipse
              x={scrubX - 5}
              y={sample.py - 5}
              width={10}
              height={10}
              fill="#ffffff"
              stroke="#2563eb"
              strokeWidth={2.5}
            />
            <Row
              x={tipX}
              y={8}
              width={tipW}
              height={24}
              align="center"
              justify="center"
              cornerRadius={6}
              fill="#0f172a"
            >
              <Text fontSize={11} fontWeight={600} color="#ffffff" tabularNums>
                {Math.round(sample.value)} pts · {Math.round(scrubX)}px
              </Text>
            </Row>
          </Frame>
        </Column>

        {/* Draggable Sticker Board */}
        <Column width="fill" gap={6} align="stretch">
          <Row width="fill" justify="space-between" align="center">
            <Text fontSize={13} fontWeight={600} color="#0f172a">
              Draggable Cards (onMouseDown + onMouseMove)
            </Text>
            <Text fontSize={12} color="#475569">
              {drag ? `Dragging ${drag.id.toUpperCase()}` : "Idle"}
            </Text>
          </Row>
          <Frame
            name="Sticker Board"
            width={BOARD_W}
            height={BOARD_H}
            cornerRadius={14}
            fill="#f1f5f9"
            stroke="#cbd5e1"
            clip
            onMouseMove={(e) => {
              if (e.pressed && drag) moveCard(drag.id, e.x - drag.dx, e.y - drag.dy);
            }}
            onMouseUp={() => setDrag(null)}
          >
            {cards.map((card) => {
              const active = drag?.id === card.id;
              return (
                <Column
                  key={card.id}
                  name={card.title}
                  x={card.x}
                  y={card.y}
                  width={CARD_W}
                  height={CARD_H}
                  padding={[12, 14]}
                  gap={4}
                  justify="center"
                  cornerRadius={12}
                  fill={card.fill}
                  stroke={card.stroke}
                  strokeWidth={active ? 2 : 1}
                  shadow={
                    active
                      ? { y: 8, blur: 18, color: "rgba(15, 23, 42, 0.2)" }
                      : { y: 2, blur: 6, color: "rgba(15, 23, 42, 0.08)" }
                  }
                  onMouseDown={(e) => {
                    setDrag({ id: card.id, dx: e.x, dy: e.y });
                    // Bring dragged card to front by moving it to the end of the array.
                    setCards((prev) => [...prev.filter((c) => c.id !== card.id), card]);
                  }}
                >
                  <Text fontSize={14} fontWeight={700} color="#0f172a">
                    {card.title}
                  </Text>
                  <Text fontSize={11} color="#334155" tabularNums>
                    {card.subtitle} ({Math.round(card.x)}, {Math.round(card.y)})
                  </Text>
                </Column>
              );
            })}
          </Frame>
        </Column>

        <Text fontSize={12} color="#475569">
          MouseEvent delivers local (x, y) relative to the handler layer and pressed state.
        </Text>
      </Column>
    </Frame>
  );
}
