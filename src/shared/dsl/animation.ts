// Motion: a per-artboard animation clock, `useAnimationTime` reading it, and
// `useSpring` built on top. Time is virtual and owned by the host: the viewer
// advances it in Play mode; everywhere else (CLI, the viewer outside Play) the
// clock stands still and springs report their target, so static output is the
// state after every animation has settled.

import { createContext, useContext, useRef, useSyncExternalStore } from "react";
import { DslError } from "./schema.ts";

export class AnimationClock {
  private time = 0;
  /** Bumped on every change, so subscribers re-render even when time itself stood still. */
  private version = 0;
  private listeners = new Set<() => void>();
  /** Whether time advances. A stopped clock settles every spring. */
  running = false;

  /** Milliseconds of animation time since the clock was created. */
  readonly now = () => this.time;

  /** Changes whenever subscribers should re-render. */
  readonly snapshot = () => this.version;

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Springs subscribe here: they tick like any reader, and also count as motion that has yet to settle. */
  private springs = new Set<() => void>();
  readonly subscribeSpring = (listener: () => void) => {
    const unsubscribe = this.subscribe(listener);
    this.springs.add(listener);
    return () => {
      unsubscribe();
      this.springs.delete(listener);
    };
  };

  /** Whether anything renders from the clock and needs ticks. */
  get active(): boolean {
    return this.listeners.size > 0;
  }

  /** Whether a spring is still moving. Loops reading `useAnimationTime` never settle and don't count. */
  get moving(): boolean {
    return this.springs.size > 0;
  }

  /** Moves time forward and re-renders everything reading it. */
  advance(ms: number) {
    if (!this.running || ms <= 0) return;
    this.time += ms;
    this.notify();
  }

  /** Starts or stops time. Stopping re-renders subscribers so in-flight springs settle. */
  setRunning(running: boolean) {
    if (this.running === running) return;
    this.running = running;
    this.notify();
  }

  private notify() {
    this.version++;
    for (const listener of [...this.listeners]) listener();
  }
}

/** The artboard's clock. Provided by the host around every artboard. */
export const AnimationContext = createContext<AnimationClock | null>(null);

/** Used when no host provides a clock: never runs. */
const STILL = new AnimationClock();

const noSubscribe = () => () => {};
const zero = () => 0;

/**
 * Milliseconds since the calling component mounted, re-rendering it on every
 * animation frame in the viewer's Play mode. Outside Play mode and in the CLI
 * time stands still. `active = false` reads the time without re-rendering on
 * every frame.
 */
export function useAnimationTime(active: boolean = true): number {
  return useTicks(active, false);
}

function useTicks(active: boolean, spring: boolean): number {
  const clock = useContext(AnimationContext) ?? STILL;
  const mounted = useRef<number | null>(null);
  if (mounted.current === null) mounted.current = clock.now();
  const subscribe = !active ? noSubscribe : spring ? clock.subscribeSpring : clock.subscribe;
  useSyncExternalStore(subscribe, active ? clock.snapshot : zero);
  return clock.now() - mounted.current;
}

// ------------------------------------------------------------------- springs

export interface SpringOptions {
  /** Perceived duration in ms: roughly how long the motion takes. Default 500. */
  duration?: number;
  /** -1..1. 0 is critically damped (no overshoot); higher overshoots and bounces; below 0 is sluggish. Default 0. */
  bounce?: number;
  /** Value on mount, sprung to `target` straight away. Default `target`. */
  from?: number;
}

/** One stretch of motion towards a fixed target, solved in closed form. */
interface Segment {
  /** Clock time it started (ms). */
  t0: number;
  /** Displacement from the target at t0. */
  x0: number;
  /** Velocity at t0, per second. */
  v0: number;
  target: number;
}

const REST_DELTA = 1e-3;
const REST_SPEED = 1e-2;

/** Displacement from the target `s` seconds into a segment of a unit-mass spring. */
function displacement(x0: number, v0: number, omega: number, zeta: number, s: number): number {
  if (zeta < 1) {
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    return Math.exp(-zeta * omega * s) * (x0 * Math.cos(wd * s) + ((v0 + zeta * omega * x0) / wd) * Math.sin(wd * s));
  }
  if (zeta === 1) return Math.exp(-omega * s) * (x0 + (v0 + omega * x0) * s);
  const root = Math.sqrt(zeta * zeta - 1);
  const r1 = -omega * (zeta - root);
  const r2 = -omega * (zeta + root);
  const c2 = (v0 - r1 * x0) / (r2 - r1);
  return (x0 - c2) * Math.exp(r1 * s) + c2 * Math.exp(r2 * s);
}

/** Natural frequency and damping ratio for a perceptual duration and bounce, as in SwiftUI. */
function springParams(duration: number, bounce: number) {
  const omega = (2 * Math.PI) / (duration / 1000);
  const zeta = bounce >= 0 ? 1 - bounce : 1 / (1 + bounce);
  return { omega, zeta };
}

function sample(seg: Segment, now: number, omega: number, zeta: number) {
  const s = Math.max(0, now - seg.t0) / 1000;
  const h = 1e-4;
  const x = displacement(seg.x0, seg.v0, omega, zeta, s);
  const v = (displacement(seg.x0, seg.v0, omega, zeta, s + h) - displacement(seg.x0, seg.v0, omega, zeta, Math.max(0, s - h))) / (s > h ? 2 * h : h + s);
  return { value: seg.target + x, velocity: v, settled: Math.abs(x) < REST_DELTA && Math.abs(v) < REST_SPEED };
}

function checkOption(name: string, value: unknown, ok: (n: number) => boolean, want: string) {
  if (value !== undefined && !(typeof value === "number" && Number.isFinite(value) && ok(value))) {
    throw new DslError(`useSpring: \`${name}\` must be ${want}, got ${JSON.stringify(value)}.`);
  }
}

/**
 * A value that follows `target` with spring physics. Whenever `target`
 * changes, it moves from where it is, keeping its velocity, so interrupted
 * motion stays smooth. A spring can follow another spring's value (a chain)
 * for staggered, follow-through motion.
 */
export function useSpring(target: number, options: SpringOptions = {}): number {
  if (typeof target !== "number" || !Number.isFinite(target)) {
    throw new DslError(`useSpring: the target must be a finite number, got ${JSON.stringify(target)}.`);
  }
  const { duration = 500, bounce = 0, from } = options;
  checkOption("duration", duration, (n) => n > 0, "a duration in ms greater than 0");
  checkOption("bounce", bounce, (n) => n > -1 && n < 1, "a number between -1 and 1 (exclusive)");
  checkOption("from", from, () => true, "a finite number");

  const clock = useContext(AnimationContext) ?? STILL;
  const now = clock.now();
  const { omega, zeta } = springParams(duration, bounce);
  const seg = useRef<Segment | null>(null);
  if (!clock.running) {
    // Time stands still: show where the motion ends.
    seg.current = { t0: now, x0: 0, v0: 0, target };
  } else if (!seg.current) {
    seg.current = { t0: now, x0: (from ?? target) - target, v0: 0, target };
  } else if (seg.current.target !== target) {
    const at = sample(seg.current, now, omega, zeta);
    seg.current = { t0: now, x0: at.value - target, v0: at.velocity, target };
  }
  const at = sample(seg.current, now, omega, zeta);
  // Ticks only while moving; a settled spring re-renders when its target changes.
  useTicks(!at.settled, true);
  return at.settled ? target : at.value;
}
