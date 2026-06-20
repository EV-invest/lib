import { describe, it, expect, afterEach, vi } from "vitest";
import { render, fireEvent, act, cleanup } from "@testing-library/react";
import { Toaster, toast } from "../src/components/sonner";

// The toast store is module-global, and dismissal is now two-phase: `dismiss`
// (close button / auto-dismiss) flips the toast to `data-state="closed"` to play
// the exit keyframe, and the live node is unmounted on its `animationend`. jsdom
// runs no CSS animations, so the lifecycle tests drive that event by hand with
// `fireEvent.animationEnd`; this afterEach drains any survivors (close each, then
// fire the exit animationend) so the store is empty before the next test.
afterEach(() => {
  act(() => {
    document
      .querySelectorAll('[data-slot="toast-close"]')
      .forEach((b) => fireEvent.click(b));
  });
  act(() => {
    document
      .querySelectorAll('[data-slot="toast"]')
      .forEach((t) => fireEvent.animationEnd(t));
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
  });

  it("pins the variant via the helper methods", () => {
    const { getByText } = render(<Toaster />);
    act(() => {
      toast.success("Done", { duration: Infinity });
    });
    const item = getByText("Done").closest('[data-slot="toast"]')!;
    expect(item).toHaveAttribute("data-variant", "success");
  });

  it("animates out on the close button, then unmounts on animationend", () => {
    const { container, getByText, getByLabelText } = render(<Toaster />);
    act(() => {
      toast.error("Oops", { duration: Infinity });
    });
    const item = getByText("Oops").closest('[data-slot="toast"]')!;
    fireEvent.click(getByLabelText("Close"));
    // exit animation starts; the node stays mounted until its animationend
    expect(item).toHaveAttribute("data-state", "closed");
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(1);
    fireEvent.animationEnd(item);
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(0);
  });

  it("the enter animationend does not remove an open toast", () => {
    const { container, getByText } = render(<Toaster />);
    act(() => {
      toast("Stay", { duration: Infinity });
    });
    const item = getByText("Stay").closest('[data-slot="toast"]')!;
    fireEvent.animationEnd(item); // enter keyframe finished — must be a no-op
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(1);
    expect(item).toHaveAttribute("data-state", "open");
  });

  it("auto-dismisses after the duration, then unmounts on animationend", () => {
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
    // duration elapsed -> exit animation, node still mounted
    const item = container.querySelector('[data-slot="toast"]')!;
    expect(item).toHaveAttribute("data-state", "closed");
    act(() => {
      fireEvent.animationEnd(item);
    });
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(0);
  });

  it("places the stack per the position prop", () => {
    const { container } = render(<Toaster position="top-center" />);
    const root = container.querySelector('[data-slot="toaster"]')!;
    expect(root).toHaveAttribute("data-position", "top-center");
  });
});
