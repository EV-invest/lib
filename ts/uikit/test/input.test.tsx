import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Input } from "../src/components/input";

describe("Input", () => {
  it("renders the base classes and slot", () => {
    const { container } = render(<Input />);
    const el = container.querySelector("input")!;
    expect(el).toHaveClass("border-input");
    expect(el).toHaveClass("placeholder:text-muted-foreground");
    expect(el).toHaveAttribute("data-slot", "input");
  });

  it("forwards type and placeholder", () => {
    const { container } = render(<Input type="email" placeholder="you@example.com" />);
    const el = container.querySelector("input")!;
    expect(el).toHaveAttribute("type", "email");
    expect(el).toHaveAttribute("placeholder", "you@example.com");
  });

  it("lets className override the base", () => {
    const { container } = render(<Input className="h-12" />);
    const el = container.querySelector("input")!;
    expect(el).toHaveClass("h-12");
    expect(el).not.toHaveClass("h-9");
  });
});
