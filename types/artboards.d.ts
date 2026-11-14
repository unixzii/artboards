// Generated from src/engine/dsl/schema.ts by `artboards types`. Do not edit.

declare module "artboards" {
  import type { ReactNode } from "react";
  export { useState, useEffect, useMemo, useRef, useCallback, Fragment } from "react";

  /** Fixed px, "fill" (take available space) or "hug" (fit content). */
  export type Size = number | "fill" | "hug";
  /** "#rgb", "#rrggbb", "#rrggbbaa", "rgb(...)" or "rgba(...)". */
  export type Color = string;
  /** A color, or a stop at a position 0..1 along the gradient (missing positions spread evenly). */
  export type GradientStop = Color | { color: Color; position?: number };
  export interface LinearGradient {
    type: "linear";
    /** CSS-style direction in degrees: 0 = to top, 90 = to right, 180 = to bottom. Default 180. */
    angle?: number;
    stops: GradientStop[];
  }
  export interface RadialGradient {
    type: "radial";
    /** Centre as fractions of the box. Default [0.5, 0.5]. */
    center?: [number, number];
    /** Radius as a fraction of the box size; an ellipse in a non-square box. Default 0.5. */
    radius?: number;
    stops: GradientStop[];
  }
  export type Gradient = LinearGradient | RadialGradient;
  /** A color or a gradient. */
  export type Fill = Color | Gradient;
  /** all | [vertical, horizontal] | [top, right, bottom, left] */
  export type Sides = number | [number, number] | [number, number, number, number];
  export type Padding = Sides;
  /** all | [topLeft, topRight, bottomRight, bottomLeft] */
  export type Corners = number | [number, number, number, number];
  /** A grid track: px, a `"1fr"`-style share of the free space, or `"hug"` (fit content). */
  export type Track = number | `${number}fr` | "hug";
  export interface Shadow {
    /** Horizontal offset in px. Default 0. */
    x?: number;
    /** Vertical offset in px. Default 0. */
    y?: number;
    /** Blur radius in px. Default 0. */
    blur?: number;
    /** Spread distance in px. Default 0. */
    spread?: number;
    /** Shadow color. Default "rgba(0, 0, 0, 0.25)". */
    color?: Color;
  }
  /** `[minX, minY, width, height]` or `"minX minY width height"`. */
  export type ViewBox = string | [number, number, number, number];
  export type TextContent = string | number | null | undefined | false;
  /** What importing an image file gives you. */
  export interface ImageAsset { readonly $asset: "image"; readonly id: string; readonly file: string }
  /** What importing a font file gives you; pass it to `defineFont`. */
  export interface FontAsset { readonly $asset: "font"; readonly id: string; readonly file: string }
  /** Bundled families, or a name declared with `defineFont`. */
  export type FontFamily = "Inter" | "Noto Sans SC" | "JetBrains Mono" | "Fraunces" | (string & {});
  export interface FontFaceSource {
    src: FontAsset;
    /** Weight this file provides. Default 400. */
    weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    /** Whether this file is the italic style. Default false. */
    italic?: boolean;
  }
  /**
   * Declares a font family from imported files and returns its name for `fontFamily`.
   * Characters the files lack fall back to the bundled fonts.
   * @example
   * import regular from "./fonts/Brand-Regular.woff2";
   * import bold from "./fonts/Brand-Bold.woff2";
   * const Brand = defineFont("Brand", [{ src: regular, weight: 400 }, { src: bold, weight: 700 }]);
   */
  export function defineFont(name: string, faces: FontAsset | FontFaceSource[]): string;

