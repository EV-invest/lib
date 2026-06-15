import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Toggle, toggleVariants } from "../src/components/toggle";

describe("Toggle", () => {
  it("renders off by default with slot and base", () => {
    const { getByText } = render(<Toggle>B</Toggle>);
    const el = getByText("B");
    expect(el.tagName).toBe("BUTTON");
    expect(el).toHaveAttribute("data-slot", "toggle");
    expect(el).toHaveAttribute("data-state", "off");
    expect(el).toHaveAttribute("aria-pressed", "false");
    expect(el).toHaveClass("bg-transparent");
  });

  it("toggles pressed state on click", () => {
    const { getByText } = render(<Toggle>B</Toggle>);
    const el = getByText("B");
    fireEvent.click(el);
    expect(el).toHaveAttribute("data-state", "on");
    expect(el).toHaveAttribute("aria-pressed", "true");
  });

  it("respects a controlled pressed prop and fires onPressedChange", () => {
    const seen: boolean[] = [];
    const { getByText } = render(
      <Toggle pressed onPressedChange={(p) => seen.push(p)}>
        B
      </Toggle>,
    );
    const el = getByText("B");
    expect(el).toHaveAttribute("data-state", "on");
    fireEvent.click(el);
    expect(seen).toEqual([false]);
    expect(el).toHaveAttribute("data-state", "on");
  });

  it("toggleVariants fuses variant, size and override", () => {
    const cls = toggleVariants({ variant: "outline", size: "sm", className: "px-10" });
    expect(cls).toContain("border-input");
    expect(cls).toContain("h-8");
    expect(cls).toContain("px-10");
  });
});
