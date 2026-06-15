import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Checkbox } from "../src/components/checkbox";

describe("Checkbox", () => {
  it("renders unchecked by default with role and slot", () => {
    const { getByRole } = render(<Checkbox />);
    const el = getByRole("checkbox");
    expect(el).toHaveAttribute("data-slot", "checkbox");
    expect(el).toHaveAttribute("data-state", "unchecked");
    expect(el).toHaveAttribute("aria-checked", "false");
    expect(el).toHaveClass("rounded-[4px]");
  });

  it("shows the check indicator only when checked", () => {
    const { getByRole, container } = render(<Checkbox />);
    expect(container.querySelector('[data-slot="checkbox-indicator"]')).toBeNull();
    fireEvent.click(getByRole("checkbox"));
    const indicator = container.querySelector('[data-slot="checkbox-indicator"]')!;
    expect(indicator).not.toBeNull();
    expect(indicator.querySelector("path")).toHaveAttribute("d", "M20 6 9 17l-5-5");
  });

  it("toggles checked on click and fires onCheckedChange", () => {
    const seen: boolean[] = [];
    const { getByRole } = render(<Checkbox onCheckedChange={(c) => seen.push(c)} />);
    fireEvent.click(getByRole("checkbox"));
    expect(getByRole("checkbox")).toHaveAttribute("data-state", "checked");
    expect(seen).toEqual([true]);
  });

  it("honours a controlled checked prop", () => {
    const { getByRole } = render(<Checkbox checked />);
    expect(getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
  });
});