  export interface FrameProps {
    /** Fixed px, "fill" (take available space) or "hug" (fit content). Default "hug". */
    width?: Size;
    /** Fixed px, "fill" or "hug". Default "hug". */
    height?: Size;
    /** Lower bound on the width in px. */
    minWidth?: number;
    /** Upper bound on the width in px. */
    maxWidth?: number;
    /** Lower bound on the height in px. */
    minHeight?: number;
    /** Upper bound on the height in px. */
    maxHeight?: number;
    /** Share of the free space a `"fill"` child takes along its Row/Column, relative to its fill siblings. Default 1. */
    grow?: number;
    /** Overrides the parent's `align` for this child. */
    alignSelf?: "start" | "center" | "end" | "stretch";
    /** Take this child out of its Row/Column/Grid flow and place it with x/y/right/bottom, on top of the flow. Default false. */
    absolute?: boolean;
    /** Left offset in px from the parent's left edge. Applies inside a <Frame> or with `absolute`. Default 0. */
    x?: number;
    /** Top offset in px from the parent's top edge. Applies inside a <Frame> or with `absolute`. Default 0. */
    y?: number;
    /** Offset in px from the parent's right edge, instead of x. Applies inside a <Frame> or with `absolute`. */
    right?: number;
    /** Offset in px from the parent's bottom edge, instead of y. Applies inside a <Frame> or with `absolute`. */
    bottom?: number;
    /** Number of columns this child spans inside a <Grid>. Default 1. */
    colSpan?: number;
    /** Number of rows this child spans inside a <Grid>. Default 1. */
    rowSpan?: number;
    /** Opacity of the element and everything inside it, 0..1. Default 1. */
    opacity?: number;
    /** Clockwise rotation in degrees around the centre. Paint only: layout uses the unrotated box. Default 0. */
    rotation?: number;
    /** Layer name shown in inspect output and diagnostics. */
    name?: string;
    /** Background: a color or a gradient `{ type: "linear" | "radial", stops, ... }`. */
    fill?: Fill;
    /** Border color or gradient. */
    stroke?: Fill;
    /** Border width in px: all | [vertical, horizontal] | [top, right, bottom, left]. Default 1. */
    strokeWidth?: Sides;
    /** Where the border sits relative to the edge. Default "center". */
    strokeAlign?: "inside" | "center" | "outside";
    /** Dashed border: dash length, or `[dash, gap, ...]` in px. Needs a single strokeWidth. */
    strokeDash?: number | number[];
    /** Corner radius in px: all | [topLeft, topRight, bottomRight, bottomLeft]. Default 0. */
    cornerRadius?: Corners;
    /** Drop shadow or array of shadows: `{ x?, y?, blur?, spread?, color? }`. */
    shadow?: Shadow | Shadow[];
    /** Frosted-glass blur radius in px applied to content behind this element. Default 0. */
    backdropBlur?: number;
    /** Inner spacing: all | [vertical, horizontal] | [top, right, bottom, left]. Default 0. */
    padding?: Sides;
    /** Clip children to this element's bounds. Default false. */
    clip?: boolean;
    /** Child elements. */
    children?: ReactNode;
  }
  /** Free-form container. Children are positioned absolutely with x/y/right/bottom. Use as the artboard root (fixed width/height). */
  export function Frame(props: FrameProps): ReactNode;

  export interface RowProps {
    /** Fixed px, "fill" (take available space) or "hug" (fit content). Default "hug". */
    width?: Size;
    /** Fixed px, "fill" or "hug". Default "hug". */
    height?: Size;
    /** Lower bound on the width in px. */
    minWidth?: number;
    /** Upper bound on the width in px. */
    maxWidth?: number;
    /** Lower bound on the height in px. */
    minHeight?: number;
    /** Upper bound on the height in px. */
    maxHeight?: number;
    /** Share of the free space a `"fill"` child takes along its Row/Column, relative to its fill siblings. Default 1. */
    grow?: number;
    /** Overrides the parent's `align` for this child. */
    alignSelf?: "start" | "center" | "end" | "stretch";
    /** Take this child out of its Row/Column/Grid flow and place it with x/y/right/bottom, on top of the flow. Default false. */
    absolute?: boolean;
    /** Left offset in px from the parent's left edge. Applies inside a <Frame> or with `absolute`. Default 0. */
    x?: number;
    /** Top offset in px from the parent's top edge. Applies inside a <Frame> or with `absolute`. Default 0. */
    y?: number;
    /** Offset in px from the parent's right edge, instead of x. Applies inside a <Frame> or with `absolute`. */
    right?: number;
    /** Offset in px from the parent's bottom edge, instead of y. Applies inside a <Frame> or with `absolute`. */
    bottom?: number;
    /** Number of columns this child spans inside a <Grid>. Default 1. */
    colSpan?: number;
    /** Number of rows this child spans inside a <Grid>. Default 1. */
    rowSpan?: number;
    /** Opacity of the element and everything inside it, 0..1. Default 1. */
    opacity?: number;
    /** Clockwise rotation in degrees around the centre. Paint only: layout uses the unrotated box. Default 0. */
    rotation?: number;
    /** Layer name shown in inspect output and diagnostics. */
    name?: string;
    /** Background: a color or a gradient `{ type: "linear" | "radial", stops, ... }`. */
    fill?: Fill;
    /** Border color or gradient. */
    stroke?: Fill;
    /** Border width in px: all | [vertical, horizontal] | [top, right, bottom, left]. Default 1. */
    strokeWidth?: Sides;
    /** Where the border sits relative to the edge. Default "center". */
    strokeAlign?: "inside" | "center" | "outside";
    /** Dashed border: dash length, or `[dash, gap, ...]` in px. Needs a single strokeWidth. */
    strokeDash?: number | number[];
    /** Corner radius in px: all | [topLeft, topRight, bottomRight, bottomLeft]. Default 0. */
    cornerRadius?: Corners;
    /** Drop shadow or array of shadows: `{ x?, y?, blur?, spread?, color? }`. */
    shadow?: Shadow | Shadow[];
    /** Frosted-glass blur radius in px applied to content behind this element. Default 0. */
    backdropBlur?: number;
    /** Inner spacing: all | [vertical, horizontal] | [top, right, bottom, left]. Default 0. */
    padding?: Sides;
    /** Clip children to this element's bounds. Default false. */
    clip?: boolean;
    /** Child elements. */
    children?: ReactNode;
    /** Space between children in px. Default 0. */
    gap?: number;
    /** Cross-axis alignment of children. Default "start". */
    align?: "start" | "center" | "end" | "stretch";
    /** Main-axis distribution of children. Default "start". */
    justify?: "start" | "center" | "end" | "space-between" | "space-around" | "space-evenly";
    /** Wrap children onto new lines when they do not fit. Default false. */
    wrap?: boolean;
    /** Space between wrapped lines in px. Defaults to `gap`. */
    crossGap?: number;
  }
  /** Lays children out left to right. */
  export function Row(props: RowProps): ReactNode;

