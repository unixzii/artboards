// Variants: named, enumerable states an artboard declares with `useVariant`.
// Each artboard gets its own store through context, so the same name in one
// artboard is one shared value and artboards never see each other's values.
// Platform-free: the CLI presets values before rendering, a viewer can set
// them later, and either way the artboard re-renders through React.

import { createContext, useCallback, useContext, useLayoutEffect, useSyncExternalStore } from "react";
import { DslError } from "./schema.ts";

export type VariantValue = string | number | boolean;

export interface VariantInfo {
  name: string;
  options: VariantValue[];
  initial: VariantValue;
  value: VariantValue;
}

interface Entry extends VariantInfo {
  /** Mounted `useVariant` calls; only rendered variants are listed. */
  refs: number;
  listeners: Set<() => void>;
}

const show = (v: VariantValue) => JSON.stringify(v);
const showAll = (options: readonly VariantValue[]) => options.map(show).join(" | ");

export class VariantStore {
  private entries = new Map<string, Entry>();
  /** Values given before rendering (e.g. `--variant name=value`), matched as `String(option)`. */
  private presets = new Map<string, string>();
  /** Values kept from an earlier store (the viewer across code edits); ignored once no longer an option. */
  private remembered = new Map<string, VariantValue>();
  /** Every name a render asked for, including declarations that threw. */
  private names = new Set<string>();

  constructor(presets: Iterable<[string, string]> = [], remembered: Iterable<[string, VariantValue]> = []) {
    for (const [name, raw] of presets) this.presets.set(name, raw);
    for (const [name, value] of remembered) this.remembered.set(name, value);
  }

  /** Registers a variant while rendering. Throws when it contradicts an earlier declaration. */
  declare(name: unknown, options: unknown, initial: unknown) {
    if (typeof name !== "string" || !name.trim()) throw new DslError("useVariant: the first argument must be the variant's name.");
    this.names.add(name);
    const call = `useVariant(${show(name)})`;
    if (!Array.isArray(options) || options.length === 0) throw new DslError(`${call}: options must be a non-empty array.`);
    const seen = new Set<string>();
    for (const o of options) {
      if (typeof o !== "string" && typeof o !== "number" && typeof o !== "boolean") {
        throw new DslError(`${call}: options must be strings, numbers or booleans, got ${JSON.stringify(o)}.`);
      }
      if (seen.has(String(o))) throw new DslError(`${call}: options must be distinct, got ${String(o)} twice.`);
      seen.add(String(o));
    }
    if (!options.some((o) => Object.is(o, initial))) {
      throw new DslError(`${call}: the initial value ${JSON.stringify(initial)} is not one of its options (${showAll(options)}).`);
    }

    const prev = this.entries.get(name);
    if (prev) {
      const same = prev.options.length === options.length && prev.options.every((o, i) => Object.is(o, options[i])) && Object.is(prev.initial, initial);
      if (!same) {
        throw new DslError(
          `${call} is declared twice in this artboard with different options or initial value: ` +
            `(${showAll(prev.options)}, initial ${show(prev.initial)}) and (${showAll(options)}, initial ${show(initial as VariantValue)}). ` +
            "Use one name per variant, or declare it the same way everywhere.",
        );
      }
      return;
    }

    let value = initial as VariantValue;
    const raw = this.presets.get(name);
    if (raw !== undefined) {
      const hit = options.find((o) => String(o) === raw);
      if (hit === undefined) throw new DslError(`Variant ${show(name)} has no option ${show(raw)}. Options: ${showAll(options)}.`);
      value = hit;
    } else if (this.remembered.has(name)) {
      const kept = this.remembered.get(name);
      if (options.some((o) => Object.is(o, kept))) value = kept as VariantValue;
    }
    this.entries.set(name, { name, options: [...options], initial: initial as VariantValue, value, refs: 0, listeners: new Set() });
  }

  get(name: string): VariantValue {
    const entry = this.entries.get(name);
    if (!entry) throw new DslError(`No variant named ${show(name)} in this artboard.`);
    return entry.value;
  }

  set(name: string, value: VariantValue) {
    const entry = this.entries.get(name);
    if (!entry) throw new DslError(`No variant named ${show(name)} in this artboard.`);
    if (!entry.options.some((o) => Object.is(o, value))) {
      throw new DslError(`Variant ${show(name)} has no option ${show(value)}. Options: ${showAll(entry.options)}.`);
    }
    if (Object.is(entry.value, value)) return;
    entry.value = value;
    for (const listener of entry.listeners) listener();
  }

  subscribe(name: string, listener: () => void): () => void {
    const listeners = this.entries.get(name)?.listeners;
    listeners?.add(listener);
    return () => listeners?.delete(listener);
  }

  /** Counts a mounted `useVariant` call; returns the matching release. */
  retain(name: string): () => void {
    const entry = this.entries.get(name);
    if (entry) entry.refs++;
    return () => {
      if (entry) entry.refs--;
    };
  }

  /** Variants currently rendered, in the order they were first declared. */
  list(): VariantInfo[] {
    return [...this.entries.values()].filter((e) => e.refs > 0).map(({ name, options, initial, value }) => ({ name, options, initial, value }));
  }

  /** Values that differ from their initial value, including variants not rendered right now. */
  overrides(): [string, VariantValue][] {
    return [...this.entries.values()].filter((e) => !Object.is(e.value, e.initial)).map((e) => [e.name, e.value]);
  }

  /** Whether any render of this artboard has declared the name, even if the declaration failed. */
  declares(name: string): boolean {
    return this.names.has(name);
  }

  /** Whether a variant of this name is currently rendered. */
  has(name: string): boolean {
    return (this.entries.get(name)?.refs ?? 0) > 0;
  }
}

/** The artboard's store. Provided by the reconciler around every artboard. */
export const VariantContext = createContext<VariantStore | null>(null);

/**
 * A named state of the artboard that reviewers can switch between. Returns
 * the current value and a setter, like useState. Calls with the same name in
 * one artboard share a value.
 */
export function useVariant<const T extends VariantValue>(name: string, options: readonly T[], initial: T = options?.[0]): [T, (value: T) => void] {
  const store = useContext(VariantContext);
  if (!store) throw new DslError("useVariant can only be called while an artboard renders.");
  store.declare(name, options, initial);
  const subscribe = useCallback((listener: () => void) => store.subscribe(name, listener), [store, name]);
  const value = useSyncExternalStore(subscribe, () => store.get(name)) as T;
  useLayoutEffect(() => store.retain(name), [store, name]);
  const set = useCallback((next: T) => store.set(name, next), [store, name]);
  return [value, set];
}
