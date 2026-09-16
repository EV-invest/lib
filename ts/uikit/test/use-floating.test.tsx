import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { render, act } from "@testing-library/react";
import { useFloating, type Side } from "../src/primitives/use-floating";

const OFFSET = 4;
const FLOATING = { width: 200, height: 100 };
// jsdom's viewport.
const VIEWPORT = { width: 1024, height: 768 };

// Viewport-relative anchor box, mutated by the tests to simulate scrolling.
const anchor = { top: 100, left: 300, width: 80, height: 40 };

function rect(top: number, left: number, width: number, height: number): DOMRect {
  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

// The hook moves the box with `translate: <x>px <y>px`, never `top`/`left`.
function offset(el: HTMLElement): { x: number; y: number } {
  const [x, y] = el.style.getPropertyValue("translate").split(" ").map(v => parseInt(v, 10));
  return { x: x ?? NaN, y: y ?? NaN };
}

function Harness({ side = "bottom" }: { side?: Side }) {
  const anchorRef = React.useRef<HTMLButtonElement>(null);
  const {
    floatingRef,
    style,
    side: placed,
  } = useFloating({ anchorRef, open: true, side, offset: OFFSET });
  return (
    <>
      <button ref={anchorRef} data-testid="anchor" />
      <div
        ref={floatingRef as React.RefObject<HTMLDivElement>}
        data-testid="floating"
        data-side={placed}
        style={style}
      />
    </>
  );
}

let scroll = { x: 0, y: 0 };

function scrollDocumentBy(dy: number) {
  // A document scroll moves the anchor in the viewport by exactly -dy while
  // `scrollY` grows by dy, so document coordinates stay put.
  anchor.top -= dy;
  scroll = { x: scroll.x, y: scroll.y + dy };
  window.dispatchEvent(new Event("scroll"));
}

function scrollNestedBy(dy: number, dx = 0) {
  // A nested scroll container moves the anchor without touching `scrollY`.
  anchor.top -= dy;
  anchor.left -= dx;
  window.dispatchEvent(new Event("scroll"));
}

describe("useFloating", () => {
  beforeEach(() => {
    Object.assign(anchor, { top: 100, left: 300, width: 80, height: 40 });
    scroll = { x: 0, y: 0 };
    Object.defineProperty(window, "scrollX", { configurable: true, get: () => scroll.x });
    Object.defineProperty(window, "scrollY", { configurable: true, get: () => scroll.y });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const id = this.getAttribute("data-testid");
        if (id === "anchor") return rect(anchor.top, anchor.left, anchor.width, anchor.height);
        // The floating rect is deliberately reported scaled, like the first
        // frame of `zoom-in-95`: the hook must size it off the layout box.
        if (id === "floating") return rect(0, 0, FLOATING.width * 0.95, FLOATING.height * 0.95);
        return rect(0, 0, 0, 0);
      },
    );
    for (const [prop, size] of [["offsetWidth", FLOATING.width], ["offsetHeight", FLOATING.height]] as const) {
      vi.spyOn(HTMLElement.prototype, prop, "get").mockImplementation(function (this: HTMLElement) {
        return this.getAttribute("data-testid") === "floating" ? size : 0;
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "scrollX", { configurable: true, value: 0 });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  });

  it("positions absolutely at the origin and translates into document coordinates", () => {
    scroll = { x: 0, y: 250 };
    const { getByTestId } = render(<Harness />);
    const floating = getByTestId("floating");
    expect(floating.style.position).toBe("absolute");
    expect(floating.style.top).toBe("0px");
    expect(floating.style.left).toBe("0px");
    expect(floating).toHaveAttribute("data-side", "bottom");
    expect(offset(floating)).toEqual({
      // Centre-aligned: anchor centre minus half the floating width.
      x: anchor.left + anchor.width / 2 - FLOATING.width / 2,
      y: anchor.top + anchor.height + scroll.y + OFFSET,
    });
  });

  it("keeps the same coordinates on a document scroll (page moves it natively)", () => {
    const { getByTestId } = render(<Harness />);
    const floating = getByTestId("floating");
    const before = offset(floating);
    scrollDocumentBy(100);
    expect(offset(floating)).toEqual(before);
  });

  it("follows the anchor on a nested scroll", () => {
    const { getByTestId } = render(<Harness />);
    const floating = getByTestId("floating");
    const before = offset(floating);
    scrollNestedBy(100);
    expect(offset(floating)).toEqual({ x: before.x, y: before.y - 100 });
  });

  it("flips to the top when the anchor sits at the viewport bottom, and keeps the side on scroll", () => {
    // No room for 100px below the anchor, plenty above.
    Object.assign(anchor, { top: VIEWPORT.height - 68, height: 40 });
    const { getByTestId } = render(<Harness />);
    const floating = getByTestId("floating");
    expect(floating).toHaveAttribute("data-side", "top");
    expect(offset(floating).y).toBe(anchor.top - OFFSET - FLOATING.height);

    // Scrolling the anchor back into the middle would allow "bottom" again,
    // but the side is only revisited on a full placement, never on scroll.
    act(() => scrollNestedBy(400));
    expect(floating).toHaveAttribute("data-side", "top");
    expect(offset(floating).y).toBe(anchor.top - OFFSET - FLOATING.height);
  });

  it("re-runs the full placement on window resize", () => {
    Object.assign(anchor, { top: VIEWPORT.height - 68, height: 40 });
    const { getByTestId } = render(<Harness />);
    const floating = getByTestId("floating");
    expect(floating).toHaveAttribute("data-side", "top");
    anchor.top = 100;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(floating).toHaveAttribute("data-side", "bottom");
  });

  it("keeps the viewport clamp shift chosen at placement while scrolling", () => {
    // Centred under this anchor the box would end at 1040: clamped 20px left.
    Object.assign(anchor, { left: VIEWPORT.width - 100, width: 80 });
    const ideal = anchor.left + anchor.width / 2 - FLOATING.width / 2;
    const clamped = VIEWPORT.width - FLOATING.width - OFFSET;
    const { getByTestId } = render(<Harness />);
    const floating = getByTestId("floating");
    expect(offset(floating).x).toBe(clamped);

    // A nested scroll re-derives from the anchor with the same shift: no jump.
    scrollNestedBy(0, 50);
    expect(offset(floating).x).toBe(ideal - 50 + (clamped - ideal));
  });

  it("never lets a nested scroll push the box past the document's edges", () => {
    const { getByTestId } = render(<Harness />);
    const floating = getByTestId("floating");
    // The anchor is scrolled far right and up, out of its container.
    scrollNestedBy(500, -2000);
    expect(offset(floating)).toEqual({ x: VIEWPORT.width - FLOATING.width, y: 0 });
  });

  it("does not reach into React state for the offset (style prop is stable)", () => {
    const seen: React.CSSProperties[] = [];
    function Probe() {
      const anchorRef = React.useRef<HTMLButtonElement>(null);
      const { floatingRef, style } = useFloating({ anchorRef, open: true });
      seen.push(style);
      return (
        <>
          <button ref={anchorRef} data-testid="anchor" />
          <div ref={floatingRef as React.RefObject<HTMLDivElement>} data-testid="floating" style={style} />
        </>
      );
    }
    const { rerender } = render(<Probe />);
    rerender(<Probe />);
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(new Set(seen).size).toBe(1);
    expect(seen[0]).toEqual({ position: "absolute", top: 0, left: 0 });
  });
});
