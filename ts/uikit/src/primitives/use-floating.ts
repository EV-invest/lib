"use client";

import * as React from "react";

export type Side = "top" | "right" | "bottom" | "left";
export type Align = "start" | "center" | "end";

export interface FloatingResult {
  floatingRef: React.RefObject<HTMLElement | null>;
  style: React.CSSProperties;
  side: Side;
  align: Align;
}

// The element sits at its containing block's origin and is moved with the
// `translate` property, never with `top`/`left`: an absolute box's
// shrink-to-fit width is "containing block minus `left`", so a `w-fit` surface
// pushed past the viewport's right edge (horizontal scroll, a nested scroller)
// would collapse to one word per line. `translate` composes with `transform`,
// so the enter animations (which animate `transform`) are unaffected. The
// offset never goes through React: `place()` / `sync()` write it straight to
// the element, so this style prop stays one frozen object.
const ABSOLUTE: React.CSSProperties = Object.freeze({ position: "absolute", top: 0, left: 0 });

const POSITIONED = new Set(["relative", "absolute", "fixed", "sticky"]);

/**
 * Converts a viewport-relative point into the coordinate space of the
 * floating element's containing block, i.e. the numbers `position: absolute`
 * expects. floating-ui's `strategy: "absolute"` does the same walk.
 */
function toContainingBlock(
  floating: HTMLElement,
  x: number,
  y: number,
): { x: number; y: number; root: boolean } {
  const parent = floating.offsetParent;
  const doc = floating.ownerDocument;
  const root = parent === doc.body || parent === doc.documentElement || parent === null;
  // `offsetParent` reports `body` even when nothing is positioned; only a
  // positioned body/html really forms a containing block.
  const positioned =
    parent instanceof HTMLElement &&
    (!root || POSITIONED.has(doc.defaultView?.getComputedStyle(parent).position ?? ""));
  if (!positioned) {
    const win = doc.defaultView;
    return { x: x + (win?.scrollX ?? 0), y: y + (win?.scrollY ?? 0), root: true };
  }
  const p = parent.getBoundingClientRect();
  return {
    x: x - p.left - parent.clientLeft + parent.scrollLeft,
    y: y - p.top - parent.clientTop + parent.scrollTop,
    root: false,
  };
}

interface Size2D {
  width: number;
  height: number;
}

// The layout box, not `getBoundingClientRect()`: the latter reports the box
// mid-animation (`zoom-in-95` scales it to 0.95 on the first frame), which
// placed a top-side popover 5 % of its height too low, over the anchor.
function layoutSize(el: HTMLElement): Size2D {
  return { width: el.offsetWidth, height: el.offsetHeight };
}

function viewport(): { vw: number; vh: number } {
  // `clientWidth` excludes the scrollbar, which the floating element cannot
  // sit under anyway; jsdom reports 0 there, hence the fallback.
  const el = document.documentElement;
  return {
    vw: el.clientWidth || window.innerWidth,
    vh: el.clientHeight || window.innerHeight,
  };
}

/**
 * Positions a floating element against an anchor with `position: absolute` in
 * the coordinate space of its containing block (the `Portal` puts it in
 * `document.body`, so normally document coordinates) — the dep-light stand-in
 * for `@radix-ui/react-popper` / floating-ui. Supports a preferred
 * `side`/`align`, an `offset`, and a single collision flip onto the opposite
 * side when the preferred side overflows the viewport.
 *
 * Two update modes:
 * - `place()` — full pass (flip + clamp into the viewport) on open, on window
 *   `resize`, and whenever the anchor or the floating element changes size.
 * - `sync()` — re-derives the coordinates from the anchor with the side and
 *   the clamp shift already chosen; runs on every `scroll` (captured on
 *   `window`, so nested scroll containers count too).
 *
 * Because the element is absolutely positioned in the document, a document
 * scroll moves it natively with the page — `sync()` then computes the same
 * numbers and is a no-op — so the overlay never lags behind the compositor.
 * Only a nested scroll container changes the coordinates, and there a frame
 * of lag is acceptable. The side is never revisited on scroll: no jumping.
 * A page that scrolls `body` instead of the document (`html { overflow:
 * hidden } body { overflow: auto }`) is such a nested scroller: correct, but
 * with the frame of lag the `fixed` strategy had.
 *
 * Rust's overlays use CSS-only placement (`data-side`) and do not measure; see
 * the README "Limitations".
 */