  export interface ColumnProps {
    /** Fixed px, "fill" (take available space) or "hug" (fit content). Default "hug". */
    width?: Size;
    /** Fixed px, "fill" or "hug". Default "hug". */
    height?: Size;
    /** Lower bound on the width in px. */
    minWidth?: number;
    /** Upper bound on the width in px. */
    maxWidth?: number;
    /** Lower bound on the height in px. */
    minHeight?: number;
    /** Upper bound on the height in px. */
    maxHeight?: number;
    /** Share of the free space a `"fill"` child takes along its Row/Column, relative to its fill siblings. Default 1. */
    grow?: number;
    /** Overrides the parent's `align` for this child. */
    alignSelf?: "start" | "center" | "end" | "stretch";
    /** Take this child out of its Row/Column/Grid flow and place it with x/y/right/bottom, on top of the flow. Default false. */
    absolute?: boolean;
    /** Left offset in px from the parent's left edge. Applies inside a <Frame> or with `absolute`. Default 0. */
    x?: number;
    /** Top offset in px from the parent's top edge. Applies inside a <Frame> or with `absolute`. Default 0. */
    y?: number;
    /** Offset in px from the parent's right edge, instead of x. Applies inside a <Frame> or with `absolute`. */
    right?: number;
    /** Offset in px from the parent's bottom edge, instead of y. Applies inside a <Frame> or with `absolute`. */
    bottom?: number;
    /** Number of columns this child spans inside a <Grid>. Default 1. */
    colSpan?: number;
    /** Number of rows this child spans inside a <Grid>. Default 1. */
    rowSpan?: number;
    /** Opacity of the element and everything inside it, 0..1. Default 1. */
    opacity?: number;
    /** Clockwise rotation in degrees around the centre. Paint only: layout uses the unrotated box. Default 0. */
    rotation?: number;
    /** Layer name shown in inspect output and diagnostics. */
    name?: string;
    /** Background: a color or a gradient `{ type: "linear" | "radial", stops, ... }`. */
    fill?: Fill;
    /** Border color or gradient. */
    stroke?: Fill;
    /** Border width in px: all | [vertical, horizontal] | [top, right, bottom, left]. Default 1. */
    strokeWidth?: Sides;
    /** Where the border sits relative to the edge. Default "center". */
    strokeAlign?: "inside" | "center" | "outside";
    /** Dashed border: dash length, or `[dash, gap, ...]` in px. Needs a single strokeWidth. */
    strokeDash?: number | number[];
    /** Corner radius in px: all | [topLeft, topRight, bottomRight, bottomLeft]. Default 0. */
    cornerRadius?: Corners;
    /** Drop shadow or array of shadows: `{ x?, y?, blur?, spread?, color? }`. */
    shadow?: Shadow | Shadow[];
    /** Frosted-glass blur radius in px applied to content behind this element. Default 0. */
    backdropBlur?: number;
    /** Inner spacing: all | [vertical, horizontal] | [top, right, bottom, left]. Default 0. */
    padding?: Sides;
    /** Clip children to this element's bounds. Default false. */
    clip?: boolean;
    /** Child elements. */
    children?: ReactNode;
    /** Space between children in px. Default 0. */
    gap?: number;
    /** Cross-axis alignment of children. Default "start". */
    align?: "start" | "center" | "end" | "stretch";
    /** Main-axis distribution of children. Default "start". */
    justify?: "start" | "center" | "end" | "space-between" | "space-around" | "space-evenly";
    /** Wrap children onto new lines when they do not fit. Default false. */
    wrap?: boolean;
    /** Space between wrapped lines in px. Defaults to `gap`. */
    crossGap?: number;
  }
  /** Lays children out top to bottom. */
  export function Column(props: ColumnProps): ReactNode;

