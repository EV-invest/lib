import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { NavBadge, NavDot } from "../src/components/nav-badge";

describe("NavBadge", () => {
  it("shows the count up to the cap and `{max}+` past it", () => {
    const { container, rerender } = render(<NavBadge count={99} />);
    expect(container).toHaveTextContent("99");
    rerender(<NavBadge count={100} />);
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent("99+");
    rerender(<NavBadge count={12} max={9} />);
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent("9+");
  });

  it("speaks the real count, through an overridable label", () => {
    const { container, rerender } = render(<NavBadge count={150} />);
    expect(container.querySelector(".sr-only")).toHaveTextContent("150 new");
    rerender(<NavBadge count={150} label={(n) => `${n} непрочитанных`} />);
    expect(container.querySelector(".sr-only")).toHaveTextContent("150 непрочитанных");
  });

  it("draws nothing for zero", () => {
    const { container } = render(<NavBadge count={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("inverts on the marked row so it reads on the marker", () => {
    const { container } = render(<NavBadge count={3} active />);
    expect(container.firstChild).toHaveClass("bg-background", "text-ink");
  });
});

describe("NavDot", () => {
  it("is decoration without a label and spoken with one", () => {
    const { container, rerender } = render(<NavDot />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
    rerender(<NavDot tone="warn" label="Verification pending" />);
    expect(container.firstChild).not.toHaveAttribute("aria-hidden");
    expect(container.firstChild).toHaveClass("bg-accent-warn");
    expect(container).toHaveTextContent("Verification pending");
  });
});
