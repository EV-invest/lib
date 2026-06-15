import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { RadioGroup, RadioGroupItem } from "../src/components/radio-group";

describe("RadioGroup", () => {
  it("renders role, slot and base classes", () => {
    const { getByRole } = render(
      <RadioGroup defaultValue="a">
        <RadioGroupItem value="a" />
        <RadioGroupItem value="b" />
      </RadioGroup>,
    );
    const group = getByRole("radiogroup");
    expect(group).toHaveAttribute("data-slot", "radio-group");
    expect(group).toHaveClass("grid");
    expect(group).toHaveClass("gap-3");
  });

  it("marks the default item checked with an indicator", () => {
    const { getAllByRole } = render(
      <RadioGroup defaultValue="a">
        <RadioGroupItem value="a" />
        <RadioGroupItem value="b" />
      </RadioGroup>,
    );
    const radios = getAllByRole("radio");
    const a = radios[0]!;
    const b = radios[1]!;
    expect(a).toHaveAttribute("data-state", "checked");
    expect(a).toHaveAttribute("aria-checked", "true");
    expect(b).toHaveAttribute("data-state", "unchecked");
    expect(a.querySelector('[data-slot="radio-group-indicator"]')).not.toBeNull();
    expect(b.querySelector('[data-slot="radio-group-indicator"]')).toBeNull();
  });

  it("selects on click (uncontrolled) and fires onValueChange", () => {
    const seen: string[] = [];
    const { getAllByRole } = render(
      <RadioGroup defaultValue="a" onValueChange={(v) => seen.push(v)}>
        <RadioGroupItem value="a" />
        <RadioGroupItem value="b" />
      </RadioGroup>,
    );
    const b = getAllByRole("radio")[1]!;
    fireEvent.click(b);
    expect(seen).toEqual(["b"]);
    expect(b).toHaveAttribute("data-state", "checked");
  });

  it("stays controlled when value is provided", () => {
    const { getAllByRole } = render(
      <RadioGroup value="a">
        <RadioGroupItem value="a" />
        <RadioGroupItem value="b" />
      </RadioGroup>,
    );
    const b = getAllByRole("radio")[1]!;
    fireEvent.click(b);
    expect(b).toHaveAttribute("data-state", "unchecked");
  });

  it("item className override merges over the base", () => {
    const { getByRole } = render(
      <RadioGroup defaultValue="a">
        <RadioGroupItem value="a" className="size-6" />
      </RadioGroup>,
    );
    const item = getByRole("radio");
    expect(item).toHaveClass("size-6");
    expect(item).not.toHaveClass("size-4");
  });
});