  export interface GridProps {
    /** Fixed px, "fill" (take available space) or "hug" (fit content). Default "hug". */
    width?: Size;
    /** Fixed px, "fill" or "hug". Default "hug". */
    height?: Size;
    /** Lower bound on the width in px. */
    minWidth?: number;
    /** Upper bound on the width in px. */
    maxWidth?: number;
    /** Lower bound on the height in px. */
    minHeight?: number;
    /** Upper bound on the height in px. */
    maxHeight?: number;
    /** Share of the free space a `"fill"` child takes along its Row/Column, relative to its fill siblings. Default 1. */
    grow?: number;
    /** Overrides the parent's `align` for this child. */
    alignSelf?: "start" | "center" | "end" | "stretch";
    /** Take this child out of its Row/Column/Grid flow and place it with x/y/right/bottom, on top of the flow. Default false. */
    absolute?: boolean;
    /** Left offset in px from the parent's left edge. Applies inside a <Frame> or with `absolute`. Default 0. */
    x?: number;
    /** Top offset in px from the parent's top edge. Applies inside a <Frame> or with `absolute`. Default 0. */
    y?: number;
    /** Offset in px from the parent's right edge, instead of x. Applies inside a <Frame> or with `absolute`. */
    right?: number;
    /** Offset in px from the parent's bottom edge, instead of y. Applies inside a <Frame> or with `absolute`. */
    bottom?: number;
    /** Number of columns this child spans inside a <Grid>. Default 1. */
    colSpan?: number;
    /** Number of rows this child spans inside a <Grid>. Default 1. */
    rowSpan?: number;
    /** Opacity of the element and everything inside it, 0..1. Default 1. */
    opacity?: number;
    /** Clockwise rotation in degrees around the centre. Paint only: layout uses the unrotated box. Default 0. */
    rotation?: number;
    /** Layer name shown in inspect output and diagnostics. */
    name?: string;
    /** Background: a color or a gradient `{ type: "linear" | "radial", stops, ... }`. */
    fill?: Fill;
    /** Border color or gradient. */
    stroke?: Fill;
    /** Border width in px: all | [vertical, horizontal] | [top, right, bottom, left]. Default 1. */
    strokeWidth?: Sides;
    /** Where the border sits relative to the edge. Default "center". */
    strokeAlign?: "inside" | "center" | "outside";
    /** Dashed border: dash length, or `[dash, gap, ...]` in px. Needs a single strokeWidth. */
    strokeDash?: number | number[];
    /** Corner radius in px: all | [topLeft, topRight, bottomRight, bottomLeft]. Default 0. */
    cornerRadius?: Corners;
    /** Drop shadow or array of shadows: `{ x?, y?, blur?, spread?, color? }`. */
    shadow?: Shadow | Shadow[];
    /** Frosted-glass blur radius in px applied to content behind this element. Default 0. */
    backdropBlur?: number;
    /** Inner spacing: all | [vertical, horizontal] | [top, right, bottom, left]. Default 0. */
    padding?: Sides;
    /** Clip children to this element's bounds. Default false. */
    clip?: boolean;
    /** Child elements. */
    children?: ReactNode;
    /** Column count (equal widths), or one entry per column: px, `"1fr"`-style share of the free space, or `"hug"`. */
    columns: number | Track[];
    /** Row tracks, same forms as `columns`. Rows hug their content by default. */
    rows?: number | Track[];
    /** Space between cells in px. Default 0. */
    gap?: number;
    /** Space between columns in px. Defaults to `gap`. */
    columnGap?: number;
    /** Space between rows in px. Defaults to `gap`. */
    rowGap?: number;
    /** Vertical alignment of children within their cells. Default "stretch". */
    align?: "start" | "center" | "end" | "stretch";
    /** Horizontal alignment of children within their cells. Default "stretch". */
    justify?: "start" | "center" | "end" | "stretch";
  }
  /** Lays children out in cells, left to right then top to bottom. Children stretch to fill their cell unless sized; use `colSpan`/`rowSpan` to span cells. */
  export function Grid(props: GridProps): ReactNode;

