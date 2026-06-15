import { describe, it, expect, afterEach, vi } from "vitest";
import { render, fireEvent, act, cleanup } from "@testing-library/react";
import { Toaster, toast } from "../src/components/sonner";

// The toast store is module-global, so each test pushes toasts with a very
// short non-default duration where it does not assert auto-dismiss, and the
// fake-timer test below drains its own toast; `cleanup` unmounts the Toaster.
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("Toaster", () => {
  it("renders nothing until a toast is enqueued, then shows it", () => {
    vi.useFakeTimers();
    const { container, getByText } = render(<Toaster />);
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(0);
    act(() => {
      toast("Saved", { duration: 50 });
    });
    const item = getByText("Saved").closest('[data-slot="toast"]')!;
    expect(item).toHaveAttribute("role", "status");
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(0);
  });

  it("pins the variant via the helper methods", () => {
    const { getByText } = render(<Toaster />);
    let id = 0;
    act(() => {
      id = toast.success("Done", { duration: Infinity });
    });
    const item = getByText("Done").closest('[data-slot="toast"]')!;
    expect(item).toHaveAttribute("data-variant", "success");
    act(() => {
      toast.dismiss(id);
    });
  });

  it("dismisses on the close button", () => {
    const { container, getByText, getByLabelText } = render(<Toaster />);
    act(() => {
      toast.error("Oops", { duration: Infinity });
    });
    expect(getByText("Oops")).toBeInTheDocument();
    fireEvent.click(getByLabelText("Close"));
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(0);
  });

  it("auto-dismisses after the duration", () => {
    vi.useFakeTimers();
    const { container } = render(<Toaster />);
    act(() => {
      toast.info("Heads up", { duration: 1000 });
    });
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(0);
  });

  it("places the stack per the position prop", () => {
    const { container } = render(<Toaster position="top-center" />);
    const root = container.querySelector('[data-slot="toaster"]')!;
    expect(root).toHaveAttribute("data-position", "top-center");
  });
});
