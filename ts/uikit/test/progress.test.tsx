import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Progress } from "../src/components/progress";

describe("Progress", () => {
  it("renders the base, slot and role", () => {
    const { getByRole } = render(<Progress />);
    const el = getByRole("progressbar");
    expect(el).toHaveClass("bg-primary/20");
    expect(el).toHaveAttribute("data-slot", "progress");
  });

  it("defaults to a fully-left indicator transform", () => {
    const { container } = render(<Progress />);
    const indicator = container.querySelector(
      "[data-slot=progress-indicator]",
    ) as HTMLElement;
    expect(indicator.style.transform).toBe("translateX(-100%)");
  });

  it("drives the indicator transform from value (canon parity with Rust)", () => {
    const { getByRole, container } = render(<Progress value={60} />);
    expect(getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
    const indicator = container.querySelector(
      "[data-slot=progress-indicator]",
    ) as HTMLElement;
    expect(indicator.style.transform).toBe("translateX(-40%)");
  });
});
