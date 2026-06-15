import { describe, it, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
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
    expect(value).toHaveTextContent("b");
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
    const option = screen.getByText("Apple").closest('[role="option"]')!;
    expect(option).toHaveAttribute("aria-selected", "true");
  });

  it("supports the sm trigger size", () => {
    render(tree());
    expect(screen.getByRole("combobox")).toHaveAttribute("data-size", "default");
  });
});
