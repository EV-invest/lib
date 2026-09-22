import { useContext } from "react";
import { MotionConfigContext, useReducedMotion } from "motion/react";

/**
 * Whether movement should collapse to a fade: the OS preference, or a
 * `<MotionConfig reducedMotion="always">` above (an app-level switch, or a
 * visual test forcing the reduced path without faking a media query).
 *
 * Not `useReducedMotionConfig` alone: `MotionConfig`'s default is `"never"`,
 * so with no provider it ignores the OS preference — exactly the reader this
 * exists for. The flip side is deliberate too: `reducedMotion="never"` cannot
 * force movement on a reader who asked the OS for less.
 *
 * ## The hydration rule every primitive follows
 *
 * The server cannot see the media query, so it always renders as if motion
 * were allowed, while the hydrating client already knows. Anything this value
 * changes must therefore stay OUT of the markup: no different tree, no
 * different `initial` (motion writes `initial` into the `style` attribute).
 * It may only change what never reaches the DOM — `transition`, variant
 * targets, stagger timing. The primitives keep the travel offset in `initial`
 * and, under reduce, animate `x`/`y` with {@link INSTANT_MOVE}: the element is
 * still transparent when it snaps into place, so the reader sees a pure fade.
 */
export function useReduceMotion(): boolean {
  const os = useReducedMotion();
  const { reducedMotion } = useContext(MotionConfigContext);
  return reducedMotion === "always" || os === true;
}

/** Per-value transition that snaps the travel instead of animating it. */
export const INSTANT_MOVE = {
  x: { duration: 0 },
  y: { duration: 0 },
} as const;
