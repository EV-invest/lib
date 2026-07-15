import { describe, it, expect, afterEach, vi } from "vitest";
import {
  render,
  fireEvent,
  createEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { Toaster, toast } from "../src/components/sonner";

// jsdom implements neither PointerEvent nor TransitionEvent, so RTL's
// `fireEvent.*` drops their init fields (clientX / timeStamp / propertyName).
// Build the events by hand and pin what we need, mirroring the slider test.
function firePointer(
  el: HTMLElement,
  type: "pointerDown" | "pointerMove" | "pointerUp",
  clientX: number,
  timeStamp: number,
) {
  const event = createEvent[type](el, { clientX, button: 0, pointerId: 1 });
  Object.defineProperty(event, "clientX", { value: clientX });
  Object.defineProperty(event, "timeStamp", { value: timeStamp });
  fireEvent(el, event);
}
function fireTransitionEnd(el: HTMLElement, propertyName = "transform") {
  const event = createEvent.transitionEnd(el, { propertyName });
  Object.defineProperty(event, "propertyName", { value: propertyName });
  fireEvent(el, event);
}

// The store is module-global, and dismissal is two-phase: `dismiss` flips a toast
// to data-state="closed" to slide it out, and the node is dropped on the exit
// transform's transitionend. jsdom runs no transitions, so the lifecycle tests
// fire that by hand; this afterEach drains survivors so the store starts empty.
afterEach(() => {
  act(() => {
    document
      .querySelectorAll('[data-slot="toast-close"]')
      .forEach((b) => fireEvent.click(b));
  });
  act(() => {
    document
      .querySelectorAll<HTMLElement>('[data-slot="toast"]')
      .forEach((t) => fireTransitionEnd(t));
  });
  vi.useRealTimers();
  cleanup();
});

describe("Toaster", () => {
  it("renders nothing until a toast is enqueued, then shows it open", () => {
    const { container, getByText } = render(<Toaster />);
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(0);
    act(() => {
      toast("Saved", { duration: Infinity });
    });
    const item = getByText("Saved").closest('[data-slot="toast"]')!;
    expect(item).toHaveAttribute("role", "status");
    expect(item).toHaveAttribute("data-state", "open");
    expect(item).toHaveAttribute("data-front", "true");
  });

  it("marks front / depth / visibility across a stack", () => {
    const { getByText } = render(<Toaster />);
    act(() => {
      toast("first", { duration: Infinity });
      toast("second", { duration: Infinity });
      toast("third", { duration: Infinity });
      toast("fourth", { duration: Infinity });
    });
    // newest is the front of the stack (index 0); 4th pushes the 1st past the
    // visible-three window
    const fourth = getByText("fourth").closest('[data-slot="toast"]')!;
    const first = getByText("first").closest('[data-slot="toast"]')!;
    expect(fourth).toHaveAttribute("data-front", "true");
    expect(fourth).toHaveAttribute("data-visible", "true");
    expect(first).toHaveAttribute("data-front", "false");
    expect(first).toHaveAttribute("data-visible", "false");
  });

  it("pins the variant via the helper methods", () => {
    const { getByText } = render(<Toaster />);
    act(() => {
      toast.success("Done", { duration: Infinity });
    });
    const item = getByText("Done").closest('[data-slot="toast"]')!;
    expect(item).toHaveAttribute("data-variant", "success");
  });

  it("slides out on the close button, then unmounts on transitionend", () => {
    const { container, getByText, getByLabelText } = render(<Toaster />);
    act(() => {
      toast.error("Oops", { duration: Infinity });
    });
    const item = getByText("Oops").closest<HTMLElement>('[data-slot="toast"]')!;
    fireEvent.click(getByLabelText("Close"));
    expect(item).toHaveAttribute("data-state", "closed");
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(1);
    fireTransitionEnd(item);
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(0);
  });

  it("drops a toast dismissed before its first paint", () => {
    const { container } = render(<Toaster />);
    // pushed and dismissed in one batch: it mounts already closed, so no
    // transition — and so no transitionend — ever runs to drop it
    act(() => {
      const id = toast("Cancelled", { duration: Infinity });
      toast.dismiss(id);
    });
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(0);
  });

  it("a reposition transitionend does not remove an open toast", () => {
    const { container, getByText } = render(<Toaster />);
    act(() => {
      toast("Stay", { duration: Infinity });
    });
    const item = getByText("Stay").closest<HTMLElement>('[data-slot="toast"]')!;
    fireTransitionEnd(item); // open toast settling — must be a no-op
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(1);
    expect(item).toHaveAttribute("data-state", "open");
  });

  it("auto-dismisses after the duration, then unmounts on transitionend", () => {
    vi.useFakeTimers();
    const { container } = render(<Toaster />);
    act(() => {
      toast.info("Heads up", { duration: 1000 });
    });
    expect(container.querySelector('[data-slot="toast"]')).toHaveAttribute(
      "data-state",
      "open",
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const item = container.querySelector<HTMLElement>('[data-slot="toast"]')!;
    expect(item).toHaveAttribute("data-state", "closed");
    act(() => {
      fireTransitionEnd(item);
    });
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(0);
  });

  it("flings past the distance threshold via --swipe-x, removing on transitionend", () => {
    const { container, getByText } = render(<Toaster />);
    act(() => {
      toast("Swipe me", { duration: Infinity });
    });
    const item = getByText("Swipe me").closest<HTMLElement>(
      '[data-slot="toast"]',
    )!;
    firePointer(item, "pointerDown", 0, 1000);
    firePointer(item, "pointerMove", 80, 1100);
    expect(item).toHaveAttribute("data-swiping", "true");
    expect(item.style.getPropertyValue("--swipe-x")).toBe("80px");
    firePointer(item, "pointerUp", 80, 6000); // 80px >= 45px; distance-driven
    expect(item.style.getPropertyValue("--swipe-x")).toContain("150%");
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(1);
    fireEvent.transitionEnd(item);
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(0);
  });

  it("flings a short but fast flick off via the velocity threshold", () => {
    const { container, getByText } = render(<Toaster />);
    act(() => {
      toast("Flick", { duration: Infinity });
    });
    const item = getByText("Flick").closest<HTMLElement>(
      '[data-slot="toast"]',
    )!;
    firePointer(item, "pointerDown", 0, 1000);
    firePointer(item, "pointerMove", 20, 1005);
    firePointer(item, "pointerUp", 20, 1010); // 20px < 45px but 2px/ms > 0.11
    expect(item.style.getPropertyValue("--swipe-x")).toContain("150%");
    fireEvent.transitionEnd(item);
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(0);
  });

  it("snaps back to --swipe-x 0 and keeps the toast on a short, slow drag", () => {
    const { container, getByText } = render(<Toaster />);
    act(() => {
      toast("Hold on", { duration: Infinity });
    });
    const item = getByText("Hold on").closest<HTMLElement>(
      '[data-slot="toast"]',
    )!;
    firePointer(item, "pointerDown", 0, 1000);
    firePointer(item, "pointerMove", 12, 1500);
    firePointer(item, "pointerUp", 12, 2000); // 12px < 45px, 0.012px/ms < 0.11
    expect(item.style.getPropertyValue("--swipe-x")).toBe("0px");
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(1);
    fireEvent.transitionEnd(item);
    expect(item).not.toHaveAttribute("data-swiping");
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(1);
  });

  it("pauses auto-dismiss while hovered, resumes on leave", () => {
    vi.useFakeTimers();
    const { container, getByText } = render(<Toaster />);
    act(() => {
      toast.info("Hover me", { duration: 1000 });
    });
    const item = getByText("Hover me").closest<HTMLElement>(
      '[data-slot="toast"]',
    )!;
    act(() => {
      fireEvent.pointerOver(item); // bubbles to the toaster -> pause
    });
    act(() => {
      vi.advanceTimersByTime(5000); // well past 1000ms, but paused
    });
    expect(item).toHaveAttribute("data-state", "open");
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(1);
    act(() => {
      fireEvent.pointerOut(item, { relatedTarget: document.body }); // leave -> resume
    });
    act(() => {
      vi.advanceTimersByTime(1000); // remaining budget elapses
    });
    expect(container.querySelector('[data-slot="toast"]')).toHaveAttribute(
      "data-state",
      "closed",
    );
  });

  it("never auto-dismisses a persistent (duration Infinity) toast", () => {
    vi.useFakeTimers();
    const { container } = render(<Toaster />);
    act(() => {
      toast("Sticky", { duration: Infinity });
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(container.querySelector('[data-slot="toast"]')).toHaveAttribute(
      "data-state",
      "open",
    );
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(1);
  });

  it("stacks (data-stack) and places per the position prop", () => {
    const { container } = render(<Toaster position="top-center" />);
    const root = container.querySelector('[data-slot="toaster"]')!;
    expect(root).toHaveAttribute("data-position", "top-center");
    expect(root).toHaveAttribute("data-y-position", "top");
    expect(root).toHaveAttribute("data-stack");
  });
});
