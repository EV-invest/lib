import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Switch } from "../src/components/switch";

describe("Switch", () => {
  it("renders unchecked by default with role and slot", () => {
    const { getByRole } = render(<Switch />);
    const el = getByRole("switch");
    expect(el).toHaveAttribute("data-slot", "switch");
    expect(el).toHaveAttribute("data-state", "unchecked");
    expect(el).toHaveAttribute("aria-checked", "false");
    expect(el).toHaveClass("rounded-full");
  });

  it("renders the thumb with translate classes", () => {
    const { container } = render(<Switch />);
    const thumb = container.querySelector('[data-slot="switch-thumb"]')!;
    expect(thumb).toHaveClass("data-[state=checked]:translate-x-[calc(100%-2px)]");
  });

  it("toggles checked on click and fires onCheckedChange", () => {
    const seen: boolean[] = [];
    const { getByRole } = render(<Switch onCheckedChange={(c) => seen.push(c)} />);
    const el = getByRole("switch");
    fireEvent.click(el);
    expect(el).toHaveAttribute("data-state", "checked");
    expect(seen).toEqual([true]);
  });

  it("honours a controlled checked prop", () => {
    const { getByRole } = render(<Switch checked />);
    expect(getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });
});