export function useFloating(opts: {
  anchorRef: React.RefObject<Element | null>;
  open: boolean;
  side?: Side;
  align?: Align;
  offset?: number;
}): FloatingResult {
  const { anchorRef, open, side = "bottom", align = "center", offset = 4 } = opts;
  const floatingRef = React.useRef<HTMLElement | null>(null);
  const [placedSide, setPlacedSide] = React.useState<Side>(side);
  // The last full placement: the side that won the flip and how far the
  // viewport clamp pushed the element off its ideal spot. `sync()` reuses both
  // instead of measuring against the viewport again.
  const placement = React.useRef<{ side: Side; shiftX: number; shiftY: number }>({
    side,
    shiftX: 0,
    shiftY: 0,
  });

  React.useLayoutEffect(() => {
    if (!open) return;

    function ideal(a: DOMRect, f: Size2D, placed: Side): { top: number; left: number } {
      let top = 0;
      let left = 0;
      const vertical = placed === "top" || placed === "bottom";

      if (placed === "bottom") top = a.bottom + offset;
      else if (placed === "top") top = a.top - offset - f.height;
      else if (placed === "right") left = a.right + offset;
      else left = a.left - offset - f.width;

      if (vertical) {
        if (align === "start") left = a.left;
        else if (align === "end") left = a.right - f.width;
        else left = a.left + a.width / 2 - f.width / 2;
      } else {
        if (align === "start") top = a.top;
        else if (align === "end") top = a.bottom - f.height;
        else top = a.top + a.height / 2 - f.height / 2;
      }
      return { top, left };
    }

    // `contain` keeps the box inside the initial containing block: a box past
    // the document's edge grows the page (a scrollbar shows for as long as the
    // overlay is open). `place()` already clamps against the viewport;
    // `sync()` follows a nested scroller's anchor and only needs this bound.
    function write(floating: HTMLElement, f: Size2D, top: number, left: number, contain: boolean) {
      const p = toContainingBlock(floating, left, top);
      let { x, y } = p;
      if (contain && p.root) {
        const icbWidth = floating.ownerDocument.documentElement.clientWidth || window.innerWidth;
        x = Math.max(0, Math.min(x, icbWidth - f.width));
        y = Math.max(0, y);
      }
      floating.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
    }

    function place() {
      const anchor = anchorRef.current;
      const floating = floatingRef.current;
      if (!anchor || !floating) return;

      const a = anchor.getBoundingClientRect();
      const f = layoutSize(floating);
      const { vw, vh } = viewport();

      let placed: Side = side;
      if (side === "bottom" && a.bottom + offset + f.height > vh && a.top - offset - f.height > 0)
        placed = "top";
      else if (side === "top" && a.top - offset - f.height < 0 && a.bottom + offset + f.height < vh)
        placed = "bottom";
      else if (side === "right" && a.right + offset + f.width > vw && a.left - offset - f.width > 0)
        placed = "left";
      else if (side === "left" && a.left - offset - f.width < 0 && a.right + offset + f.width < vw)
        placed = "right";

      const { top, left } = ideal(a, f, placed);
      const clampedLeft = Math.max(offset, Math.min(left, vw - f.width - offset));
      const clampedTop = Math.max(offset, Math.min(top, vh - f.height - offset));

      placement.current = {
        side: placed,
        shiftX: clampedLeft - left,
        shiftY: clampedTop - top,
      };
      write(floating, f, clampedTop, clampedLeft, false);
      // Only a real change may re-render: this runs on every resize tick.
      setPlacedSide(prev => (prev === placed ? prev : placed));
    }

    function sync() {
      const anchor = anchorRef.current;
      const floating = floatingRef.current;
      if (!anchor || !floating) return;

      const a = anchor.getBoundingClientRect();
      const f = layoutSize(floating);
      const { side: placed, shiftX, shiftY } = placement.current;
      const { top, left } = ideal(a, f, placed);
      write(floating, f, top + shiftY, left + shiftX, true);
    }

    place();
    // No rAF: `scroll` already fires at most once per frame, and a synchronous
    // DOM write from the handler lands in that same frame — rAF would cost one.
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", place);

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(place);
      if (anchorRef.current) observer.observe(anchorRef.current);
      if (floatingRef.current) observer.observe(floatingRef.current);
    }

    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", place);
      observer?.disconnect();
    };
  }, [open, side, align, offset, anchorRef]);

  return { floatingRef, style: ABSOLUTE, side: placedSide, align };
}
