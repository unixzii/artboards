// The sample app the website's pages show being designed: "Today", a small
// task list. Drawn at any width; every size is in units of width / 200.
// Pass the handlers to make it work in the viewer's Play mode.

import type { ReactNode } from "react";
import { Column, Ellipse, Path, Rect, Row, Text } from "artboards";
import { color } from "./tokens.ts";

export type PhoneState = "Tasks" | "Empty" | "Loading";

export type Task = { text: string; done: boolean };

export const TASKS: Task[] = [
  { text: "Review onboarding", done: true },
  { text: "Reply to feedback", done: false },
  { text: "Prepare the demo", done: false },
];

type Place = { x?: number; y?: number; right?: number; bottom?: number };

/**
 * The app on a phone. `title` and `button` are drawn over the title and the
 * Add task button (selection boxes, comment pins); `overlay` covers the screen.
 */
export function Phone(
  props: Place & {
    width?: number;
    state?: PhoneState;
    tasks?: Task[];
    /** Called with a task's index when it is clicked. */
    onToggle?: (index: number) => void;
    /** Called when Add task is clicked. */
    onAdd?: () => void;
    title?: ReactNode;
    button?: ReactNode;
    overlay?: ReactNode;
    name?: string;
  },
) {
  const { width = 200, state = "Tasks", tasks = TASKS, onToggle, onAdd, title, button, overlay, name = "phone", ...place } = props;
  const u = width / 200;
  return (
    <Column
      name={name}
      absolute
      {...place}
      width={width}
      height={width * 2}
      fill={color.surface}
      stroke={color.line}
      cornerRadius={28 * u}
      padding={[30 * u, 16 * u, 18 * u, 16 * u]}
      gap={14 * u}
      align="stretch"
      clip
      shadow={[
        { y: 1, blur: 2, color: "rgba(24, 24, 27, 0.05)" },
        { y: 16, blur: 40, color: "rgba(24, 24, 27, 0.10)" },
      ]}
    >
      {state === "Loading" ? <LoadingBody u={u} /> : <Header u={u} state={state} tasks={tasks} decoration={title} />}
      {state === "Tasks" ? <TaskList u={u} tasks={tasks} onToggle={onToggle} /> : null}
      {state === "Empty" ? <EmptyBody u={u} /> : null}
      {state === "Tasks" ? null : <Rect name="spacer" width="fill" height="fill" />}
      {state === "Loading" ? (
        <Rect width="fill" height={36 * u} fill={color.skeleton} cornerRadius={18 * u} />
      ) : (
        <Row name="Add task" width="fill" height={36 * u} align="center" justify="center" fill={color.accent} cornerRadius={18 * u} onClick={onAdd}>
          <Text fontSize={12.5 * u} fontWeight={600} color="#ffffff">
            Add task
          </Text>
          {button}
        </Row>
      )}
      {overlay}
    </Column>
  );
}

function Header({ u, state, tasks, decoration }: { u: number; state: PhoneState; tasks: Task[]; decoration?: ReactNode }) {
  const left = tasks.filter((t) => !t.done).length;
  return (
    <Column gap={3 * u}>
      <Row name="title">
        <Text fontSize={24 * u} fontWeight={700} color={color.ink} letterSpacing={-0.4 * u}>
          Today
        </Text>
        {decoration}
      </Row>
      <Text fontSize={11.5 * u} color={color.muted}>
        {state === "Empty" || left === 0 ? "Nothing left" : `${left} of ${tasks.length} left`}
      </Text>
    </Column>
  );
}

