import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "../src/components/popover";

describe("Popover", () => {
  it("hides its content until the trigger is clicked", () => {
    const { getByText, queryByText } = render(
      <Popover>
        <PopoverTrigger>open</PopoverTrigger>
        <PopoverContent>panel</PopoverContent>
      </Popover>,
    );
    expect(queryByText("panel")).toBeNull();
    fireEvent.click(getByText("open"));
    expect(getByText("panel")).toBeInTheDocument();
  });

  it("respects defaultOpen and sets the content data-slot and data-state", () => {
    const { getByText } = render(
      <Popover defaultOpen>
        <PopoverTrigger>open</PopoverTrigger>
        <PopoverContent>panel</PopoverContent>
      </Popover>,
    );
    const content = getByText("panel");
    expect(content).toHaveAttribute("data-slot", "popover-content");
    expect(content).toHaveAttribute("data-state", "open");
  });

  it("reports changes through onOpenChange", () => {
    let last: boolean | undefined;
    const { getByText } = render(
      <Popover onOpenChange={(o) => (last = o)}>
        <PopoverTrigger>open</PopoverTrigger>
        <PopoverContent>panel</PopoverContent>
      </Popover>,
    );
    fireEvent.click(getByText("open"));
    expect(last).toBe(true);
  });
});
