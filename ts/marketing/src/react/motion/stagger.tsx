import { motion, type HTMLMotionProps } from "motion/react";

import { DUR, EASE, RISE, STAGGER, VIEWPORT } from "../../core/motion-tokens";
import { INSTANT_MOVE, useReduceMotion } from "./reduced-motion";

export interface StaggerProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  /** Seconds before the first child moves. */
  delay?: number;
  /** Seconds between siblings. Default {@link STAGGER}. */
  step?: number;
  /** Animate on mount rather than on scroll (above-the-fold groups). */
  onMount?: boolean;
}

/**
 * Container for a row/grid whose children arrive one after another. Wrap each
 * child in {@link StaggerItem}; anything else in the subtree is untouched.
 *
 * The states are *named* variants rather than a hand-computed `delay` per
 * child, which is what lets the parent own the rhythm: reorder or add a card
 * and the cascade still reads correctly, with no delay arithmetic to keep in
 * sync.
 */
export function Stagger({
  delay = 0,
  step = STAGGER,
  onMount = false,
  children,
  ...props
}: StaggerProps) {
  return (
    <motion.div
      initial="hidden"
      {...(onMount
        ? { animate: "shown" }
        : { whileInView: "shown", viewport: VIEWPORT })}
      variants={{
        hidden: {},
        shown: { transition: { staggerChildren: step, delayChildren: delay } },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export interface StaggerItemProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  /** Travel distance in px. Default {@link RISE}. */
  distance?: number;
}

/**
 * One member of a {@link Stagger}. Timing comes from the parent, never here.
 * Under `prefers-reduced-motion` it still fades in sequence, without the rise.
 */
export function StaggerItem({
  distance = RISE,
  children,
  ...props
}: StaggerItemProps) {
  const reduce = useReduceMotion();
  return (
    <motion.div
      variants={{
        // Offset kept under reduce so the markup matches the server's;
        // the rise is made instant instead (see ./reduced-motion).
        hidden: { opacity: 0, y: distance },
        shown: {
          opacity: 1,
          y: 0,
          transition: {
            duration: DUR.slow,
            ease: EASE.out,
            ...(reduce ? INSTANT_MOVE : {}),
          },
        },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