/** The tasks, filling the space above the button and scrolling once they outgrow it. */
function TaskList({ u, tasks, onToggle }: { u: number; tasks: Task[]; onToggle?: (index: number) => void }) {
  return (
    <Column name="tasks" height="fill" gap={8 * u} align="stretch" scroll="vertical">
      {tasks.map((t, i) => (
        <Row
          key={`${i}-${t.text}`}
          height={38 * u}
          padding={[0, 11 * u]}
          gap={9 * u}
          align="center"
          fill="#f6f6f7"
          cornerRadius={10 * u}
          onClick={onToggle ? () => onToggle(i) : undefined}
        >
          {t.done ? (
            <Row width={16 * u} height={16 * u} align="center" justify="center" fill={color.accent} cornerRadius={8 * u}>
              <Path width={10 * u} height={10 * u} viewBox="0 0 24 24" d="M5 12.5 L10 17.5 L19 7" stroke="#ffffff" strokeWidth={3.5} strokeCap="round" strokeJoin="round" />
            </Row>
          ) : (
            <Ellipse width={16 * u} height={16 * u} stroke="#c4c4c8" strokeWidth={1.5 * u} />
          )}
          <Text fontSize={12 * u} color={t.done ? color.mutedStrong : color.ink} textDecoration={t.done ? "line-through" : "none"} maxLines={1} width="fill">
            {t.text}
          </Text>
        </Row>
      ))}
    </Column>
  );
}

function EmptyBody({ u }: { u: number }) {
  return (
    <Column width="fill" padding={[36 * u, 0, 0, 0]} gap={8 * u} align="center">
      <Row width={56 * u} height={56 * u} align="center" justify="center" fill={color.accentSoft} cornerRadius={28 * u}>
        <Path width={26 * u} height={26 * u} viewBox="0 0 24 24" d="M5 12.5 L10 17.5 L19 7" stroke={color.accent} strokeWidth={2.5} strokeCap="round" strokeJoin="round" />
      </Row>
      <Text fontSize={15 * u} fontWeight={600} color={color.ink}>
        All clear
      </Text>
      <Text fontSize={11.5 * u} color={color.muted}>
        Enjoy the rest of your day.
      </Text>
    </Column>
  );
}

function LoadingBody({ u }: { u: number }) {
  const bar = (w: number | "fill", h: number) => <Rect width={w} height={h * u} fill={color.skeleton} cornerRadius={(h / 2) * u} />;
  return (
    <Column gap={14 * u} align="stretch">
      <Column gap={7 * u}>
        {bar(84 * u, 22)}
        {bar(60 * u, 10)}
      </Column>
      {[0, 1, 2].map((i) => (
        <Rect key={i} width="fill" height={38 * u} fill={color.skeleton} cornerRadius={10 * u} />
      ))}
    </Column>
  );
}

/**
 * The bottom sheet Add task opens, drawn over the screen as `overlay`.
 * `onAdd` runs on Add, `onClose` on a click outside the sheet.
 */
export function NewTaskSheet({ width = 200, text = "Write release notes", onAdd, onClose }: { width?: number; text?: string; onAdd?: () => void; onClose?: () => void }) {
  const u = width / 200;
  return (
    <>
      <Rect name="scrim" absolute x={0} y={0} right={0} bottom={0} fill="rgba(24, 24, 27, 0.32)" onClick={onClose} />
      <Column
        name="sheet"
        absolute
        x={0}
        right={0}
        bottom={0}
        padding={[10 * u, 16 * u, 18 * u, 16 * u]}
        gap={12 * u}
        align="stretch"
        fill={color.surface}
        cornerRadius={[20 * u, 20 * u, 0, 0]}
        onClick={() => {}} // a click on the sheet itself does not reach the scrim
      >
        <Rect alignSelf="center" width={32 * u} height={4 * u} fill="#d4d4d8" cornerRadius={2 * u} />
        <Text fontSize={15 * u} fontWeight={700} color={color.ink}>
          New task
        </Text>
        <Row height={36 * u} padding={[0, 11 * u]} gap={2 * u} align="center" stroke={color.accent} strokeWidth={1.5 * u} cornerRadius={9 * u}>
          <Text fontSize={12 * u} color={color.ink}>
            {text}
          </Text>
          <Rect width={1.5 * u} height={15 * u} fill={color.accent} />
        </Row>
        <Row name="Add" height={36 * u} align="center" justify="center" fill={color.accent} cornerRadius={18 * u} onClick={onAdd}>
          <Text fontSize={12.5 * u} fontWeight={600} color="#ffffff">
            Add
          </Text>
        </Row>
      </Column>
    </>
  );
}
