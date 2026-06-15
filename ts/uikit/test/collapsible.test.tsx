import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "../src/components/collapsible";

describe("Collapsible", () => {
  it("hides its content until opened, then reveals it", () => {
    const { getByText, queryByText } = render(
      <Collapsible>
        <CollapsibleTrigger>toggle</CollapsibleTrigger>
        <CollapsibleContent>body</CollapsibleContent>
      </Collapsible>,
    );
    expect(queryByText("body")).toBeNull();
    fireEvent.click(getByText("toggle"));
    expect(getByText("body")).toBeInTheDocument();
  });

  it("respects defaultOpen and sets the open data-state", () => {
    const { getByText } = render(
      <Collapsible defaultOpen>
        <CollapsibleTrigger>toggle</CollapsibleTrigger>
        <CollapsibleContent>body</CollapsibleContent>
      </Collapsible>,
    );
    expect(getByText("body")).toHaveAttribute("data-slot", "collapsible-content");
    expect(getByText("toggle")).toHaveAttribute("data-state", "open");
    expect(getByText("toggle")).toHaveAttribute("aria-expanded", "true");
  });

  it("reports changes through onOpenChange", () => {
    let last: boolean | undefined;
    const { getByText } = render(
      <Collapsible onOpenChange={(o) => (last = o)}>
        <CollapsibleTrigger>toggle</CollapsibleTrigger>
        <CollapsibleContent>body</CollapsibleContent>
      </Collapsible>,
    );
    fireEvent.click(getByText("toggle"));
    expect(last).toBe(true);
  });
});
