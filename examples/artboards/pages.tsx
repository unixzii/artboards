// The website's feature pages, one feature each. Terminal output is what the
// CLI prints for the sample app in phone.tsx.

import type { ReactNode } from "react";
import { Column, Frame, Path, Rect, Row, Span, Text, useState, useVariant } from "artboards";
import { CommentPin, DotGrid, GhostArtboard, SelectionMarks } from "./canvas.tsx";
import { Code, Editor, FeaturePage, Key, Line, PAGE, Prompt, Segmented, Tag, Terminal, Window, tok } from "./parts.tsx";
import { NewTaskSheet, Phone, TASKS, type Task } from "./phone.tsx";
import { color, font, term } from "./tokens.ts";

const { tag, attr, value, kw, p } = tok;

export function DesignInCode() {
  return (
    <FeaturePage
      n={1}
      label="Code"
      title="Design in the language you ship."
      body={
        <>
          Artboards are JSX/TSX components made of a few layers: <Code>Frame</Code>, <Code>Row</Code>, <Code>Column</Code>,{" "}
          <Code>Grid</Code>, <Code>Text</Code>. Diff them, review them, reuse your components.
        </>
      }
    >
      <Window title="today.tsx" x={0} y={64} width={340}>
        <Editor
          start={3}
          highlight={8}
          lines={[
            [kw("export function "), "Today", p("() {")],
            ["  ", kw("return"), p(" (")],
            ["    ", p("<"), tag("Phone"), p(">")],
            ["      ", p("<"), tag("Text"), p(">"), "Today", p("</"), tag("Text"), p(">")],
            ["      ", p("<"), tag("TaskList"), p(" />")],
            ["      ", p("<"), tag("Button"), p(">"), "Add task", p("</"), tag("Button"), p(">")],
            ["    ", p("</"), tag("Phone"), p(">")],
            ["  ", p(");")],
            [p("}")],
          ]}
        />
      </Window>
      <Phone
        x={318}
        y={22}
        width={210}
        button={<SelectionMarks inset={3} />}
        overlay={
          <Row absolute right={14} bottom={68} height={20} padding={[0, 7]} align="center" fill={color.accent} cornerRadius={4}>
            <Text fontFamily={font.mono} fontSize={11} fontWeight={500} color="#ffffff">
              today.tsx:8
            </Text>
          </Row>
        }
      />
    </FeaturePage>
  );
}

export function Lint() {
  return (
    <FeaturePage
      n={2}
      label="Lint"
      title="Layout bugs, caught before review."
      body="One command type-checks the file, lays out every artboard and points at overflow, clipped text and low contrast, with the line to fix."
      command="artboards lint today.tsx"
    >
      <Window title="zsh" dark x={0} y={6} width={528}>
        <Terminal>
          <Prompt>artboards lint today.tsx</Prompt>
          <Line>
            <Span color={term.path}>today.tsx:10</Span>  <Span color={term.warn}>warning[low-contrast]</Span> (Today)  {"<Text>"} has a contrast ratio of
            1.74:1 against its background; 4.5:1 is the minimum for this size.
          </Line>
          <Line>
            <Span color={term.path}>today.tsx:11</Span>  <Span color={term.warn}>warning[overflow]</Span> (Today)  {"<Rect>"} overflows its parent {"<Row>"} by
            106px horizontally.
          </Line>
          <Line color={term.warn}>0 error(s), 2 warning(s)</Line>
        </Terminal>
      </Window>

      <Text absolute x={40} y={250} fontSize={12} fontWeight={500} color={color.muted}>
        Today
      </Text>
      <Frame name="fragment" absolute x={40} y={270} width={330} height={150} fill={color.surface} stroke={color.line} cornerRadius={4} clip>
        <Text x={24} y={16} fontSize={22} fontWeight={700} color={color.ink}>
          Today
        </Text>
        <Text x={32} y={63} fontSize={13} color={color.muted}>
          2 of 3 left
        </Text>
      </Frame>
      <Rect name="row outline" absolute x={64} y={326} width={240} height={30} stroke={color.danger} strokeWidth={1.5} strokeDash={[5, 4]} />
      <Rect name="overflowing pill" absolute x={150} y={328} width={256} height={26} fill={color.accent} cornerRadius={13} />
      <Path name="overflow" absolute x={304} y={368} width={102} height={10} viewBox="0 0 102 10" d="M1 0 V10 M1 5 H101 M101 0 V10" stroke={color.danger} strokeWidth={1.5} />
      <Row absolute x={322} y={384} height={22} padding={[0, 8]} align="center" fill={color.danger} cornerRadius={4}>
        <Text fontFamily={font.mono} fontSize={12} fontWeight={500} color="#ffffff">
          +106px
        </Text>
      </Row>
    </FeaturePage>
  );
}

