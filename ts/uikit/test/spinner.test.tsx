import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Spinner } from "../src/components/spinner";

describe("Spinner", () => {
  it("renders a status svg with the base classes", () => {
    const { getByRole } = render(<Spinner />);
    const el = getByRole("status");
    expect(el.tagName.toLowerCase()).toBe("svg");
    expect(el).toHaveAttribute("aria-label", "Loading");
    expect(el).toHaveClass("size-4", "animate-spin");
    expect(el.querySelector("path")).toHaveAttribute(
      "d",
      "M21 12a9 9 0 1 1-6.219-8.56",
    );
  });

  it("lets className override the base", () => {
    const { getByRole } = render(<Spinner className="size-8" />);
    const el = getByRole("status");
    expect(el).toHaveClass("size-8");
    expect(el).not.toHaveClass("size-4");
  });
});
