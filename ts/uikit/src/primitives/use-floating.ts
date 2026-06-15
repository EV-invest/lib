import * as React from "react";

export type Side = "top" | "right" | "bottom" | "left";
export type Align = "start" | "center" | "end";

export interface FloatingResult {
  floatingRef: React.RefObject<HTMLElement | null>;
  style: React.CSSProperties;
  side: Side;
  align: Align;
}

/**
 * Positions a floating element against an anchor with `position: fixed` and
 * `getBoundingClientRect` — the dep-light stand-in for `@radix-ui/react-popper`
 * / floating-ui. Supports a preferred `side`/`align`, an `offset`, and a single
 * collision flip onto the opposite side when the preferred side overflows the
 * viewport. Recomputes on scroll and resize while `open`.
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
  const [style, setStyle] = React.useState<React.CSSProperties>({
    position: "fixed",
    top: 0,
    left: 0,
  });
  const [resolved, setResolved] = React.useState<{ side: Side; align: Align }>({
    side,
    align,
  });

  React.useLayoutEffect(() => {
    if (!open) return;

    function update() {
      const anchor = anchorRef.current;
      const floating = floatingRef.current;
      if (!anchor || !floating) return;

      const a = anchor.getBoundingClientRect();
      const f = floating.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let placed: Side = side;
      if (side === "bottom" && a.bottom + offset + f.height > vh && a.top - offset - f.height > 0)
        placed = "top";
      else if (side === "top" && a.top - offset - f.height < 0 && a.bottom + offset + f.height < vh)
        placed = "bottom";
      else if (side === "right" && a.right + offset + f.width > vw && a.left - offset - f.width > 0)
        placed = "left";
      else if (side === "left" && a.left - offset - f.width < 0 && a.right + offset + f.width < vw)
        placed = "right";

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

      left = Math.max(offset, Math.min(left, vw - f.width - offset));
      top = Math.max(offset, Math.min(top, vh - f.height - offset));

      setStyle({ position: "fixed", top: Math.round(top), left: Math.round(left) });
      setResolved({ side: placed, align });
    }

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, side, align, offset, anchorRef]);

  return { floatingRef, style, side: resolved.side, align: resolved.align };
}
