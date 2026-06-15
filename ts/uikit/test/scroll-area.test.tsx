import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ScrollArea, ScrollBar } from "../src/components/scroll-area";

describe("ScrollArea", () => {
  it("renders the viewport with native overflow and its children", () => {
    const { getByText, container } = render(<ScrollArea>body</ScrollArea>);
    expect(getByText("body")).toBeInTheDocument();
    const root = container.querySelector('[data-slot="scroll-area"]');
    expect(root).toHaveClass("relative");
    const viewport = container.querySelector(
      '[data-slot="scroll-area-viewport"]',
    );
    expect(viewport).toHaveClass("overflow-auto");
    expect(viewport).toHaveClass("size-full");
  });

  it("fuses a className override on the root", () => {
    const { container } = render(<ScrollArea className="h-40" />);
    expect(container.querySelector('[data-slot="scroll-area"]')).toHaveClass(
      "h-40",
    );
  });

  it("ScrollBar defaults to vertical and renders a thumb", () => {
    const { container } = render(<ScrollBar />);
    const bar = container.querySelector('[data-slot="scroll-area-scrollbar"]');
    expect(bar).toHaveAttribute("data-orientation", "vertical");
    expect(bar).toHaveClass("w-2.5");
    expect(
      container.querySelector('[data-slot="scroll-area-thumb"]'),
    ).toBeTruthy();
  });

  it("ScrollBar honours the horizontal orientation", () => {
    const { container } = render(<ScrollBar orientation="horizontal" />);
    const bar = container.querySelector('[data-slot="scroll-area-scrollbar"]');
    expect(bar).toHaveAttribute("data-orientation", "horizontal");
    expect(bar).toHaveClass("flex-col");
  });
});
