// Motion: springs, chained springs and time-driven loops. Press P in the viewer to play.

import { Column, Ellipse, Frame, Path, Rect, Row, Text, useAnimationTime, useSpring, useState, useVariant } from "artboards";

const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const ACCENT = "#4f46e5";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Mixes two "#rrggbb" colors; `p` may overshoot 0..1 with a bouncy spring. */
function mixColor(a: string, b: string, p: number): string {
  const t = clamp01(p);
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t));
  return `#${out.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function Title({ title, hint }: { title: string; hint: string }) {
  return (
    <Column width="fill" gap={4}>
      <Text fontSize={20} fontWeight={700} color={INK}>
        {title}
      </Text>
      <Text width="fill" fontSize={13} color={MUTED} lineHeight={19}>
        {hint}
      </Text>
    </Column>
  );
}

/** A button that sinks a little while pressed and lifts on hover. */
function PressButton({ label, onClick, tone = "primary" }: { label: string; onClick: () => void; tone?: "primary" | "plain" }) {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const s = useSpring(pressed ? 0.94 : hovered ? 1.03 : 1, { duration: 260, bounce: 0.35 });
  const primary = tone === "primary";
  return (
    <Row
      height={44}
      padding={[0, 20]}
      align="center"
      justify="center"
      cornerRadius={12}
      fill={primary ? ACCENT : "#f1f5f9"}
      scale={s}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={onClick}
    >
      <Text fontSize={15} fontWeight={600} color={primary ? "#ffffff" : INK}>
        {label}
      </Text>
    </Row>
  );
}

// ------------------------------------------------------------------ sheet

const SHEET_H = 300;

function ShareRow({ color, label, i, p }: { color: string; label: string; i: number; p: number }) {
  // Each row rides a little further than the sheet, so they settle in after it.
  return (
    <Column width="fill" gap={8} align="center" translateY={(1 - p) * (24 + i * 64)}>
      <Ellipse width={52} height={52} fill={color} />
      <Text fontSize={12} color={MUTED}>
        {label}
      </Text>
    </Column>
  );
}

export function SpringSheet() {
  const [sheet, setSheet] = useVariant("Sheet", ["closed", "open"]);
  const open = sheet === "open";
  const p = useSpring(open ? 1 : 0, { duration: 480, bounce: 0.14 });
  const rows = useSpring(open ? 1 : 0, { duration: 620, bounce: 0.2 });
  return (
    <Frame width={390} height={640} fill="#f8fafc" clip>
      <Column width="fill" height="fill" padding={24} gap={20}>
        <Title title="Sheet" hint="Click Share, then the backdrop. Click again mid-flight: the spring turns around without a jump." />
        <Column width="fill" height={220} cornerRadius={20} fill={{ type: "linear", angle: 135, stops: ["#c7d2fe", "#fbcfe8"] }} scale={1 - p * 0.04} />
        <PressButton label="Share" onClick={() => setSheet(open ? "closed" : "open")} />
      </Column>
      {p > 0.001 && (
        <Rect name="Backdrop" width="fill" height="fill" fill="#0f172a" opacity={clamp01(p) * 0.45} onClick={() => setSheet("closed")} />
      )}
      {p > 0.001 && (
        <Column
          name="Sheet"
          y={640 - SHEET_H}
          width="fill"
          height={SHEET_H + 40}
          padding={[12, 24, 24, 24]}
          gap={20}
          align="center"
          fill="#ffffff"
          cornerRadius={[24, 24, 0, 0]}
          translateY={(1 - p) * (SHEET_H + 20)}
          shadow={{ y: -4, blur: 24, color: "rgba(15,23,42,0.12)" }}
        >
          <Rect width={36} height={5} cornerRadius={3} fill={LINE} />
          <Text fontSize={17} fontWeight={600} color={INK}>
            Share to
          </Text>
          <Row width="fill" gap={8}>
            <ShareRow i={0} p={rows} color="#22c55e" label="Messages" />
            <ShareRow i={1} p={rows} color="#3b82f6" label="Mail" />
            <ShareRow i={2} p={rows} color="#f59e0b" label="Notes" />
            <ShareRow i={3} p={rows} color="#ec4899" label="Photos" />
          </Row>
        </Column>
      )}
    </Frame>
  );
}

// ------------------------------------------------------------------ bounce lab

const TRACK = 314;

function Lane({ bounce, duration, on }: { bounce: number; duration: number; on: boolean }) {
  const x = useSpring(on ? TRACK : 0, { duration, bounce });
  return (
    <Column width="fill" gap={8}>
      <Row width="fill" justify="space-between">
        <Text fontSize={13} fontWeight={600} color={INK}>
          bounce {bounce}
        </Text>
        <Text fontSize={12} color={MUTED} tabularNums>
          {duration} ms
        </Text>
      </Row>
      <Frame width={TRACK + 28} height={28}>
        <Rect y={13} width="fill" height={2} fill={LINE} />
        <Ellipse width={28} height={28} fill={ACCENT} translateX={x} />
      </Frame>
    </Column>
  );
}

export function BounceLab() {
  const [on, setOn] = useState(false);
  return (
    <Frame width={390} height={580} fill="#ffffff">
      <Column width="fill" height="fill" padding={24} gap={24}>
        <Title title="Bounce" hint="The same move with different springs. Click Move to send every ball to the other side." />
        <Lane on={on} duration={500} bounce={0} />
        <Lane on={on} duration={500} bounce={0.3} />
        <Lane on={on} duration={500} bounce={0.6} />
        <Lane on={on} duration={900} bounce={0.15} />
        <Lane on={on} duration={250} bounce={0.15} />
        <PressButton label="Move" onClick={() => setOn(!on)} />
      </Column>
    </Frame>
  );
}

// ------------------------------------------------------------------ cascade

const NOTES = [
  { from: "Maya", text: "Pushed the new onboarding flow", color: "#f97316" },
  { from: "Leo", text: "Left 3 comments on Checkout", color: "#06b6d4" },
  { from: "Ana", text: "Shared “Motion study v2”", color: "#a855f7" },
  { from: "Sam", text: "Approved the icon set", color: "#22c55e" },
  { from: "Kai", text: "Mentioned you in Settings", color: "#ef4444" },
];

function Note({ note, p }: { note: (typeof NOTES)[number]; p: number }) {
  return (
    <Row
      width="fill"
      height={60}
      padding={[0, 14]}
      gap={12}
      align="center"
      cornerRadius={14}
      fill="#ffffff"
      stroke={LINE}
      opacity={clamp01(p)}
      translateY={(1 - p) * 64}
      scale={0.92 + 0.08 * p}
    >
      <Ellipse width={34} height={34} fill={note.color} />
      <Column width="fill" gap={2}>
        <Text fontSize={14} fontWeight={600} color={INK}>
          {note.from}
        </Text>
        <Text width="fill" fontSize={13} color={MUTED} maxLines={1}>
          {note.text}
        </Text>
      </Column>
    </Row>
  );
}

function NoteList({ shown }: { shown: boolean }) {
  // A chain: each card's spring follows the previous card's value, so they
  // arrive one after another. The number of springs never changes. Every
  // card starts at 0, so the list enters whenever it mounts.
  let v = shown ? 1 : 0;
  const steps = NOTES.map(() => (v = useSpring(v, { duration: 400, bounce: 0.3, from: 0 })));
  return (
    <Column width="fill" gap={10}>
      {NOTES.map((note, i) => (
        <Note key={note.from} note={note} p={steps[i]} />
      ))}
    </Column>
  );
}

export function Cascade() {
  const [shown, setShown] = useState(true);
  const [run, setRun] = useState(0);
  return (
    <Frame width={390} height={640} fill="#f8fafc">
      <Column width="fill" height="fill" padding={24} gap={20}>
        <Title title="Cascade" hint="Chained springs: every card follows the one before it. Replay remounts the list so it enters again." />
        <NoteList key={run} shown={shown} />
        <Row width="fill" gap={12}>
          <PressButton label={shown ? "Hide" : "Show"} onClick={() => setShown(!shown)} />
          <PressButton
            tone="plain"
            label="Replay"
            onClick={() => {
              setShown(true);
              setRun(run + 1);
            }}
          />
        </Row>
      </Column>
    </Frame>
  );
}

// ------------------------------------------------------------------ controls

function Switch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  const p = useSpring(on ? 1 : 0, { duration: 340, bounce: 0.25 });
  // The knob stretches while it travels: fastest in the middle of the move.
  const stretch = 1 + 0.25 * Math.sin(Math.PI * clamp01(p));
  return (
    <Frame width={52} height={32} cornerRadius={16} fill={mixColor("#cbd5e1", "#22c55e", p)} onClick={() => onChange(!on)}>
      <Ellipse x={2} y={2} width={28} height={28} fill="#ffffff" translateX={p * 20} scale={[stretch, 1]} shadow={{ y: 1, blur: 3, color: "rgba(0,0,0,0.2)" }} />
    </Frame>
  );
}

const TABS = ["Day", "Week", "Month"];
const TAB_W = 104;

function Segmented() {
  const [tab, setTab] = useState(0);
  const x = useSpring(tab * TAB_W, { duration: 380, bounce: 0.2 });
  return (
    <Frame width={TAB_W * 3 + 8} height={40} cornerRadius={12} fill="#f1f5f9">
      <Rect x={4} y={4} width={TAB_W} height={32} cornerRadius={9} fill="#ffffff" translateX={x} shadow={{ y: 1, blur: 3, color: "rgba(0,0,0,0.12)" }} />
      <Row x={4} y={4} width={TAB_W * 3} height={32}>
        {TABS.map((label, i) => (
          <Row key={label} width={TAB_W} height="fill" align="center" justify="center" onClick={() => setTab(i)}>
            <Text fontSize={14} fontWeight={600} color={i === tab ? INK : "#475569"}>
              {label}
            </Text>
          </Row>
        ))}
      </Row>
    </Frame>
  );
}

const BARS = [
  [0.4, 0.7, 0.5, 0.9, 0.6, 0.3, 0.8],
  [0.8, 0.35, 0.6, 0.45, 0.95, 0.7, 0.55],
];

function Bar({ value }: { value: number }) {
  const v = useSpring(value, { duration: 520, bounce: 0.25 });
  return <Rect width="fill" height={120} cornerRadius={6} fill={ACCENT} origin={[0.5, 1]} scale={[1, Math.max(0, v)]} />;
}

function Counter({ value }: { value: number }) {
  const v = useSpring(value, { duration: 700 });
  return (
    <Text fontSize={34} fontWeight={700} color={INK} tabularNums>
      ${Math.round(v).toLocaleString("en-US")}
    </Text>
  );
}

export function Controls() {
  const [wifi, setWifi] = useState(true);
  const [sync, setSync] = useState(false);
  const [set, setSet] = useState(0);
  const total = Math.round(BARS[set].reduce((a, b) => a + b, 0) * 1820);
  return (
    <Frame width={390} height={640} fill="#ffffff">
      <Column width="fill" height="fill" padding={24} gap={22}>
        <Title title="Controls" hint="Switches, a sliding segment, and a chart whose bars and total spring to new data." />
        <Column width="fill" gap={14}>
          <Row width="fill" justify="space-between" align="center">
            <Text fontSize={15} color={INK}>
              Wi-Fi
            </Text>
            <Switch on={wifi} onChange={setWifi} />
          </Row>
          <Row width="fill" justify="space-between" align="center">
            <Text fontSize={15} color={INK}>
              iCloud sync
            </Text>
            <Switch on={sync} onChange={setSync} />
          </Row>
        </Column>
        <Segmented />
        <Column width="fill" gap={12}>
          <Counter value={total} />
          <Row width="fill" height={120} gap={10} align="end">
            {BARS[set].map((v, i) => (
              <Bar key={i} value={v} />
            ))}
          </Row>
        </Column>
        <PressButton label="Shuffle data" onClick={() => setSet(1 - set)} />
      </Column>
    </Frame>
  );
}

// ------------------------------------------------------------------ ambient

function Spinner() {
  const t = useAnimationTime();
  return (
    <Frame width={40} height={40}>
      <Path width={40} height={40} viewBox="0 0 24 24" d="M12 3 A9 9 0 1 1 3 12" stroke={LINE} strokeWidth={2.5} />
      <Path width={40} height={40} viewBox="0 0 24 24" d="M12 3 A9 9 0 0 1 21 12" stroke={ACCENT} strokeWidth={2.5} strokeCap="round" rotation={(t * 0.36) % 360} />
    </Frame>
  );
}

function Dots() {
  const t = useAnimationTime();
  return (
    <Row gap={8} align="center" height={40}>
      {[0, 1, 2].map((i) => {
        const wave = 0.5 + 0.5 * Math.sin(t / 180 - i * 0.9);
        return <Ellipse key={i} width={10} height={10} fill={ACCENT} opacity={0.3 + 0.7 * wave} translateY={-6 * wave} />;
      })}
    </Row>
  );
}

function Skeleton() {
  const t = useAnimationTime();
  const sweep = ((t % 1400) / 1400) * 520 - 160;
  return (
    <Frame width="fill" height={96} cornerRadius={14} fill="#f1f5f9" clip>
      <Ellipse x={16} y={16} width={64} height={64} fill="#e2e8f0" />
      <Rect x={96} y={24} width={180} height={14} cornerRadius={7} fill="#e2e8f0" />
      <Rect x={96} y={50} width={120} height={12} cornerRadius={6} fill="#e2e8f0" />
      <Rect width={120} height="fill" translateX={sweep} fill={{ type: "linear", angle: 90, stops: ["rgba(255,255,255,0)", "rgba(255,255,255,0.75)", "rgba(255,255,255,0)"] }} />
    </Frame>
  );
}

function Orbit() {
  const t = useAnimationTime();
  const a = t / 900;
  return (
    <Frame width={120} height={120}>
      <Ellipse x={10} y={10} width={100} height={100} stroke={LINE} strokeWidth={1} />
      <Ellipse x={48} y={48} width={24} height={24} fill="#f59e0b" scale={1 + 0.08 * Math.sin(t / 250)} />
      <Ellipse x={54} y={4} width={12} height={12} fill={ACCENT} translateX={Math.sin(a) * 50} translateY={50 - Math.cos(a) * 50} />
    </Frame>
  );
}

export function Ambient() {
  return (
    <Frame width={390} height={520} fill="#ffffff">
      <Column width="fill" height="fill" padding={24} gap={24}>
        <Title title="Ambient" hint="Loops driven by useAnimationTime: a spinner, pulsing dots, a shimmer and an orbit." />
        <Row width="fill" gap={32} align="center">
          <Spinner />
          <Dots />
          <Orbit />
        </Row>
        <Skeleton />
      </Column>
    </Frame>
  );
}
