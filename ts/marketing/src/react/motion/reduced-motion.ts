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
 */
export function useReduceMotion(): boolean {
  const os = useReducedMotion();
  const { reducedMotion } = useContext(MotionConfigContext);
  return reducedMotion === "always" || os === true;
}
