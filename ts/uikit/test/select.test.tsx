import { describe, it, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
} from "../src/components/select";

function tree(props = {}) {
  return (
    <Select {...props}>
      <SelectTrigger>
        <SelectValue placeholder="Pick" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a">Apple</SelectItem>
        <SelectItem value="b">Banana</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe("Select", () => {
  it("shows the placeholder and hides options while closed", () => {
    render(tree());
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("Pick")).toHaveAttribute("data-placeholder", "true");
    expect(screen.queryByText("Apple")).toBeNull();
  });

  it("opens the listbox on trigger click", () => {
    render(tree());
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("sets the value and closes when an option is chosen", () => {
    render(tree({ defaultOpen: true }));
    fireEvent.click(screen.getByText("Banana"));
    expect(screen.queryByRole("listbox")).toBeNull();
    const value = document.querySelector('[data-slot="select-value"]')!;
    expect(value).toHaveTextContent("Banana");
    expect(value).not.toHaveAttribute("data-placeholder");
  });

  it("calls onValueChange with the chosen value", () => {
    let received = "";
    render(
      <Select defaultOpen onValueChange={(v) => (received = v)}>
        <SelectTrigger>
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Apple</SelectItem>
        </SelectContent>
      </Select>,
    );
    fireEvent.click(screen.getByText("Apple"));
    expect(received).toBe("a");
  });

  it("marks the selected option with aria-selected and a check", () => {
    render(tree({ defaultValue: "a", defaultOpen: true }));
    const option = screen.getByRole("option", { name: "Apple" });
    expect(option).toHaveAttribute("aria-selected", "true");
  });

  it("defaults the trigger to the md size", () => {
    render(tree());
    expect(screen.getByRole("combobox")).toHaveAttribute("data-size", "md");
  });

  it("shows the chosen item's label, not its value, before the popover ever opened", () => {
    render(tree({ defaultValue: "b" }));
    const value = document.querySelector('[data-slot="select-value"]')!;
    expect(value).toHaveTextContent("Banana");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("finds labels through groups and mapped arrays", () => {
    render(
      <Select defaultValue="pear">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {[
              ["apple", "Apple"],
              ["pear", "Pear"],
            ].map(([v, l]) => (
              <SelectItem key={v} value={v!}>
                {l}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>,
    );
    expect(document.querySelector('[data-slot="select-value"]')).toHaveTextContent("Pear");
  });

  it("learns the label of an item behind a wrapper component once it has mounted", () => {
    const Wrapped = ({ value, label }: { value: string; label: string }) => (
      <SelectItem value={value}>{label}</SelectItem>
    );
    render(
      <Select defaultOpen>
        <SelectTrigger>
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent>
          <Wrapped value="k" label="Kiwi" />
        </SelectContent>
      </Select>,
    );
    fireEvent.click(screen.getByRole("option", { name: "Kiwi" }));
    expect(document.querySelector('[data-slot="select-value"]')).toHaveTextContent("Kiwi");
  });

  it("lets SelectValue children replace the label", () => {
    render(
      <Select defaultValue="a">
        <SelectTrigger>
          <SelectValue>Custom</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Apple</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(document.querySelector('[data-slot="select-value"]')).toHaveTextContent("Custom");
  });
});
