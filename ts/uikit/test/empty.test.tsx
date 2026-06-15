import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "../src/components/empty";

describe("Empty", () => {
  it("renders the base and slot", () => {
    const { getByText } = render(<Empty>x</Empty>);
    const el = getByText("x");
    expect(el).toHaveClass("border-dashed");
    expect(el).toHaveAttribute("data-slot", "empty");
  });

  it("renders media default variant", () => {
    const { getByText } = render(<EmptyMedia>m</EmptyMedia>);
    const el = getByText("m");
    expect(el).toHaveClass("bg-transparent");
    expect(el).toHaveAttribute("data-slot", "empty-icon");
    expect(el).toHaveAttribute("data-variant", "default");
  });

  it("renders media icon variant (canon parity with Rust)", () => {
    const { getByText } = render(<EmptyMedia variant="icon">m</EmptyMedia>);
    const el = getByText("m");
    expect(el).toHaveClass("size-10");
    expect(el).toHaveAttribute("data-variant", "icon");
  });

  it("renders the family parts with their slots", () => {
    const { getByText } = render(
      <>
        <EmptyHeader>h</EmptyHeader>
        <EmptyTitle>t</EmptyTitle>
        <EmptyDescription>d</EmptyDescription>
        <EmptyContent>c</EmptyContent>
      </>,
    );
    expect(getByText("h")).toHaveAttribute("data-slot", "empty-header");
    expect(getByText("t")).toHaveAttribute("data-slot", "empty-title");
    expect(getByText("d")).toHaveAttribute("data-slot", "empty-description");
    expect(getByText("c")).toHaveAttribute("data-slot", "empty-content");
  });
});
