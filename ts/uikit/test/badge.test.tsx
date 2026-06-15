import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Badge } from "../src/components/badge";

describe("Badge", () => {
  it("renders the default variant", () => {
    const { getByText } = render(<Badge>hi</Badge>);
    const el = getByText("hi");
    expect(el.tagName).toBe("SPAN");
    expect(el).toHaveClass("bg-primary");
    expect(el).toHaveAttribute("data-slot", "badge");
  });

  it("renders the success variant (canon parity with Rust)", () => {
    const { getByText } = render(<Badge variant="success">ok</Badge>);
    expect(getByText("ok")).toHaveClass("text-main-accent-t2");
  });

  it("lets className override the base", () => {
    const { getByText } = render(<Badge className="px-6">x</Badge>);
    const el = getByText("x");
    expect(el).toHaveClass("px-6");
    expect(el).not.toHaveClass("px-2");
  });

  it("renders as child when asChild", () => {
    const { getByRole } = render(
      <Badge asChild>
        <a href="#">link</a>
      </Badge>,
    );
    const el = getByRole("link");
    expect(el.tagName).toBe("A");
    expect(el).toHaveClass("bg-primary");
  });
});
