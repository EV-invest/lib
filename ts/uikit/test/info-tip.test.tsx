import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import {
  InfoTip,
  InfoTipTrigger,
  InfoTipContent,
} from "../src/components/info-tip";

describe("InfoTip", () => {
  it("hides its bubble until the trigger is clicked, then toggles", () => {
    const { getByRole, getByText, queryByText } = render(
      <InfoTip>
        <InfoTipTrigger label="About network" />
        <InfoTipContent>Pick the chain.</InfoTipContent>
      </InfoTip>,
    );
    expect(queryByText("Pick the chain.")).toBeNull();
    const trigger = getByRole("button", { name: "About network" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(getByText("Pick the chain.")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(trigger);
    expect(queryByText("Pick the chain.")).toBeNull();
  });

  it("wires toggletip a11y — role=status live region, aria-controls, never role=tooltip", () => {
    const { getByRole, getByText } = render(
      <InfoTip defaultOpen>
        <InfoTipTrigger label="About" />
        <InfoTipContent>help</InfoTipContent>
      </InfoTip>,
    );
    const content = getByText("help");
    expect(content).toHaveAttribute("role", "status");
    expect(content).toHaveAttribute("aria-live", "polite");
    expect(content).not.toHaveAttribute("role", "tooltip");
    expect(content).toHaveAttribute("data-slot", "info-tip-content");
    expect(content).toHaveAttribute("data-state", "open");
    const trigger = getByRole("button", { name: "About" });
    expect(trigger.getAttribute("aria-controls")).toBe(
      content.getAttribute("id"),
    );
  });

  it("closes on Escape", () => {
    const { getByText, queryByText } = render(
      <InfoTip defaultOpen>
        <InfoTipTrigger label="About" />
        <InfoTipContent>help</InfoTipContent>
      </InfoTip>,
    );
    expect(getByText("help")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(queryByText("help")).toBeNull();
  });

  it("reports changes through onOpenChange", () => {
    let last: boolean | undefined;
    const { getByRole } = render(
      <InfoTip onOpenChange={o => (last = o)}>
        <InfoTipTrigger label="About" />
        <InfoTipContent>help</InfoTipContent>
      </InfoTip>,
    );
    fireEvent.click(getByRole("button", { name: "About" }));
    expect(last).toBe(true);
  });
});
