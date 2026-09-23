import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import * as React from "react";
import { Input } from "../src/components/input";

describe("Input", () => {
  it("renders the base classes and slot", () => {
    const { container } = render(<Input />);
    const el = container.querySelector("input")!;
    expect(el).toHaveClass("border-input");
    expect(el).toHaveClass("placeholder:text-ink-soft");
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

  it("defaults to md and grows to a 48px, 16px-text field at lg", () => {
    const { container, rerender } = render(<Input />);
    const el = container.querySelector("input")!;
    expect(el).toHaveAttribute("data-size", "md");
    expect(el).toHaveClass("h-9", "md:text-sm");

    rerender(<Input size="lg" />);
    expect(el).toHaveAttribute("data-size", "lg");
    expect(el).toHaveClass("h-12", "px-4", "text-base", "md:text-base", "rounded-[var(--control-radius)]");
    // below 16px iOS Safari zooms into the focused field
    expect(el).not.toHaveClass("h-9");
    expect(el).not.toHaveClass("md:text-sm");
  });

  it("hands the ref the DOM node (forwardRef, so React 18 keeps it too)", () => {
    const ref = React.createRef<HTMLInputElement>();
    const { container } = render(<Input ref={ref} />);
    expect(ref.current).toBe(container.querySelector("input"));
  });
});
