import * as React from "react";

/**
 * Arrow-key roving focus over a set of items — the dep-light core of menus,
 * tabs, radio-groups and toolbars (replacing `@radix-ui/react-roving-focus`).
 * Returns an `onKeyDown` to spread on the container and the active index; items
 * should set `tabIndex={index === activeIndex ? 0 : -1}`.
 *
 * Mirrors the keyboard navigation Rust drives with a focused-index signal.
 */
export function useRovingFocus(opts: {
  count: number;
  orientation?: "horizontal" | "vertical" | "both";
  loop?: boolean;
  initial?: number;
}): {
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
} {
  const { count, orientation = "vertical", loop = true, initial = 0 } = opts;
  const [activeIndex, setActiveIndex] = React.useState(initial);

  const next = (dir: 1 | -1) =>
    setActiveIndex((i) => {
      let n = i + dir;
      if (n < 0) n = loop ? count - 1 : 0;
      else if (n >= count) n = loop ? 0 : count - 1;
      return n;
    });

  const onKeyDown = (event: React.KeyboardEvent) => {
    const horiz = orientation === "horizontal" || orientation === "both";
    const vert = orientation === "vertical" || orientation === "both";
    if (vert && event.key === "ArrowDown") {
      event.preventDefault();
      next(1);
    } else if (vert && event.key === "ArrowUp") {
      event.preventDefault();
      next(-1);
    } else if (horiz && event.key === "ArrowRight") {
      event.preventDefault();
      next(1);
    } else if (horiz && event.key === "ArrowLeft") {
      event.preventDefault();
      next(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(count - 1);
    }
  };

  return { activeIndex, setActiveIndex, onKeyDown };
}
