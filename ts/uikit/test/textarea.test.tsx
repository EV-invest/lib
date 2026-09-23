import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Textarea } from "../src/components/textarea";

describe("Textarea", () => {
  it("renders the base classes and slot", () => {
    const { container } = render(<Textarea />);
    const el = container.querySelector("textarea")!;
    expect(el).toHaveClass("field-sizing-content");
    expect(el).toHaveClass("min-h-16");
    expect(el).toHaveAttribute("data-slot", "textarea");
  });

  it("grows at lg and keeps 16px text at every width", () => {
    const { container } = render(<Textarea size="lg" />);
    const el = container.querySelector("textarea")!;
    expect(el).toHaveAttribute("data-size", "lg");
    expect(el).toHaveClass("min-h-20", "px-4", "md:text-base");
    expect(el).not.toHaveClass("min-h-16");
    expect(el).not.toHaveClass("md:text-sm");
  });

  it("forwards placeholder", () => {
    const { container } = render(<Textarea placeholder="Write here" />);
    const el = container.querySelector("textarea")!;
    expect(el).toHaveAttribute("placeholder", "Write here");
  });

  it("lets className override the base", () => {
    const { container } = render(<Textarea className="min-h-40" />);
    const el = container.querySelector("textarea")!;
    expect(el).toHaveClass("min-h-40");
    expect(el).not.toHaveClass("min-h-16");
  });
});
