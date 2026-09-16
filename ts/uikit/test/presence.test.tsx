import { describe, it, expect, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import * as React from "react";
import { usePresence } from "../src/primitives/presence";

// Minimal consumer, shaped like the overlays: `data-state` follows `open`, the
// presence ref sits on the animated node, and a child exists so bubbling
// animation events can be told apart from the node's own.
function Overlay({ open }: { open: boolean }) {
  const { isPresent, ref } = usePresence(open);
  if (!isPresent) return null;
  return (
    <div
      data-testid="node"
      data-state={open ? "open" : "closed"}
      ref={ref as React.Ref<HTMLDivElement>}
    >
      <span data-testid="child">content</span>
    </div>
  );
}

const node = () => document.querySelector<HTMLElement>('[data-testid="node"]');

// jsdom has no AnimationEvent; a plain Event carries the bubbling that matters.
function fireAnimation(el: Element, type: "animationend" | "animationcancel") {
  act(() => {
    el.dispatchEvent(new Event(type, { bubbles: true }));
  });
}

// jsdom never resolves an animation-name; pretend the closed state has one.
function mockExitAnimation() {
  const real = window.getComputedStyle;
  vi.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) => {
    const style = real.call(window, el, pseudo);
    if (el.getAttribute("data-state") === "closed") {
      Object.defineProperty(style, "animationName", { value: "exit", configurable: true });
    }
    return style;
  });
}

describe("usePresence", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("unmounts at once when the closed state has no animation", () => {
    const { rerender } = render(<Overlay open />);
    expect(node()).not.toBeNull();
    rerender(<Overlay open={false} />);
    expect(node()).toBeNull();
  });

  it("keeps the node inert until its own exit animation ends", () => {
    mockExitAnimation();
    const { rerender } = render(<Overlay open />);
    rerender(<Overlay open={false} />);

    const el = node();
    expect(el).not.toBeNull();
    expect(el).toHaveAttribute("data-state", "closed");
    expect(el?.style.pointerEvents).toBe("none");

    // a descendant's animation bubbling up is not the exit
    fireAnimation(document.querySelector('[data-testid="child"]')!, "animationend");
    expect(node()).not.toBeNull();

    fireAnimation(el!, "animationend");
    expect(node()).toBeNull();
  });

  it("unmounts on animationcancel of the exit", () => {
    mockExitAnimation();
    const { rerender } = render(<Overlay open />);
    rerender(<Overlay open={false} />);
    fireAnimation(node()!, "animationcancel");
    expect(node()).toBeNull();
  });

  it("re-opening mid-exit flips the state back without remounting", () => {
    mockExitAnimation();
    const { rerender } = render(<Overlay open />);
    rerender(<Overlay open={false} />);
    const closing = node();
    expect(closing).toHaveAttribute("data-state", "closed");

    rerender(<Overlay open />);
    const reopened = node();
    expect(reopened).toBe(closing);
    expect(reopened).toHaveAttribute("data-state", "open");
    expect(reopened?.style.pointerEvents).toBe("");

    // the stale exit's end must not tear down the re-opened node
    fireAnimation(reopened!, "animationend");
    expect(node()).not.toBeNull();
  });

  it("falls back to a timer when no animation event arrives", () => {
    vi.useFakeTimers();
    mockExitAnimation();
    const { rerender } = render(<Overlay open />);
    rerender(<Overlay open={false} />);
    expect(node()).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(node()).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(node()).toBeNull();
  });
});
