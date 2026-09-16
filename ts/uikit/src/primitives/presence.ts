import * as React from "react";
import { flushSync } from "react-dom";

// Safety net for a missed exit `animationend` (display:none ancestor, tab
// hidden, animations disabled by a stylesheet after the check). Well past the
// longest exit in tw-animate-css.
const EXIT_FALLBACK_MS = 1000;

/**
 * Keeps an overlay mounted through its exit animation. Enter animations
 * (`data-[state=open]:animate-in`) play on mount; once `present` turns false
 * the consumer flips the node to `data-state="closed"` in the same render and
 * the node stays until its exit animation ends (or the fallback timer fires).
 * Re-opening mid-exit just flips the state back; the node is never remounted.
 *
 * The exit was dropped once (5728b40) because closing flickered: tw-animate's
 * `animate-out` runs with `animation-fill-mode: none`, so after `animationend`
 * the node snaps back to full opacity/scale for the frame React needs to
 * process an async unmount. Hence `flushSync` inside the native listener —
 * the unmount commits before the browser paints that frame (Radix Presence
 * does the same). With no animation on the node (jsdom, overlays without an
 * exit class) unmount is immediate, as before. The Rust mirror still does not
 * defer unmount.
 *
 * Pass `ref` to the animated node — the one carrying `data-state`.
 */
export function usePresence(present: boolean): {
  isPresent: boolean;
  ref: React.RefObject<HTMLElement | null>;
} {
  const ref = React.useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = React.useState(present);

  React.useLayoutEffect(() => {
    if (present) {
      setMounted(true);
      return;
    }
    const node = ref.current;
    if (!node) {
      setMounted(false);
      return;
    }
    // `data-state="closed"` is already in the DOM, so this resolves to the
    // exit animation (if any) — reading it forces the style recalc.
    const name = getComputedStyle(node).animationName;
    if (name === "" || name === "none") {
      setMounted(false);
      return;
    }
    const prevPointerEvents = node.style.pointerEvents;
    node.style.pointerEvents = "none";
    // Animation events bubble from descendants, and a close mid-enter cancels
    // the enter keyframe on this very node — only the exit's own end counts.
    const onEnd = (e: AnimationEvent) => {
      if (e.target !== node) return;
      if (e.animationName && !name.includes(e.animationName)) return;
      flushSync(() => setMounted(false));
    };
    node.addEventListener("animationend", onEnd);
    node.addEventListener("animationcancel", onEnd);
    const timer = setTimeout(() => setMounted(false), EXIT_FALLBACK_MS);
    return () => {
      clearTimeout(timer);
      node.removeEventListener("animationend", onEnd);
      node.removeEventListener("animationcancel", onEnd);
      node.style.pointerEvents = prevPointerEvents;
    };
  }, [present]);

  return { isPresent: present || mounted, ref };
}