export function Inspect() {
  return (
    <FeaturePage
      n={3}
      label="Inspect"
      title="See exactly what you built."
      body="Render any artboard to PNG, or print its layer tree with computed bounds and source lines. Your agent checks its own work without opening a browser."
      command="artboards inspect today.tsx"
    >
      <Window title="zsh" dark x={0} y={30} width={344}>
        <Terminal gap={2}>
          <Prompt size={11}>artboards inspect today.tsx</Prompt>
          <Line size={11}># Today  390x844</Line>
          <Line size={11} color={term.dim}>
            variants:
          </Line>
          <Line size={11} color={term.dim}>
            {'  State = "Tasks"'}
          </Line>
          <Line size={11}>
            {"<Phone>  [0,0 390x844]  "}
            <Span color={term.path}>today.tsx:5</Span>
          </Line>
          <Line size={11}>
            {'  Text "Today"  [24,24 342x34]  '}
            <Span color={term.path}>today.tsx:6</Span>
          </Line>
          <Line size={11}>
            {"  <TaskList>  [24,74 342x136]  "}
            <Span color={term.path}>today.tsx:7</Span>
          </Line>
          <Line size={11}>
            {"    Row  [0,0 342x40]  "}
            <Span color={term.path}>today.tsx:14</Span>
          </Line>
          <Line size={11}>{" "}</Line>
          <Prompt size={11}>artboards render today.tsx -s 2</Prompt>
          <Line size={11}>
            out/today.Today.png  <Span color={term.dim}>390x844 @2x</Span>
          </Line>
        </Terminal>
      </Window>
      <Phone x={358} y={30} width={170} />
      <Row absolute x={358} y={384} width={170} justify="center">
        <Tag mono>today.Today.png</Tag>
      </Row>
    </FeaturePage>
  );
}

const STATES = ["Tasks", "Empty", "Loading"] as const;

/** A real variant: pick State in the viewer's Properties panel and the phone follows. */
export function Variants() {
  const [state, setState] = useVariant("State", STATES);
  return (
    <FeaturePage
      n={4}
      label="Variants"
      title="Every state, one click away."
      body={
        <>
          Declare loading, empty and error states with <Code>useVariant</Code>. Reviewers switch between them in the viewer, and{" "}
          <Code>--variant</Code> renders any of them from the CLI.
        </>
      }
    >
      <Window title="today.tsx" x={0} y={34} width={296}>
        <Editor
          start={4}
          lines={[
            [kw("const "), p("["), "state", p("] = "), "useVariant", p("(")],
            ["  ", value('"State"'), p(",")],
            ["  ", p("["), value('"Tasks"'), p(", "), value('"Empty"'), p(", "), value('"Loading"'), p("],")],
            [p(");")],
          ]}
        />
      </Window>
      <Column name="properties" absolute x={0} y={208} width={296} padding={14} gap={12} fill={color.surface} stroke={color.line} strokeAlign="outside" cornerRadius={10}>
        <Text fontSize={12} fontWeight={600} color={color.ink}>
          Variants
        </Text>
        <Row width="fill" align="center">
          <Text width="fill" fontSize={12} color={color.mutedStrong}>
            State
          </Text>
          <Segmented options={STATES} value={state} onPick={setState} />
        </Row>
      </Column>
      <Row name="try it" absolute x={2} y={316} width={292} gap={8}>
        <Path width={16} height={16} viewBox="0 0 24 24" d="M12 19 V5 M5 12 L12 5 L19 12" stroke={color.accent} strokeWidth={2} strokeCap="round" strokeJoin="round" />
        <Text width="fill" fontSize={13} lineHeight={19} color={color.mutedStrong}>
          Try it: select this artboard and pick a State in the viewer's Properties panel. In Play mode, these buttons work too.
        </Text>
      </Row>
      <Phone x={318} y={22} width={210} state={state} />
    </FeaturePage>
  );
}

/** Tasks the New task sheet suggests, in turn. */
const NEXT_TASKS = ["Write release notes", "Book user interviews", "Update the changelog", "Plan the team offsite"];

