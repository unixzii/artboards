// Generated from src/schema.ts by `artboards types`. Do not edit.

declare module "artboards" {
  import type { ReactNode } from "react";
  export { useState, useEffect, useMemo, useRef, useCallback, Fragment } from "react";

  /** Fixed px, "fill" (take available space) or "hug" (fit content). */
  export type Size = number | "fill" | "hug";
  /** "#rgb", "#rrggbb", "#rrggbbaa", "rgb(...)" or "rgba(...)". */
  export type Color = string;
  /** all | [vertical, horizontal] | [top, right, bottom, left] */
  export type Padding = number | [number, number] | [number, number, number, number];
  export type TextContent = string | number | null | undefined | false;

  export interface FrameProps {
    /** Fixed px, "fill" (take available space) or "hug" (fit content). Default "hug". */
    width?: Size;
    /** Fixed px, "fill" or "hug". Default "hug". */
    height?: Size;
    /** Left offset in px. Only applies when the parent is a <Frame>. Default 0. */
    x?: number;
    /** Top offset in px. Only applies when the parent is a <Frame>. Default 0. */
    y?: number;
    /** Layer name shown in inspect output and diagnostics. */
    name?: string;
    /** Background color. */
    fill?: Color;
    /** Border color. */
    stroke?: Color;
    /** Border width in px. Default 1. */
    strokeWidth?: number;
    /** Corner radius in px. Default 0. */
    cornerRadius?: number;
    /** Inner spacing: all | [vertical, horizontal] | [top, right, bottom, left]. Default 0. */
    padding?: Padding;
    /** Clip children to this element's bounds. Default false. */
    clip?: boolean;
    /** Child elements. */
    children?: ReactNode;
  }
  /** Free-form container. Children are positioned absolutely with x/y. Use as the artboard root (fixed width/height). */
  export function Frame(props: FrameProps): ReactNode;

  export interface RowProps {
    /** Fixed px, "fill" (take available space) or "hug" (fit content). Default "hug". */
    width?: Size;
    /** Fixed px, "fill" or "hug". Default "hug". */
    height?: Size;
    /** Left offset in px. Only applies when the parent is a <Frame>. Default 0. */
    x?: number;
    /** Top offset in px. Only applies when the parent is a <Frame>. Default 0. */
    y?: number;
    /** Layer name shown in inspect output and diagnostics. */
    name?: string;
    /** Background color. */
    fill?: Color;
    /** Border color. */
    stroke?: Color;
    /** Border width in px. Default 1. */
    strokeWidth?: number;
    /** Corner radius in px. Default 0. */
    cornerRadius?: number;
    /** Inner spacing: all | [vertical, horizontal] | [top, right, bottom, left]. Default 0. */
    padding?: Padding;
    /** Clip children to this element's bounds. Default false. */
    clip?: boolean;
    /** Child elements. */
    children?: ReactNode;
    /** Space between children in px. Default 0. */
    gap?: number;
    /** Cross-axis alignment of children. Default "start". */
    align?: "start" | "center" | "end" | "stretch";
    /** Main-axis distribution of children. Default "start". */
    justify?: "start" | "center" | "end" | "space-between";
  }
  /** Lays children out left to right. */
  export function Row(props: RowProps): ReactNode;

  export interface ColumnProps {
    /** Fixed px, "fill" (take available space) or "hug" (fit content). Default "hug". */
    width?: Size;
    /** Fixed px, "fill" or "hug". Default "hug". */
    height?: Size;
    /** Left offset in px. Only applies when the parent is a <Frame>. Default 0. */
    x?: number;
    /** Top offset in px. Only applies when the parent is a <Frame>. Default 0. */
    y?: number;
    /** Layer name shown in inspect output and diagnostics. */
    name?: string;
    /** Background color. */
    fill?: Color;
    /** Border color. */
    stroke?: Color;
    /** Border width in px. Default 1. */
    strokeWidth?: number;
    /** Corner radius in px. Default 0. */
    cornerRadius?: number;
    /** Inner spacing: all | [vertical, horizontal] | [top, right, bottom, left]. Default 0. */
    padding?: Padding;
    /** Clip children to this element's bounds. Default false. */
    clip?: boolean;
    /** Child elements. */
    children?: ReactNode;
    /** Space between children in px. Default 0. */
    gap?: number;
    /** Cross-axis alignment of children. Default "start". */
    align?: "start" | "center" | "end" | "stretch";
    /** Main-axis distribution of children. Default "start". */
    justify?: "start" | "center" | "end" | "space-between";
  }
  /** Lays children out top to bottom. */
  export function Column(props: ColumnProps): ReactNode;

  export interface TextProps {
    /** Fixed px, "fill" (take available space) or "hug" (fit content). Default "hug". */
    width?: Size;
    /** Fixed px, "fill" or "hug". Default "hug". */
    height?: Size;
    /** Left offset in px. Only applies when the parent is a <Frame>. Default 0. */
    x?: number;
    /** Top offset in px. Only applies when the parent is a <Frame>. Default 0. */
    y?: number;
    /** Layer name shown in inspect output and diagnostics. */
    name?: string;
    /** Text color. Default #000000. */
    color?: Color;
    /** Font size in px. Default 14. */
    fontSize?: number;
    /** Font weight. Default 400. */
    fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    /** Line height in px. Defaults to the font's natural line height (about 1.2x fontSize). */
    lineHeight?: number;
    /** Horizontal alignment of lines within the text box. Default "left". */
    textAlign?: "left" | "center" | "right";
    /** The text: strings and numbers only. */
    children?: TextContent | TextContent[];
  }
  /** Text. Hugs its content on one line by default; set width (px or "fill") to make it wrap. */
  export function Text(props: TextProps): ReactNode;

  export interface RectProps {
    /** Fixed px, "fill" (take available space) or "hug" (fit content). Default "hug". */
    width?: Size;
    /** Fixed px, "fill" or "hug". Default "hug". */
    height?: Size;
    /** Left offset in px. Only applies when the parent is a <Frame>. Default 0. */
    x?: number;
    /** Top offset in px. Only applies when the parent is a <Frame>. Default 0. */
    y?: number;
    /** Layer name shown in inspect output and diagnostics. */
    name?: string;
    /** Background color. */
    fill?: Color;
    /** Border color. */
    stroke?: Color;
    /** Border width in px. Default 1. */
    strokeWidth?: number;
    /** Corner radius in px. Default 0. */
    cornerRadius?: number;
  }
  /** Rectangle. Has no content, so give it a size. */
  export function Rect(props: RectProps): ReactNode;

  export interface EllipseProps {
    /** Fixed px, "fill" (take available space) or "hug" (fit content). Default "hug". */
    width?: Size;
    /** Fixed px, "fill" or "hug". Default "hug". */
    height?: Size;
    /** Left offset in px. Only applies when the parent is a <Frame>. Default 0. */
    x?: number;
    /** Top offset in px. Only applies when the parent is a <Frame>. Default 0. */
    y?: number;
    /** Layer name shown in inspect output and diagnostics. */
    name?: string;
    /** Background color. */
    fill?: Color;
    /** Border color. */
    stroke?: Color;
    /** Border width in px. Default 1. */
    strokeWidth?: number;
  }
  /** Ellipse inscribed in its box. Equal width and height make a circle. */
  export function Ellipse(props: EllipseProps): ReactNode;
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
