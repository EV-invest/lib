/**
 * `@evinvest/marketing/motion` — the motion primitives on `motion` (peer), a
 * `"use client"` entry of their own.
 *
 * Import them from here rather than from `./react` in app code: this is the
 * specifier `withMotionEngine(config, "css")` (`@evinvest/marketing/next`)
 * swaps for `./motion-css`, which renders the same names with no JavaScript.
 * The `./react` barrel keeps re-exporting them for existing call sites, but a
 * barrel import cannot be swapped and brings `motion` with anything else it
 * serves.
 */

export { Reveal, type RevealFrom, type RevealProps } from "../react/motion/reveal";
export { Settle, type SettleProps } from "../react/motion/settle";
export { Stagger, StaggerItem, type StaggerItemProps, type StaggerProps } from "../react/motion/stagger";
export { SplitText, type SplitTextProps } from "../react/motion/split-text";
export { CountUp, type CountUpProps } from "../react/motion/count-up";
export { useReduceMotion } from "../react/motion/reduced-motion";
