import * as React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Section, SectionHead } from "../src/components/band";

describe("Section", () => {
  it("sets the scope class and its plane", () => {
    const { container } = render(
      <Section polarity="dark" surface="card" id="quote">
        body
      </Section>,
    );
    const el = container.querySelector('[data-slot="section"]')!;
    expect(el).toHaveClass("dark");
    expect(el).toHaveClass("bg-card");
    expect(el).toHaveClass("text-ink");
    expect(el).toHaveClass("py-[var(--band-py)]");
    expect(el).toHaveAttribute("id", "quote");
  });

  it("takes the short rhythm when tight", () => {
    const { container } = render(<Section tight>body</Section>);
    expect(container.querySelector('[data-slot="section"]')).toHaveClass(
      "py-[var(--band-py-tight)]",
    );
  });
});

describe("SectionHead", () => {
  it("renders the lede only when given", () => {
    const { getByText, queryByText, rerender } = render(
      <SectionHead eyebrow="PRICES" title="Fixed, agreed first" lede="No surprises." />,
    );
    expect(getByText("PRICES")).toBeInTheDocument();
    expect(getByText("Fixed, agreed first")).toBeInTheDocument();
    expect(getByText("No surprises.")).toBeInTheDocument();

    rerender(<SectionHead eyebrow="PRICES" title="Fixed, agreed first" />);
    expect(queryByText("No surprises.")).toBeNull();
  });
});
