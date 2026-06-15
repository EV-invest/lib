import * as React from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

function focusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
  );
}

/**
 * Traps Tab focus inside the returned ref's subtree and restores focus to the
 * previously-focused element on unmount — the dep-light core of dialogs/menus,
 * replacing `@radix-ui/react-focus-scope`. On mount, focuses the first
 * focusable (or the container itself).
 *
 * Rust dialogs rely on the browser's native focus order within a fixed overlay;
 * see the README "Limitations".
 */
export function useFocusScope(enabled: boolean): React.RefObject<HTMLDivElement | null> {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    const root = ref.current;
    if (!root) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const first = focusable(root)[0];
    (first ?? root).focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !root) return;
      const items = focusable(root);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && active === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && active === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    }

    root.addEventListener("keydown", onKeyDown);
    return () => {
      root.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [enabled]);

  return ref;
}
