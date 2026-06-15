import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  ButtonGroup,
  ButtonGroupText,
  ButtonGroupSeparator,
} from "../src/components/button-group";

describe("ButtonGroup", () => {
  it("defaults to the horizontal orientation", () => {
    const { getByRole } = render(<ButtonGroup>a</ButtonGroup>);
    const el = getByRole("group");
    expect(el).toHaveAttribute("data-orientation", "horizontal");
    expect(el).toHaveAttribute("data-slot", "button-group");
  });

  it("applies the vertical orientation classes", () => {
    const { getByRole } = render(
      <ButtonGroup orientation="vertical">a</ButtonGroup>,
    );
    const el = getByRole("group");
    expect(el).toHaveClass("flex-col");
    expect(el).toHaveAttribute("data-orientation", "vertical");
  });

  it("renders text and separator slots", () => {
    const { getByText, container } = render(
      <ButtonGroup>
        <ButtonGroupText>ms</ButtonGroupText>
        <ButtonGroupSeparator />
      </ButtonGroup>,
    );
    expect(getByText("ms")).toHaveClass("bg-muted");
    expect(
      container.querySelector("[data-slot='button-group-separator']"),
    ).not.toBeNull();
  });
});
