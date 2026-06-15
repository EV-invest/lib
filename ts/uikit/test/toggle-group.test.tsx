import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ToggleGroup, ToggleGroupItem } from "../src/components/toggle-group";

describe("ToggleGroup", () => {
  it("renders the group slot and propagates variant/size to items", () => {
    const { getByText, container } = render(
      <ToggleGroup variant="outline" size="sm">
        <ToggleGroupItem value="a">A</ToggleGroupItem>
        <ToggleGroupItem value="b">B</ToggleGroupItem>
      </ToggleGroup>,
    );
    const group = container.querySelector('[data-slot="toggle-group"]')!;
    expect(group).toHaveAttribute("data-variant", "outline");
    const a = getByText("A");
    expect(a).toHaveAttribute("data-slot", "toggle-group-item");
    expect(a).toHaveAttribute("data-size", "sm");
    expect(a).toHaveClass("border-input");
  });

  it("single mode keeps one item selected at a time", () => {
    const { getByText } = render(
      <ToggleGroup type="single">
        <ToggleGroupItem value="a">A</ToggleGroupItem>
        <ToggleGroupItem value="b">B</ToggleGroupItem>
      </ToggleGroup>,
    );
    const a = getByText("A");
    const b = getByText("B");
    fireEvent.click(a);
    expect(a).toHaveAttribute("data-state", "on");
    fireEvent.click(b);
    expect(a).toHaveAttribute("data-state", "off");
    expect(b).toHaveAttribute("data-state", "on");
  });

  it("multiple mode allows several selected", () => {
    const { getByText } = render(
      <ToggleGroup type="multiple">
        <ToggleGroupItem value="a">A</ToggleGroupItem>
        <ToggleGroupItem value="b">B</ToggleGroupItem>
      </ToggleGroup>,
    );
    fireEvent.click(getByText("A"));
    fireEvent.click(getByText("B"));
    expect(getByText("A")).toHaveAttribute("data-state", "on");
    expect(getByText("B")).toHaveAttribute("data-state", "on");
  });
});