  export interface TextProps {
    /** Fixed px, "fill" (take available space) or "hug" (fit content). Default "hug". */
    width?: Size;
    /** Fixed px, "fill" or "hug". Default "hug". */
    height?: Size;
    /** Lower bound on the width in px. */
    minWidth?: number;
    /** Upper bound on the width in px. */
    maxWidth?: number;
    /** Lower bound on the height in px. */
    minHeight?: number;
    /** Upper bound on the height in px. */
    maxHeight?: number;
    /** Share of the free space a `"fill"` child takes along its Row/Column, relative to its fill siblings. Default 1. */
    grow?: number;
    /** Overrides the parent's `align` for this child. */
    alignSelf?: "start" | "center" | "end" | "stretch";
    /** Take this child out of its Row/Column/Grid flow and place it with x/y/right/bottom, on top of the flow. Default false. */
    absolute?: boolean;
    /** Left offset in px from the parent's left edge. Applies inside a <Frame> or with `absolute`. Default 0. */
    x?: number;
    /** Top offset in px from the parent's top edge. Applies inside a <Frame> or with `absolute`. Default 0. */
    y?: number;
    /** Offset in px from the parent's right edge, instead of x. Applies inside a <Frame> or with `absolute`. */
    right?: number;
    /** Offset in px from the parent's bottom edge, instead of y. Applies inside a <Frame> or with `absolute`. */
    bottom?: number;
    /** Number of columns this child spans inside a <Grid>. Default 1. */
    colSpan?: number;
    /** Number of rows this child spans inside a <Grid>. Default 1. */
    rowSpan?: number;
    /** Opacity of the element and everything inside it, 0..1. Default 1. */
    opacity?: number;
    /** Clockwise rotation in degrees around the centre. Paint only: layout uses the unrotated box. Default 0. */
    rotation?: number;
    /** Layer name shown in inspect output and diagnostics. */
    name?: string;
    /** Text color. Default #000000. */
    color?: Color;
    /** Font size in px. Default 14. */
    fontSize?: number;
    /** Font weight. Default 400. */
    fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    /** A bundled family or one declared with `defineFont`. Default "Inter". */
    fontFamily?: FontFamily;
    /** Italic style; slanted synthetically where a font has no italic (e.g. CJK). Default false. */
    italic?: boolean;
    /** Extra space between characters in px. Default 0. */
    letterSpacing?: number;
    /** Line drawn with the text. Default "none". */
    textDecoration?: "none" | "underline" | "line-through";
    /** Equal-width digits, so numbers line up in columns. Default false. */
    tabularNums?: boolean;
    /** Line height in px. Defaults to the font's natural line height (about 1.2x fontSize). */
    lineHeight?: number;
    /** Horizontal alignment of lines within the text box. Default "left". */
    textAlign?: "left" | "center" | "right";
    /** Cut the text after this many lines and end it with an ellipsis. */
    maxLines?: number;
    /** Drop shadow or array of shadows: `{ x?, y?, blur?, spread?, color? }`. */
    shadow?: Shadow | Shadow[];
    /** The text: strings, numbers and <Span> elements. */
    children?: ReactNode;
  }
  /** Text. Hugs its content on one line by default; set width (px or "fill") to make it wrap. Children are strings, numbers and <Span>s. */
  export function Text(props: TextProps): ReactNode;

  export interface SpanProps {
    /** Text color. Default #000000. */
    color?: Color;
    /** Font size in px. Default 14. */
    fontSize?: number;
    /** Font weight. Default 400. */
    fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    /** A bundled family or one declared with `defineFont`. Default "Inter". */
    fontFamily?: FontFamily;
    /** Italic style; slanted synthetically where a font has no italic (e.g. CJK). Default false. */
    italic?: boolean;
    /** Extra space between characters in px. Default 0. */
    letterSpacing?: number;
    /** Line drawn with the text. Default "none". */
    textDecoration?: "none" | "underline" | "line-through";
    /** Equal-width digits, so numbers line up in columns. Default false. */
    tabularNums?: boolean;
    /** The text: strings and numbers only. */
    children?: TextContent | TextContent[];
  }
  /** A styled run inside a <Text>, e.g. `<Text>Total <Span fontWeight={700}>¥28</Span></Text>`. Inherits the Text's style and overrides what it sets. Not a layer: it has no box. */
  export function Span(props: SpanProps): ReactNode;

