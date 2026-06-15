import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Button, buttonVariants } from "../src/components/button";

describe("Button", () => {
  it("renders the default variant and size", () => {
    const { getByText } = render(<Button>go</Button>);
    const el = getByText("go");
    expect(el.tagName).toBe("BUTTON");
    expect(el).toHaveClass("bg-primary");
    expect(el).toHaveClass("h-9");
    expect(el).toHaveAttribute("data-slot", "button");
  });

  it("applies the icon-sm size (canon parity with Rust)", () => {
    const { getByText } = render(<Button size="icon-sm">x</Button>);
    expect(getByText("x")).toHaveClass("size-8");
  });

  it("renders as child when asChild", () => {
    const { getByRole } = render(
      <Button asChild>
        <a href="#">link</a>
      </Button>,
    );
    const el = getByRole("link");
    expect(el.tagName).toBe("A");
    expect(el).toHaveClass("bg-primary");
  });

  it("buttonVariants helper fuses variant, size and className override", () => {
    const cls = buttonVariants({ variant: "ghost", size: "default", className: "px-10" });
    expect(cls).toContain("hover:bg-accent");
    expect(cls).toContain("h-9");
    expect(cls).toContain("px-10");
    // the default size's standalone `px-4` is dropped by the override (the
    // `has-[>svg]:px-3` refinement stays — it's a different utility).
    expect(cls).not.toMatch(/(^|\s)px-4(\s|$)/);
  });
});
