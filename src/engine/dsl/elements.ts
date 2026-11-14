// The public "artboards" module: what DSL files import at runtime.
// Primitives are host element types (plain strings). Their props are defined in
// schema.ts, which also generates the type declarations agents check against.

export { useState, useEffect, useMemo, useRef, useCallback, Fragment } from "react";

export const Frame = "Frame";
export const Row = "Row";
export const Column = "Column";
export const Text = "Text";
export const Rect = "Rect";
export const Ellipse = "Ellipse";

export type { Padding } from "../../shared/scene.ts";
