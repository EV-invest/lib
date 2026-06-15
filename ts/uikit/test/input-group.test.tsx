import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
} from "../src/components/input-group";

describe("InputGroup", () => {
  it("renders the base, slot and role", () => {
    const { getByRole } = render(<InputGroup>x</InputGroup>);
    const el = getByRole("group");
    expect(el).toHaveClass("group/input-group");
    expect(el).toHaveAttribute("data-slot", "input-group");
  });

  it("drops dark variants (canon parity with Rust)", () => {
    const { getByRole } = render(<InputGroup>x</InputGroup>);
    const el = getByRole("group");
    expect(el.className).not.toContain("dark:");
  });

  it("renders the addon with its default align", () => {
    const { container } = render(<InputGroupAddon>a</InputGroupAddon>);
    const el = container.querySelector("[data-slot=input-group-addon]")!;
    expect(el).toHaveClass("order-first");
    expect(el).toHaveAttribute("data-align", "inline-start");
  });

  it("renders the addon block-end align (canon)", () => {
    const { container } = render(
      <InputGroupAddon align="block-end">a</InputGroupAddon>,
    );
    const el = container.querySelector("[data-slot=input-group-addon]")!;
    expect(el).toHaveClass("order-last");
    expect(el).toHaveAttribute("data-align", "block-end");
  });

  it("renders the button with ghost variant and xs size", () => {
    const { getByRole } = render(<InputGroupButton>b</InputGroupButton>);
    const el = getByRole("button");
    expect(el).toHaveClass("h-6");
    expect(el).toHaveClass("hover:bg-accent");
    expect(el).toHaveAttribute("data-size", "xs");
  });

  it("renders text, input and textarea controls", () => {
    const { getByText, container } = render(
      <>
        <InputGroupText>t</InputGroupText>
        <InputGroupInput placeholder="i" />
        <InputGroupTextarea placeholder="ta" />
      </>,
    );
    expect(getByText("t").tagName).toBe("SPAN");
    const controls = container.querySelectorAll(
      "[data-slot=input-group-control]",
    );
    expect(controls.length).toBe(2);
    expect(controls[0]!.className).not.toContain("dark:");
  });
});
