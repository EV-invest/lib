import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Logo } from "../src/components/logo";

describe("Logo", () => {
  it("renders the mark as a mask over the inlined data URI", () => {
    const { getByRole } = render(<Logo className="w-10 h-10" />);
    const mark = getByRole("img");
    expect(mark).toHaveAttribute("data-slot", "logo");
    expect(mark).toHaveAccessibleName("EV Investment");
    expect(mark).toHaveClass("inline-block", "w-10", "h-10");
    expect(mark.style.maskImage).toContain("data:image/svg+xml,");
  });

  it("lets src override the inlined mark", () => {
    const { getByRole } = render(<Logo src="/assets/logo.svg" />);
    expect(getByRole("img").style.maskImage).toBe('url("/assets/logo.svg")');
  });

  it("withBackground wraps the mark in the brand field", () => {
    const { getByRole } = render(<Logo withBackground className="w-10 h-10" />);
    const mark = getByRole("img");
    expect(mark).toHaveClass("w-3/5", "h-3/5");
    const field = mark.parentElement!;
    expect(field).toHaveAttribute("data-slot", "logo-background");
    expect(field).toHaveClass("inline-flex", "w-10", "h-10");
  });
});
