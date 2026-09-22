import { motion, type HTMLMotionProps } from "motion/react";

import { DUR, EASE, RISE, SETTLE_OPACITY } from "../../core/motion-tokens";
import { useReduceMotion } from "./reduced-motion";

export interface SettleProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  /** Seconds. Default {@link DUR.base} — shorter than a reveal on purpose. */
  duration?: number;
}

/**
 * The opposite of a `Reveal`: the element is *already there* on first paint
 * and merely settles into place — a half-rise from {@link SETTLE_OPACITY} to
 * full, with no delay. For a control that must be usable and LCP-eligible from
 * the first frame (a hero's CTA row) but should still join the section's
 * opening beat rather than sit frozen while the headline assembles around it.
 *
 * Under `prefers-reduced-motion` there is nothing to arrive, so it renders at
 * rest: no fade, no movement. This is the one primitive that does not collapse
 * to a fade — its content never left.
 */
export function Settle({ duration = DUR.base, children, ...props }: SettleProps) {
  const reduce = useReduceMotion();
  const shown = { opacity: 1, y: 0 };
  const hidden = reduce ? shown : { opacity: SETTLE_OPACITY, y: RISE / 2 };

  return (
    <motion.div
      initial={hidden}
      animate={shown}
      transition={{ duration, ease: EASE.out }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
