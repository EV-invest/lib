import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Tooltip, TooltipTrigger, TooltipContent } from "../src/components/tooltip";

describe("Tooltip", () => {
  it("hides its content until the trigger is hovered", () => {
    const { getByText, queryByText } = render(
      <Tooltip>
        <TooltipTrigger>hover me</TooltipTrigger>
        <TooltipContent>tip</TooltipContent>
      </Tooltip>,
    );
    expect(queryByText("tip")).toBeNull();
    fireEvent.pointerEnter(getByText("hover me"));
    expect(getByText("tip")).toBeInTheDocument();
  });

  it("opens on focus and exposes data-slot, role and data-state", () => {
    const { getByText } = render(
      <Tooltip>
        <TooltipTrigger>hover me</TooltipTrigger>
        <TooltipContent>tip</TooltipContent>
      </Tooltip>,
    );
    fireEvent.focus(getByText("hover me"));
    const content = getByText("tip");
    expect(content).toHaveAttribute("data-slot", "tooltip-content");
    expect(content).toHaveAttribute("role", "tooltip");
    expect(content).toHaveAttribute("data-state", "open");
  });

  it("reports changes through onOpenChange", () => {
    let last: boolean | undefined;
    const { getByText } = render(
      <Tooltip onOpenChange={(o) => (last = o)}>
        <TooltipTrigger>hover me</TooltipTrigger>
        <TooltipContent>tip</TooltipContent>
      </Tooltip>,
    );
    fireEvent.pointerEnter(getByText("hover me"));
    expect(last).toBe(true);
  });
});