  export interface RectProps {
    /** Fixed px, "fill" (take available space) or "hug" (fit content). Default "hug". */
    width?: Size;
    /** Fixed px, "fill" or "hug". Default "hug". */
    height?: Size;
    /** Lower bound on the width in px. */
    minWidth?: number;
    /** Upper bound on the width in px. */
    maxWidth?: number;
    /** Lower bound on the height in px. */
    minHeight?: number;
    /** Upper bound on the height in px. */
    maxHeight?: number;
    /** Share of the free space a `"fill"` child takes along its Row/Column, relative to its fill siblings. Default 1. */
    grow?: number;
    /** Overrides the parent's `align` for this child. */
    alignSelf?: "start" | "center" | "end" | "stretch";
    /** Take this child out of its Row/Column/Grid flow and place it with x/y/right/bottom, on top of the flow. Default false. */
    absolute?: boolean;
    /** Left offset in px from the parent's left edge. Applies inside a <Frame> or with `absolute`. Default 0. */
    x?: number;
    /** Top offset in px from the parent's top edge. Applies inside a <Frame> or with `absolute`. Default 0. */
    y?: number;
    /** Offset in px from the parent's right edge, instead of x. Applies inside a <Frame> or with `absolute`. */
    right?: number;
    /** Offset in px from the parent's bottom edge, instead of y. Applies inside a <Frame> or with `absolute`. */
    bottom?: number;
    /** Number of columns this child spans inside a <Grid>. Default 1. */
    colSpan?: number;
    /** Number of rows this child spans inside a <Grid>. Default 1. */
    rowSpan?: number;
    /** Opacity of the element and everything inside it, 0..1. Default 1. */
    opacity?: number;
    /** Clockwise rotation in degrees around the centre. Paint only: layout uses the unrotated box. Default 0. */
    rotation?: number;
    /** Layer name shown in inspect output and diagnostics. */
    name?: string;
    /** Background: a color or a gradient `{ type: "linear" | "radial", stops, ... }`. */
    fill?: Fill;
    /** Border color or gradient. */
    stroke?: Fill;
    /** Border width in px: all | [vertical, horizontal] | [top, right, bottom, left]. Default 1. */
    strokeWidth?: Sides;
    /** Where the border sits relative to the edge. Default "center". */
    strokeAlign?: "inside" | "center" | "outside";
    /** Dashed border: dash length, or `[dash, gap, ...]` in px. Needs a single strokeWidth. */
    strokeDash?: number | number[];
    /** Corner radius in px: all | [topLeft, topRight, bottomRight, bottomLeft]. Default 0. */
    cornerRadius?: Corners;
    /** Drop shadow or array of shadows: `{ x?, y?, blur?, spread?, color? }`. */
    shadow?: Shadow | Shadow[];
    /** Frosted-glass blur radius in px applied to content behind this element. Default 0. */
    backdropBlur?: number;
  }
  /** Rectangle. Has no content, so give it a size. */
  export function Rect(props: RectProps): ReactNode;

  export interface EllipseProps {
    /** Fixed px, "fill" (take available space) or "hug" (fit content). Default "hug". */
    width?: Size;
    /** Fixed px, "fill" or "hug". Default "hug". */
    height?: Size;
    /** Lower bound on the width in px. */
    minWidth?: number;
    /** Upper bound on the width in px. */
    maxWidth?: number;
    /** Lower bound on the height in px. */
    minHeight?: number;
    /** Upper bound on the height in px. */
    maxHeight?: number;
    /** Share of the free space a `"fill"` child takes along its Row/Column, relative to its fill siblings. Default 1. */
    grow?: number;
    /** Overrides the parent's `align` for this child. */
    alignSelf?: "start" | "center" | "end" | "stretch";
    /** Take this child out of its Row/Column/Grid flow and place it with x/y/right/bottom, on top of the flow. Default false. */
    absolute?: boolean;
    /** Left offset in px from the parent's left edge. Applies inside a <Frame> or with `absolute`. Default 0. */
    x?: number;
    /** Top offset in px from the parent's top edge. Applies inside a <Frame> or with `absolute`. Default 0. */
    y?: number;
    /** Offset in px from the parent's right edge, instead of x. Applies inside a <Frame> or with `absolute`. */
    right?: number;
    /** Offset in px from the parent's bottom edge, instead of y. Applies inside a <Frame> or with `absolute`. */
    bottom?: number;
    /** Number of columns this child spans inside a <Grid>. Default 1. */
    colSpan?: number;
    /** Number of rows this child spans inside a <Grid>. Default 1. */
    rowSpan?: number;
    /** Opacity of the element and everything inside it, 0..1. Default 1. */
    opacity?: number;
    /** Clockwise rotation in degrees around the centre. Paint only: layout uses the unrotated box. Default 0. */
    rotation?: number;
    /** Layer name shown in inspect output and diagnostics. */
    name?: string;
    /** Background: a color or a gradient `{ type: "linear" | "radial", stops, ... }`. */
    fill?: Fill;
    /** Border color or gradient. */
    stroke?: Fill;
    /** Border width in px. Default 1. */
    strokeWidth?: number;
    /** Where the border sits relative to the edge. Default "center". */
    strokeAlign?: "inside" | "center" | "outside";
    /** Dashed border: dash length, or `[dash, gap, ...]` in px. Needs a single strokeWidth. */
    strokeDash?: number | number[];
    /** Drop shadow or array of shadows: `{ x?, y?, blur?, spread?, color? }`. */
    shadow?: Shadow | Shadow[];
    /** Frosted-glass blur radius in px applied to content behind this element. Default 0. */
    backdropBlur?: number;
  }
  /** Ellipse inscribed in its box. Equal width and height make a circle. */
  export function Ellipse(props: EllipseProps): ReactNode;

