import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "../src/components/skeleton";

describe("Skeleton", () => {
  it("renders the base classes and slot", () => {
    const { container } = render(<Skeleton data-testid="sk" />);
    const el = container.querySelector('[data-slot="skeleton"]')!;
    expect(el).toHaveClass("bg-accent");
    expect(el).toHaveClass("animate-pulse");
    expect(el).toHaveClass("rounded-md");
  });

  it("merges a className override", () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    const el = container.querySelector('[data-slot="skeleton"]')!;
    expect(el).toHaveClass("h-4");
    expect(el).toHaveClass("w-24");
  });
});