/** A working prototype: in Play mode, Add task opens the sheet, Add adds the task, a click ticks one off. */
export function Play() {
  const [tasks, setTasks] = useState<Task[]>(TASKS);
  const [sheet, setSheet] = useState(false);
  const next = NEXT_TASKS[(tasks.length - TASKS.length) % NEXT_TASKS.length];
  const toggle = (index: number) => setTasks(tasks.map((t, i) => (i === index ? { ...t, done: !t.done } : t)));
  const add = () => {
    setTasks([...tasks, { text: next, done: false }]);
    setSheet(false);
  };
  return (
    <FeaturePage
      n={5}
      label="Play"
      title="Click through it like the real thing."
      body={
        <>
          Give any layer an <Code>onClick</Code> and press <Key>P</Key> in the viewer. Sheets open, lists grow and scroll, all from the design file.
        </>
      }
    >
      <Column name="try it" absolute x={0} y={128} width={270} padding={16} gap={12} fill={color.surface} stroke={color.line} strokeAlign="outside" cornerRadius={10}>
        <Text fontSize={12} fontWeight={600} color={color.ink}>
          Try it on this page
        </Text>
        <Step n={1}>
          Press <Span fontFamily={font.mono} fontWeight={700} color={color.accent}>P</Span> to enter Play mode
        </Step>
        <Step n={2}>Click Add task, then Add</Step>
        <Step n={3}>Click a task to tick it off</Step>
      </Column>
      <Row absolute x={361} y={0} height={30} padding={[0, 10, 0, 12]} gap={8} align="center" fill={color.ink} cornerRadius={15}>
        <Path width={10} height={12} viewBox="0 0 10 12" d="M0 0 L10 6 L0 12 Z" fill="#ffffff" />
        <Text fontSize={12} fontWeight={600} color="#ffffff">
          Play mode
        </Text>
        <Row height={18} padding={[0, 5]} align="center" fill="#3f3f46" cornerRadius={4}>
          <Text fontFamily={font.mono} fontSize={11} color="#ffffff">
            P
          </Text>
        </Row>
      </Row>
      <Phone
        x={318}
        y={44}
        width={210}
        tasks={tasks}
        onToggle={toggle}
        onAdd={() => setSheet(true)}
        overlay={sheet ? <NewTaskSheet width={210} text={next} onAdd={add} onClose={() => setSheet(false)} /> : null}
      />
    </FeaturePage>
  );
}

/** A numbered step in a "try it" card. */
function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <Row width="fill" gap={10} align="center">
      <Row width={20} height={20} align="center" justify="center" fill={color.accentSoft} cornerRadius={10}>
        <Text fontSize={11} fontWeight={700} color={color.accentStrong}>
          {n}
        </Text>
      </Row>
      <Text width="fill" fontSize={13} color={color.ink}>
        {children}
      </Text>
    </Row>
  );
}

export function Review() {
  return (
    <FeaturePage
      n={6}
      label="Review"
      title="Comments that know their line."
      body={
        <>
          Teammates comment on layers in the viewer, or on a static site from <Code>artboards build</Code>. Each comment comes back with the
          source line it belongs to.
        </>
      }
      command="artboards comments today.tsx"
    >
      <Phone x={0} y={22} width={156} overlay={<CommentPin n={2} x={74} y={14} />} button={<CommentPin n={1} right={10} y={-14} />} />
      <Column name="thread" absolute x={176} y={22} width={240} padding={14} gap={8} fill={color.surface} stroke={color.line} cornerRadius={10} shadow={{ y: 8, blur: 24, color: "rgba(24, 24, 27, 0.10)" }}>
        <Row gap={8} align="center">
          <Row width={24} height={24} align="center" justify="center" fill={color.agent} cornerRadius={12}>
            <Text fontSize={11} fontWeight={600} color="#ffffff">
              M
            </Text>
          </Row>
          <Text fontSize={13} fontWeight={600} color={color.ink}>
            Maya
          </Text>
          <Text fontSize={12} color={color.muted}>
            on {"<Text>"} · now
          </Text>
        </Row>
        <Text width="fill" fontSize={13} lineHeight={19} color={color.ink}>
          Show today's date under the title.
        </Text>
      </Column>
      <Window title="zsh" dark x={164} y={186} width={364}>
        <Terminal gap={3}>
          <Prompt size={10.5}>artboards comments today.tsx</Prompt>
          <Line size={10.5}>
            #1  Today  <Span color={term.path}>today.tsx:8</Span>  {'<Button children="Add task">'}
          </Line>
          <Line size={10.5} color={term.dim}>
            {"    Make this button a bit taller?"}
          </Line>
          <Line size={10.5}>
            #2  Today  <Span color={term.path}>today.tsx:6</Span>  {'<Text "Today">'}
          </Line>
          <Line size={10.5} color={term.dim}>
            {"    Show today's date under the title."}
          </Line>
          <Line size={10.5}>2 comment(s). Mark one done with --resolve {"<id>"}.</Line>
        </Terminal>
      </Window>
    </FeaturePage>
  );
}

