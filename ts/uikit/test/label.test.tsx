import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Label } from "../src/components/label";

describe("Label", () => {
  it("renders a label with base classes and slot", () => {
    const { getByText } = render(<Label>Name</Label>);
    const el = getByText("Name");
    expect(el.tagName).toBe("LABEL");
    expect(el).toHaveClass("select-none");
    expect(el).toHaveAttribute("data-slot", "label");
  });

  it("maps the htmlFor attribute", () => {
    const { getByText } = render(<Label htmlFor="email">Email</Label>);
    expect(getByText("Email")).toHaveAttribute("for", "email");
  });

  it("lets className override the base", () => {
    const { getByText } = render(<Label className="text-base">x</Label>);
    const el = getByText("x");
    expect(el).toHaveClass("text-base");
    expect(el).not.toHaveClass("text-sm");
  });
});
