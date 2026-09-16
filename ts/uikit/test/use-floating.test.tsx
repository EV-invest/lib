import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { render, act } from "@testing-library/react";
import { useFloating, type Side } from "../src/primitives/use-floating";

const OFFSET = 4;
const FLOATING = { width: 200, height: 100 };

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

function scrollNestedBy(dy: number) {
  // A nested scroll container moves the anchor without touching `scrollY`.
  anchor.top -= dy;
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
        if (id === "floating") return rect(0, 0, FLOATING.width, FLOATING.height);
        return rect(0, 0, 0, 0);
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "scrollX", { configurable: true, value: 0 });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  });

  it("positions absolutely in document coordinates below the anchor", () => {
    scroll = { x: 0, y: 250 };
    const { getByTestId } = render(<Harness />);
    const floating = getByTestId("floating");
    expect(floating.style.position).toBe("absolute");
    expect(floating).toHaveAttribute("data-side", "bottom");
    expect(floating.style.top).toBe(`${anchor.top + anchor.height + scroll.y + OFFSET}px`);
    // Centre-aligned: anchor centre minus half the floating width.
    expect(floating.style.left).toBe(`${anchor.left + anchor.width / 2 - FLOATING.width / 2}px`);
  });

  it("keeps the same coordinates on a document scroll (page moves it natively)", () => {
    const { getByTestId } = render(<Harness />);
    const floating = getByTestId("floating");
    const before = floating.style.top;
    scrollDocumentBy(100);
    expect(floating.style.top).toBe(before);
  });

  it("follows the anchor on a nested scroll", () => {
    const { getByTestId } = render(<Harness />);
    const floating = getByTestId("floating");
    const before = parseInt(floating.style.top, 10);
    scrollNestedBy(100);
    expect(parseInt(floating.style.top, 10)).toBe(before - 100);
  });

  it("flips to the top when the anchor sits at the viewport bottom, and keeps the side on scroll", () => {
    // jsdom's viewport is 1024x768: no room for 100px below, plenty above.
    Object.assign(anchor, { top: 700, height: 40 });
    const { getByTestId } = render(<Harness />);
    const floating = getByTestId("floating");
    expect(floating).toHaveAttribute("data-side", "top");
    expect(floating.style.top).toBe(`${anchor.top - OFFSET - FLOATING.height}px`);

    // Scrolling the anchor back into the middle would allow "bottom" again,
    // but the side is only revisited on a full placement, never on scroll.
    act(() => scrollNestedBy(400));
    expect(floating).toHaveAttribute("data-side", "top");
    expect(floating.style.top).toBe(`${anchor.top - OFFSET - FLOATING.height}px`);
  });

  it("re-runs the full placement on window resize", () => {
    Object.assign(anchor, { top: 700, height: 40 });
    const { getByTestId } = render(<Harness />);
    const floating = getByTestId("floating");
    expect(floating).toHaveAttribute("data-side", "top");
    anchor.top = 100;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(floating).toHaveAttribute("data-side", "bottom");
  });

  it("does not reach into React state for top/left (style prop is stable)", () => {
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
    expect(seen[0]).toEqual({ position: "absolute" });
  });
});
