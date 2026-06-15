import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "../src/components/hover-card";

describe("HoverCard", () => {
  it("hides its content until the trigger is hovered", () => {
    const { getByText, queryByText } = render(
      <HoverCard>
        <HoverCardTrigger>@user</HoverCardTrigger>
        <HoverCardContent>card</HoverCardContent>
      </HoverCard>,
    );
    expect(queryByText("card")).toBeNull();
    fireEvent.pointerEnter(getByText("@user"));
    expect(getByText("card")).toBeInTheDocument();
  });

  it("exposes data-slot and data-state on the open content", () => {
    const { getByText } = render(
      <HoverCard defaultOpen>
        <HoverCardTrigger>@user</HoverCardTrigger>
        <HoverCardContent>card</HoverCardContent>
      </HoverCard>,
    );
    const content = getByText("card");
    expect(content).toHaveAttribute("data-slot", "hover-card-content");
    expect(content).toHaveAttribute("data-state", "open");
  });

  it("reports changes through onOpenChange", () => {
    let last: boolean | undefined;
    const { getByText } = render(
      <HoverCard onOpenChange={(o) => (last = o)}>
        <HoverCardTrigger>@user</HoverCardTrigger>
        <HoverCardContent>card</HoverCardContent>
      </HoverCard>,
    );
    fireEvent.pointerEnter(getByText("@user"));
    expect(last).toBe(true);
  });
});
