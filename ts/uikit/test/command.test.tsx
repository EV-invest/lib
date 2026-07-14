import { describe, it, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
  CommandDialog,
} from "../src/components/command";

describe("Command", () => {
  it("shows all items before any query", () => {
    render(
      <Command>
        <CommandInput placeholder="Search" />
        <CommandList>
          <CommandItem value="Apple">Apple</CommandItem>
          <CommandItem value="Banana">Banana</CommandItem>
        </CommandList>
      </Command>,
    );
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Banana")).toBeInTheDocument();
  });

  it("filters items by case-insensitive substring", () => {
    render(
      <Command>
        <CommandInput placeholder="Search" />
        <CommandList>
          <CommandItem value="Apple">Apple</CommandItem>
          <CommandItem value="Banana">Banana</CommandItem>
        </CommandList>
      </Command>,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "ban" } });
    expect(screen.getByText("Banana")).toBeInTheDocument();
    expect(screen.queryByText("Apple")).toBeNull();
  });

  it("shows the empty state only when a query matches nothing", () => {
    render(
      <Command>
        <CommandInput placeholder="Search" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandItem value="Apple">Apple</CommandItem>
        </CommandList>
      </Command>,
    );
    const input = screen.getByRole("combobox");
    expect(screen.queryByText("No results.")).toBeNull();

    // A query that matches must not raise the empty state next to its result.
    fireEvent.change(input, { target: { value: "app" } });
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.queryByText("No results.")).toBeNull();

    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.getByText("No results.")).toBeInTheDocument();
    expect(screen.queryByText("Apple")).toBeNull();

    // Clearing the query puts the list back and hides the empty state again.
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.queryByText("No results.")).toBeNull();
  });

  it("counts a match nested in a group", () => {
    render(
      <Command>
        <CommandInput placeholder="Search" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Pages">
            <CommandItem value="settings">Settings</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "set" } });
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.queryByText("No results.")).toBeNull();
  });

  it("shows the empty state for a query with no items at all", () => {
    render(
      <Command defaultSearch="zzz">
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
        </CommandList>
      </Command>,
    );
    expect(screen.getByText("No results.")).toBeInTheDocument();
  });

  it("treats blank input as no query", () => {
    render(
      <Command>
        <CommandInput placeholder="Search" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandItem value="Apple">Apple</CommandItem>
        </CommandList>
      </Command>,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "   " } });
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.queryByText("No results.")).toBeNull();
  });

  it("calls onSelect with the item value on click", () => {
    let selected = "";
    render(
      <Command>
        <CommandList>
          <CommandGroup heading="Fruit">
            <CommandItem value="Apple" onSelect={(v) => (selected = v)}>
              Apple
              <CommandShortcut>A</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
        </CommandList>
      </Command>,
    );
    expect(screen.getByText("Fruit")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Apple"));
    expect(selected).toBe("Apple");
  });

  it("does not select a disabled item", () => {
    let selected = "";
    render(
      <Command>
        <CommandList>
          <CommandItem value="Apple" disabled onSelect={(v) => (selected = v)}>
            Apple
          </CommandItem>
        </CommandList>
      </Command>,
    );
    fireEvent.click(screen.getByText("Apple"));
    expect(selected).toBe("");
  });

  it("renders the dialog only when open", () => {
    const { rerender } = render(
      <CommandDialog>
        <CommandInput placeholder="Search" />
      </CommandDialog>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(
      <CommandDialog open>
        <CommandInput placeholder="Search" />
      </CommandDialog>,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });
});
