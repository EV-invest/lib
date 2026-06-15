import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemGroup,
  ItemSeparator,
  ItemHeader,
  ItemFooter,
} from "../src/components/item";

describe("Item", () => {
  it("renders the default variant and size", () => {
    const { getByText } = render(<Item>x</Item>);
    const el = getByText("x");
    expect(el.tagName).toBe("DIV");
    expect(el).toHaveClass("rounded-md");
    expect(el).toHaveAttribute("data-slot", "item");
    expect(el).toHaveAttribute("data-variant", "default");
    expect(el).toHaveAttribute("data-size", "default");
  });

  it("applies outline variant and sm size (canon parity with Rust)", () => {
    const { getByText } = render(
      <Item variant="outline" size="sm">
        x
      </Item>,
    );
    const el = getByText("x");
    expect(el).toHaveClass("border-border");
    expect(el).toHaveClass("gap-2.5");
    expect(el).toHaveAttribute("data-variant", "outline");
    expect(el).toHaveAttribute("data-size", "sm");
  });

  it("renders as child when asChild", () => {
    const { getByRole } = render(
      <Item asChild>
        <a href="#">link</a>
      </Item>,
    );
    const el = getByRole("link");
    expect(el.tagName).toBe("A");
    expect(el).toHaveClass("rounded-md");
  });

  it("renders the image media variant", () => {
    const { getByText } = render(<ItemMedia variant="image">m</ItemMedia>);
    const el = getByText("m");
    expect(el).toHaveClass("size-10");
    expect(el).toHaveAttribute("data-variant", "image");
  });

  it("separator wraps Separator with my-0", () => {
    const { container } = render(<ItemSeparator />);
    const el = container.querySelector("[data-slot=item-separator]")!;
    expect(el).toHaveClass("my-0");
    expect(el).toHaveAttribute("data-orientation", "horizontal");
  });

  it("renders the family parts with their slots", () => {
    const { getByText } = render(
      <>
        <ItemGroup>g</ItemGroup>
        <ItemContent>c</ItemContent>
        <ItemTitle>t</ItemTitle>
        <ItemDescription>d</ItemDescription>
        <ItemActions>a</ItemActions>
        <ItemHeader>h</ItemHeader>
        <ItemFooter>f</ItemFooter>
      </>,
    );
    expect(getByText("g")).toHaveAttribute("data-slot", "item-group");
    expect(getByText("c")).toHaveAttribute("data-slot", "item-content");
    expect(getByText("t")).toHaveAttribute("data-slot", "item-title");
    expect(getByText("d")).toHaveAttribute("data-slot", "item-description");
    expect(getByText("a")).toHaveAttribute("data-slot", "item-actions");
    expect(getByText("h")).toHaveAttribute("data-slot", "item-header");
    expect(getByText("f")).toHaveAttribute("data-slot", "item-footer");
  });
});
