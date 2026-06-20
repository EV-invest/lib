import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Container } from "../src/components/container";

describe("Container", () => {
  it("applies the token-driven gutter and max width", () => {
    const { getByText } = render(<Container>x</Container>);
    const el = getByText("x");
    expect(el.tagName).toBe("DIV");
    expect(el).toHaveAttribute("data-slot", "container");
    expect(el).toHaveClass("mx-auto");
    expect(el).toHaveClass("max-w-[var(--page-max,90rem)]");
    expect(el).toHaveClass("px-[var(--page-px,1rem)]");
  });

  it("lets a className override win (canon parity with Rust)", () => {
    const { getByText } = render(
      <Container className="max-w-3xl">y</Container>,
    );
    expect(getByText("y")).toHaveClass("max-w-3xl");
  });
});
