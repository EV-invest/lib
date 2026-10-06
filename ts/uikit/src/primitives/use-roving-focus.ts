"use client";

import * as React from "react";

/**
 * Arrow-key roving focus over a set of items — the dep-light core of menus,
 * tabs, radio-groups and toolbars (replacing `@radix-ui/react-roving-focus`).
 * Returns an `onKeyDown` to spread on the container and the active index; items
 * should set `tabIndex={index === activeIndex ? 0 : -1}`.
 *
 * `count` may be a getter: containers whose items are only known from the DOM
 * (menus with conditionally rendered or disabled items, inline sub-menus) pass
 * one so the bound is read at keydown time — never during render, which keeps
 * the hook safe under SSR.
 *
 * Mirrors the keyboard navigation Rust drives with a focused-index signal.
 */
export function useRovingFocus(opts: {
  count: number | (() => number);
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

  const resolveCount = () => (typeof count === "function" ? count() : count);

  const next = (dir: 1 | -1) => {
    const total = resolveCount();
    if (total <= 0) return;
    setActiveIndex((i) => {
      // Clamp first: the item set may have shrunk since the index was set.
      let n = Math.min(Math.max(i, 0), total - 1) + dir;
      if (n < 0) n = loop ? total - 1 : 0;
      else if (n >= total) n = loop ? 0 : total - 1;
      return n;
    });
  };

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
      const total = resolveCount();
      if (total > 0) setActiveIndex(total - 1);
    }
  };

  return { activeIndex, setActiveIndex, onKeyDown };
}
