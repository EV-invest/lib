import { motion, type HTMLMotionProps } from "motion/react";

import { DUR, EASE, RISE, VIEWPORT } from "../../core/motion-tokens";
import { INSTANT_MOVE, useReduceMotion } from "./reduced-motion";

/** Where the element travels *from*. `none` is a pure fade. */
export type RevealFrom = "up" | "down" | "left" | "right" | "none";

export interface RevealProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  /** Stagger offset in seconds when revealing a row/grid by hand. */
  delay?: number;
  /** Travel direction. Default `up` (element rises into place). */
  from?: RevealFrom;
  /** Travel distance in px. Default {@link RISE}. */
  distance?: number;
  /** Seconds. Default {@link DUR.slow}. */
  duration?: number;
  /**
   * Animate on mount instead of on scroll. Use above the fold, where
   * `whileInView` would fire in the same frame anyway but still costs an
   * IntersectionObserver.
   */
  onMount?: boolean;
}

function offset(from: RevealFrom, distance: number) {
  switch (from) {
    case "up":
      return { y: distance };
    case "down":
      return { y: -distance };
    case "left":
      return { x: distance };
    case "right":
      return { x: -distance };
    case "none":
      return {};
  }
}

/**
 * A restrained scroll reveal: a short fade plus a 16px rise, once, triggered
 * just before the element is fully in view. Under `prefers-reduced-motion` it
 * collapses to a plain fade — never to nothing, because the content still has
 * to arrive.
 *
 * Only `opacity` and `transform` are animated, so every frame stays on the
 * compositor. Never wrap a `position: fixed` descendant in a moving reveal: an
 * animated transform makes this element its containing block. Use
 * `from="none"` there.
 */
export function Reveal({
  delay = 0,
  from = "up",
  distance = RISE,
  duration = DUR.slow,
  onMount = false,
  children,
  ...props
}: RevealProps) {
  const reduce = useReduceMotion();
  // The offset stays in `initial` either way — see the hydration rule in
  // ./reduced-motion; reduce only makes the travel instant.
  const hidden = { opacity: 0, ...offset(from, distance) };
  const shown = { opacity: 1, x: 0, y: 0 };

  return (
    <motion.div
      initial={hidden}
      {...(onMount
        ? { animate: shown }
        : { whileInView: shown, viewport: VIEWPORT })}
      transition={{
        duration,
        ease: EASE.out,
        delay,
        ...(reduce ? INSTANT_MOVE : {}),
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