  export interface ImageProps {
    /** Fixed px, "fill" (take available space) or "hug" (fit content). Default "hug". */
    width?: Size;
    /** Fixed px, "fill" or "hug". Default "hug". */
    height?: Size;
    /** Lower bound on the width in px. */
    minWidth?: number;
    /** Upper bound on the width in px. */
    maxWidth?: number;
    /** Lower bound on the height in px. */
    minHeight?: number;
    /** Upper bound on the height in px. */
    maxHeight?: number;
    /** Share of the free space a `"fill"` child takes along its Row/Column, relative to its fill siblings. Default 1. */
    grow?: number;
    /** Overrides the parent's `align` for this child. */
    alignSelf?: "start" | "center" | "end" | "stretch";
    /** Take this child out of its Row/Column/Grid flow and place it with x/y/right/bottom, on top of the flow. Default false. */
    absolute?: boolean;
    /** Left offset in px from the parent's left edge. Applies inside a <Frame> or with `absolute`. Default 0. */
    x?: number;
    /** Top offset in px from the parent's top edge. Applies inside a <Frame> or with `absolute`. Default 0. */
    y?: number;
    /** Offset in px from the parent's right edge, instead of x. Applies inside a <Frame> or with `absolute`. */
    right?: number;
    /** Offset in px from the parent's bottom edge, instead of y. Applies inside a <Frame> or with `absolute`. */
    bottom?: number;
    /** Number of columns this child spans inside a <Grid>. Default 1. */
    colSpan?: number;
    /** Number of rows this child spans inside a <Grid>. Default 1. */
    rowSpan?: number;
    /** Opacity of the element and everything inside it, 0..1. Default 1. */
    opacity?: number;
    /** Clockwise rotation in degrees around the centre. Paint only: layout uses the unrotated box. Default 0. */
    rotation?: number;
    /** Layer name shown in inspect output and diagnostics. */
    name?: string;
    /** An imported .png, .jpg, .webp or .gif file. */
    src?: ImageAsset;
    /** How the image fills its box: crop to cover, letterbox to contain, or stretch. Default "cover". */
    fit?: "cover" | "contain" | "fill";
    /** Background behind the image (visible with fit="contain" or a transparent image). */
    fill?: Fill;
    /** Border color or gradient. */
    stroke?: Fill;
    /** Border width in px: all | [vertical, horizontal] | [top, right, bottom, left]. Default 1. */
    strokeWidth?: Sides;
    /** Where the border sits relative to the edge. Default "center". */
    strokeAlign?: "inside" | "center" | "outside";
    /** Dashed border: dash length, or `[dash, gap, ...]` in px. Needs a single strokeWidth. */
    strokeDash?: number | number[];
    /** Corner radius in px: all | [topLeft, topRight, bottomRight, bottomLeft]. Default 0. */
    cornerRadius?: Corners;
    /** Drop shadow or array of shadows: `{ x?, y?, blur?, spread?, color? }`. */
    shadow?: Shadow | Shadow[];
    /** Frosted-glass blur radius in px applied to content behind this element. Default 0. */
    backdropBlur?: number;
  }
  /** Bitmap image imported from a file: `import photo from "./photo.jpg"` then `<Image src={photo} width={120} />`. Keeps its aspect ratio when only one side is set. Without `src` it draws a placeholder. */
  export function Image(props: ImageProps): ReactNode;

