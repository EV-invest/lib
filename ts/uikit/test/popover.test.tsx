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

  it("moves focus in on open, traps Tab, and returns focus to the trigger on close", () => {
    const { getByText, getByLabelText } = render(
      <Popover>
        <PopoverTrigger>open</PopoverTrigger>
        <PopoverContent>
          <input aria-label="a" />
          <input aria-label="b" />
        </PopoverContent>
      </Popover>,
    );
    const trigger = getByText("open");
    trigger.focus();
    fireEvent.click(trigger);
    const a = getByLabelText("a");
    const b = getByLabelText("b");
    expect(document.activeElement).toBe(a);
    b.focus();
    fireEvent.keyDown(b, { key: "Tab" });
    expect(document.activeElement).toBe(a);
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(trigger);
  });
});
