# Artboards DSL

A design file is a JSX/TSX module. Every exported component of the file you pass to the CLI is an
artboard and must return a single root element, normally a <Frame> with a fixed width and height.
Components that are not exported are reusable pieces. Props are plain function arguments.
Split larger designs across files with relative imports (`import { Button } from "./components.jsx"`).
Run `artboards lint <file>` after every edit; it type-checks, renders and reports layout problems.

```jsx
import { Column, Frame, Row, Text } from "artboards";

export default function Home() {
  return (
    <Frame width={390} height={844} fill="#ffffff">
      <Column width="fill" height="fill" padding={16} gap={12} align="stretch">
        <Text fontSize={24} fontWeight={700}>Title</Text>
        <Row height={44} padding={[0, 12]} align="center" justify="space-between" fill="#f3f4f6" cornerRadius={8}>
          <Text>Label</Text>
        </Row>
      </Column>
    </Frame>
  );
}
```

The full API is at the end, as TypeScript declarations. The sections before it cover what the types
cannot say.

## Sizing

- `"fill"` along a Row/Column's main axis shares the remaining space with other fill siblings, in proportion
  to `grow`; across it, the element stretches. In a Grid cell it stretches to the cell.
  Inside a <Frame> (or with `absolute`), fill spans the parent minus the x/right (y/bottom) offsets;
  setting both x and right (or y and bottom) without a size does the same.
- Fixed and hug elements never shrink. If they do not fit, they overflow and `lint` reports it.
- There is no margin and no CSS. Use `gap` and `padding` on the parent.

## Positioning and layering

- Children of <Row>/<Column>/<Grid> are placed by their parent. Children of <Frame> are placed by `x`/`y`
  (or `right`/`bottom`) against the frame's outer edges.
- `absolute` takes a child of Row/Column/Grid out of the flow and places it the same way, e.g. a badge:
  `<Ellipse absolute right={-4} y={-4} width={10} height={10} fill="#ef4444" />`.
- Later siblings paint on top of earlier ones. Put overlays (sheets, toasts, badges) last.
- `rotation` and `opacity` only affect painting, never layout.

## Paint

- Gradients: `fill={{ type: "linear", angle: 135, stops: ["#f97316", "#db2777"] }}`,
  `{ type: "radial", center: [0.3, 0.2], radius: 0.8, stops: [...] }`. A stop can be `{ color, position }`.
- A bottom sheet: `cornerRadius={[20, 20, 0, 0]}`. A bottom border only: `stroke="#e5e7eb" strokeWidth={[0, 0, 1, 0]}`.
- Figma's inner shadow is `shadow={{ y: 1, blur: 2, color: "rgba(0,0,0,0.12)", inset: true }}`; mix drop and inset
  shadows in one array. Text takes drop shadows only.
- `blur={12}` applies a 12px Gaussian blur to the layer and its descendants without changing layout.
  When used with `mask`, the mask clips the blurred result. Use `backdropBlur` for content behind the layer.

## Masks

Pass JSX as `mask` on a layer. The mask's alpha sets how much of the layer and its descendants
show through: opaque pixels keep the original paint, transparent pixels hide it, and partial alpha
fades it. The mask's colors don't tint the result.

```tsx
<Image
  src={photo}
  width={240}
  height={160}
  mask={<Ellipse width="fill" height="fill" fill="#fff" />}
/>
```

Give a shape a `fill` to reveal its interior. You can also use a gradient, image with transparency,
text, or a component. Mask JSX is positioned like the children of a `Frame` the size of the target:
`x` and `y` are local to the target and `"fill"` spans its bounds. The mask takes no space in layout
and doesn't contribute to the target's `"hug"` size. Use `null`, `undefined`, or `false` to turn it off.

## Text

- Mix styles in one paragraph with <Span>: `<Text fontSize={14}>¥<Span fontSize={28} fontWeight={700}>28</Span></Text>`.
- `maxLines` truncates with an ellipsis; give the Text a width.
- `letterSpacing` takes Figma's percentage as written: `letterSpacing="-1.1%"` (of the font size; `"-0.011em"` is the same).
- `fontWeight` takes any number from 1 to 1000, e.g. SF Pro's 510 and 590. A variable font draws it exactly;
  a static family uses its nearest weight.
- Bundled families: {{fontFamilies}}. Inter and Noto Sans SC also cover characters other families lack.

## Images and fonts

Import files next to the design and use the imported value:

```jsx
import { Image, Text, defineFont } from "artboards";
import latte from "./assets/latte.jpg";
import display from "./fonts/Display-Bold.woff2";

const Display = defineFont("Display", [{ src: display, weight: 700 }]);

// <Image src={latte} width={160} fit="cover" cornerRadius={12} />
// <Text fontFamily={Display} fontWeight={700}>Menu</Text>
```

Images: {{imageExts}}. Fonts: {{fontExts}}. A variable font is one file for every weight; it draws any
`fontWeight` exactly and follows `fontSize` on its optical-size axis, as Figma does. For a .ttc collection, pick
each font with `index`: `defineFont("Optima", [{ src: optima }, { src: optima, index: 1 }, { src: optima, index: 2, italic: true }])`.
There are no remote URLs: download a file into the project first. There is no icon element: draw icons
with <Path d="..." viewBox="0 0 24 24" />.

## State

`useState`, `useEffect`, `useMemo`, `useRef`, `useCallback` and `Fragment` are exported from "artboards"
and behave as in React.

Visual states a reviewer should be able to switch between (loading / empty / error, the step of a
flow, a selected tab) are variants. Declare them in the artboard with `useVariant` and pass the
value down as props:

```tsx
export function OrderTracking() {
  const [step] = useVariant("Step", [0, 1, 2, 3], 1); // name, options, initial (default: first option)
  return <Phone><Steps current={step} /></Phone>;
}
```

Options are strings, numbers or booleans. Calls with the same name in one artboard share one value
and must declare the same options. Render another state with `--variant Step=2` (repeatable) on
`render`, `inspect` and `lint`; `inspect` lists each artboard's variants. In the viewer, select an
artboard to switch its variants in the Properties panel.

## Interaction

Any layer element takes `onClick`, `onMouseDown`, `onMouseMove`, and `onMouseUp`. They run in the
viewer's Play mode (P); the innermost layer with a matching handler under the pointer wins. Each handler
receives `event: MouseEvent` (`{ x, y, pressed }`), where `x` and `y` are in the handler layer's own
local coordinates (before rotation and scrolling) and `pressed` tells whether the primary mouse button
is held down. While dragging after a press on an interactive layer, `onMouseMove` and `onMouseUp` stay
captured by that layer even if the pointer moves outside its bounds.

Screenshots, `inspect` and `lint` always show the initial state. Keep states that matter for review in
a variant so they can be picked without interacting and rendered from the CLI:

```tsx
const [tab, setTab] = useVariant("Tab", ["Orders", "Favourites"]);
<Text onClick={() => setTab("Favourites")}>Favourites</Text>
```

Use `useState` with pointer events for transient or continuous UI interactions such as sliders, XY pads,
pressed button feedback, or hover scrubbers:

```tsx
const [value, setValue] = useState(0.4);
const update = (x: number) => setValue(Math.max(0, Math.min(1, x / 200)));
<Frame width={200} height={24} onMouseDown={(e) => update(e.x)} onMouseMove={(e) => e.pressed && update(e.x)}>
  <Rect y={10} width="fill" height={4} cornerRadius={2} fill="#e4e4e7" />
  <Rect y={10} width={Math.max(4, value * 200)} height={4} cornerRadius={2} fill="#2563eb" />
</Frame>
```

A long list goes in a container with `scroll="vertical"` (or `"horizontal"`, `"both"`) and a fixed or
`"fill"` size; it clips its content, and reviewers scroll it in Play mode with the wheel or by dragging.
Scrolling is the viewer's own state: components never see it, and screenshots show the start.

## Commands

- `artboards lint <file> [--variant name=value]` — type-check, render every artboard, and report layout problems. Run after every edit.
- `artboards render <file> [--frame Name] [--variant name=value] [--scale 2] [-o out.png] [--transparent]` — PNG screenshots
  (default: `out/`), on white unless `--transparent`.
- `artboards inspect <file> [--frame Name] [--variant name=value] [--json]` — layer tree with computed bounds, source lines and variants.
- `artboards comments <file>` — open review comments from a human, with the source line of each layer.
  After addressing one, run `artboards comments <file> --resolve <id>`.
- `artboards dev <file>` — start the viewer a human uses to review and comment (long-running).
- `artboards build <file> [-o dir]` — write the viewer and the design as a static site (default: `out/<file>/`),
  for reviewers without the CLI. Their comments stay in their browser until they export them; add an exported
  file with `artboards comments <file> --import <name>.comments.json`.

## Not in the DSL

Names from HTML, CSS, SVG or React Native that do not exist here, and what to use instead:

{{unsupported}}

## API

```ts
{{api}}
```