export function Agents() {
  return (
    <FeaturePage
      n={7}
      label="Agents"
      title="Made for your coding agent."
      body={
        <>
          One reference, <Code>artboards docs</Code>, and one loop: edit, lint, render, resolve. Paste a short block into{" "}
          <Code>AGENTS.md</Code> and your agent designs alongside you.
        </>
      }
    >
      <Window title="agent" dark x={0} y={6} width={440}>
        <Terminal gap={5}>
          <Line color={term.agent}>● Reading the DSL reference</Line>
          <Prompt>artboards docs</Prompt>
          <Line color={term.agent}>● Making Add task taller, as comment #1 asks</Line>
          <Prompt>artboards lint today.tsx</Prompt>
          <Line color={term.ok}>ok: no problems</Line>
          <Prompt>artboards render today.tsx -f Today -s 2</Prompt>
          <Line>
            out/today.Today.png  <Span color={term.dim}>390x844 @2x</Span>
          </Line>
          <Prompt>artboards comments today.tsx --resolve 1</Prompt>
          <Line color={term.ok}>Resolved comment #1.</Line>
        </Terminal>
      </Window>
      <Window title="AGENTS.md" x={236} y={296} width={292}>
        <Column width="fill" padding={[12, 16]} gap={5}>
          <Text fontFamily={font.mono} fontSize={12} fontWeight={700} color={color.ink}>
            ## Designing with artboards
          </Text>
          {["Run `artboards docs` first.", "Lint after every edit.", "Render to check your work.", "Resolve comments when done."].map((s) => (
            <Text key={s} fontFamily={font.mono} fontSize={12} color={color.muted}>
              - {s}
            </Text>
          ))}
        </Column>
      </Window>
    </FeaturePage>
  );
}

const GITHUB = "https://github.com/unixzii/artboards";

/** The GitHub mark. */
const GITHUB_MARK =
  "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12";

/** The last page. In Play mode the GitHub link opens the repository. */
export function GetStarted() {
  const { width, height } = PAGE;
  const cx = width / 2;
  return (
    <Frame width={width} height={height} fill={color.canvas} clip>
      <DotGrid width={width} height={height} />
      <GhostArtboard name="Today" kind="phone" x={cx - 470} y={330} width={220} height={440} />
      <GhostArtboard name="Settings" kind="desktop" x={cx + 300} y={-120} width={360} height={232} />

      <Column x={0} y={0} width="fill" height="fill" align="center" justify="center" gap={20}>
        <Text fontFamily={font.mono} fontSize={13} fontWeight={500} color={color.accent}>
          08 · Get started
        </Text>
        <Text fontFamily={font.display} fontSize={52} lineHeight={56} color={color.ink}>
          Start designing in a minute.
        </Text>
        <Column width={440} padding={[8, 0, 0, 0]}>
          <Window title="zsh" dark width={440} name="install">
            <Terminal gap={6}>
              <Prompt>npm install -g artboards-design</Prompt>
              <Prompt>artboards docs</Prompt>
              <Prompt>artboards dev design.tsx</Prompt>
              <Line>
                Viewer running at <Span color={term.path}>http://127.0.0.1:4400</Span>
              </Line>
            </Terminal>
          </Window>
        </Column>
        <Row name="GitHub" gap={8} align="center" onClick={() => globalThis.open?.(GITHUB, "_blank")}>
          <Path width={18} height={18} viewBox="0 0 24 24" d={GITHUB_MARK} fill={color.ink} />
          <Text fontSize={15} fontWeight={500} color={color.ink}>
            github.com/unixzii/artboards
          </Text>
        </Row>
      </Column>
    </Frame>
  );
}