  export interface PathProps {
    /** Fixed px, "fill" (take available space) or "hug" (fit content). Default "hug". */
    width?: Size;
    /** Fixed px, "fill" or "hug". Default "hug". */
    height?: Size;
    /** Lower bound on the width in px. */
    minWidth?: number;
    /** Upper bound on the width in px. */
    maxWidth?: number;
    /** Lower bound on the height in px. */
    minHeight?: number;
    /** Upper bound on the height in px. */
    maxHeight?: number;
    /** Share of the free space a `"fill"` child takes along its Row/Column, relative to its fill siblings. Default 1. */
    grow?: number;
    /** Overrides the parent's `align` for this child. */
    alignSelf?: "start" | "center" | "end" | "stretch";
    /** Take this child out of its Row/Column/Grid flow and place it with x/y/right/bottom, on top of the flow. Default false. */
    absolute?: boolean;
    /** Left offset in px from the parent's left edge. Applies inside a <Frame> or with `absolute`. Default 0. */
    x?: number;
    /** Top offset in px from the parent's top edge. Applies inside a <Frame> or with `absolute`. Default 0. */
    y?: number;
    /** Offset in px from the parent's right edge, instead of x. Applies inside a <Frame> or with `absolute`. */
    right?: number;
    /** Offset in px from the parent's bottom edge, instead of y. Applies inside a <Frame> or with `absolute`. */
    bottom?: number;
    /** Number of columns this child spans inside a <Grid>. Default 1. */
    colSpan?: number;
    /** Number of rows this child spans inside a <Grid>. Default 1. */
    rowSpan?: number;
    /** Opacity of the element and everything inside it, 0..1. Default 1. */
    opacity?: number;
    /** Clockwise rotation in degrees around the centre. Paint only: layout uses the unrotated box. Default 0. */
    rotation?: number;
    /** Layer name shown in inspect output and diagnostics. */
    name?: string;
    /** SVG path data string (e.g. `"M 4 12 L 10 18 L 20 6"`). */
    d: string;
    /** Coordinate system `[minX, minY, width, height]` or `"minX minY width height"` mapped into the box. */
    viewBox?: ViewBox;
    /** Background: a color or a gradient `{ type: "linear" | "radial", stops, ... }`. */
    fill?: Fill;
    /** Border color or gradient. */
    stroke?: Fill;
    /** Stroke width in px. Default 1. */
    strokeWidth?: number;
    /** Line cap style for open subpaths. Default "butt". */
    strokeCap?: "butt" | "round" | "square";
    /** Corner join style for stroked vertices. Default "miter". */
    strokeJoin?: "miter" | "round" | "bevel";
    /** Dashed border: dash length, or `[dash, gap, ...]` in px. Needs a single strokeWidth. */
    strokeDash?: number | number[];
    /** Interior winding rule when `fill` is set. Default "nonzero". */
    fillRule?: "nonzero" | "evenodd";
    /** Drop shadow or array of shadows: `{ x?, y?, blur?, spread?, color? }`. */
    shadow?: Shadow | Shadow[];
    /** Frosted-glass blur radius in px applied to content behind this element. Default 0. */
    backdropBlur?: number;
  }
  /** SVG vector path. Set `viewBox` to scale path coordinates into `width`/`height`, or omit `viewBox` to draw in local px (hugging bounds by default). Draws `fill` and/or `stroke` when specified. Also the way to draw icons: paste the icon's path data with `viewBox="0 0 24 24"`. */
  export function Path(props: PathProps): ReactNode;
}

declare module "artboards/jsx-runtime" {
  import type { Key, ReactNode } from "react";
  export namespace JSX {
    type Element = ReactNode;
    type ElementType = (props: any) => ReactNode;
    interface ElementChildrenAttribute { children: {} }
    interface IntrinsicAttributes { key?: Key | null }
    // No lowercase tags: there is no DOM.
    interface IntrinsicElements {}
  }
}

declare module "*.png" {
  const asset: import("artboards").ImageAsset;
  export default asset;
}

declare module "*.jpg" {
  const asset: import("artboards").ImageAsset;
  export default asset;
}

declare module "*.jpeg" {
  const asset: import("artboards").ImageAsset;
  export default asset;
}

declare module "*.webp" {
  const asset: import("artboards").ImageAsset;
  export default asset;
}

declare module "*.gif" {
  const asset: import("artboards").ImageAsset;
  export default asset;
}

declare module "*.woff2" {
  const asset: import("artboards").FontAsset;
  export default asset;
}

declare module "*.ttf" {
  const asset: import("artboards").FontAsset;
  export default asset;
}

declare module "*.otf" {
  const asset: import("artboards").FontAsset;
  export default asset;
}
