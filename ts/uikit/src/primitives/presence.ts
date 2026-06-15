import * as React from "react";

/**
 * Keeps a node mounted through its exit animation — the dep-light core of
 * `@radix-ui/react-presence`. While `present` is true the node is mounted with
 * `data-state="open"`; when `present` flips to false the hook switches it to
 * `data-state="closed"` and unmounts only after the node's CSS
 * animation/transition ends (or immediately if there is none).
 *
 * Usage: spread `{ ref, ...(isPresent ? {} : {}) }` and render only while
 * `isPresent`. The Rust mirror toggles `data-state` without deferring unmount.
 */
export function usePresence(present: boolean): {
  isPresent: boolean;
  ref: React.RefObject<HTMLElement | null>;
} {
  const ref = React.useRef<HTMLElement | null>(null);
  const [isPresent, setIsPresent] = React.useState(present);

  React.useEffect(() => {
    const node = ref.current;
    if (present) {
      setIsPresent(true);
      return;
    }
    if (!node) {
      setIsPresent(false);
      return;
    }
    const styles = getComputedStyle(node);
    const hasAnim =
      (styles.animationName && styles.animationName !== "none") ||
      parseFloat(styles.transitionDuration) > 0;
    if (!hasAnim) {
      setIsPresent(false);
      return;
    }
    function done() {
      setIsPresent(false);
    }
    node.addEventListener("animationend", done);
    node.addEventListener("transitionend", done);
    return () => {
      node.removeEventListener("animationend", done);
      node.removeEventListener("transitionend", done);
    };
  }, [present]);

  return { isPresent: present || isPresent, ref };
}
