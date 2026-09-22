import { useEffect, useMemo, useRef } from "react";
import { animate, useInView } from "motion/react";

import { DUR, EASE, VIEWPORT_Y } from "../../core/motion-tokens";
import { useReduceMotion } from "./reduced-motion";

export interface CountUpProps {
  /** The figure the counter settles on. Also the SSR / no-JS rendering. */
  value: number;
  /** BCP-47 tag driving the decimal mark and grouping — "16.4" vs "16,4". */
  locale: string;
  /** Fixed fraction digits, so the width never jitters mid-count. */
  decimals?: number;
  /** Rendered verbatim before the digits (e.g. "$", "×"). */
  prefix?: string;
  /** Rendered verbatim after the digits (e.g. "%", "M"). */
  suffix?: string;
  /** Seconds. Default {@link DUR.slow} — a count is a reveal, not a loader. */
  duration?: number;
  /** Seconds to wait after the figure scrolls into view. */
  delay?: number;
  className?: string;
}

/**
 * A figure that counts up to its value when it scrolls into view.
 *
 * ## Why the digits are written imperatively
 *
 * Storing the running number in React state re-renders the subtree ~60 times a
 * second for the length of the count. Writing `textContent` on one node from
 * `animate`'s frame loop keeps the work off React entirely — one text mutation
 * per frame no matter what surrounds it.
 *
 * ## Why it renders the FINAL value on the server
 *
 * The markup a crawler (and a reader with JS off) receives must be the real
 * figure, never a zero — "0 interventions" in the indexed HTML is strictly
 * worse than no animation. So server output and first client render agree on
 * the formatted value (no hydration mismatch), and only after mount does the
 * effect reset the node and hand it to `animate`. Place counters below the
 * fold: above it, the final value shows for one frame before the reset.
 *
 * Under `prefers-reduced-motion` the figure simply stands at its value.
 */
export function CountUp({
  value,
  locale,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = DUR.slow,
  delay = 0,
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReduceMotion();
  // VIEWPORT_Y, not VIEWPORT: a counter is a short inline span, and the
  // horizontal inset can push one near a screen edge out of the root entirely.
  const inView = useInView(ref, VIEWPORT_Y);

  // One formatter per (locale, decimals) pair rather than one per frame:
  // constructing an Intl.NumberFormat is the expensive half of formatting.
  const format = useMemo(() => {
    const nf = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return (n: number) => `${prefix}${nf.format(n)}${suffix}`;
  }, [locale, decimals, prefix, suffix]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce) {
      node.textContent = format(value);
      return;
    }
    if (!inView) {
      node.textContent = format(0);
      return;
    }
    const controls = animate(0, value, {
      duration,
      delay,
      ease: EASE.out,
      onUpdate: n => {
        node.textContent = format(n);
      },
    });
    return () => controls.stop();
  }, [inView, reduce, value, format, duration, delay]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
