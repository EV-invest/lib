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

  describe("fuzzy matching, ranked as fzf ranks", () => {
    /// The rows a query leaves, in the order the arrows walk them.
    function check(values: string[], query: string, expected: string[]) {
      const { unmount } = render(
        <Command>
          <CommandInput placeholder="Search" />
          <CommandList>
            {values.map((v) => (
              <CommandItem key={v} value={v}>{v}</CommandItem>
            ))}
          </CommandList>
        </Command>,
      );
      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: query } });
      const walked: string[] = [];
      for (const _ of screen.queryAllByRole("option")) {
        walked.push(document.getElementById(input.getAttribute("aria-activedescendant")!)!.textContent!);
        fireEvent.keyDown(input, { key: "ArrowDown" });
      }
      unmount();
      expect(walked).toEqual(expected);
    }

    it("keeps any subsequence, case-insensitively", () => {
      check(["Apple", "Banana"], "BNA", ["Banana"]);
      check(["Apple", "Banana"], "pe", ["Apple"]);
      check(["Apple", "Banana"], "ea", []);
    });

    it("puts runs and word starts above scattered matches", () => {
      check(["gary.lee.nnn@xa.com", "glennamonitti@gmail.com"], "glenna", ["glennamonitti@gmail.com", "gary.lee.nnn@xa.com"]);
      check(["xmonx@a.com", "bob.mon@a.com"], "mon", ["bob.mon@a.com", "xmonx@a.com"]);
    });

    it("needs every space-separated term", () => {
      check(["ann@gmail.com", "ann@proton.me", "bo@gmail.com"], "ann gm", ["ann@gmail.com"]);
    });

    it("leaves ties in the caller's order", () => {
      check(["b@a.com", "a@a.com"], "@a", ["b@a.com", "a@a.com"]);
    });
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

  it("highlights the first row and selects it with Enter", () => {
    let selected = "";
    render(
      <Command>
        <CommandInput placeholder="Search" />
        <CommandList>
          <CommandItem value="Apple" onSelect={(v) => (selected = v)}>Apple</CommandItem>
          <CommandItem value="Banana" onSelect={(v) => (selected = v)}>Banana</CommandItem>
        </CommandList>
      </Command>,
    );
    const input = screen.getByRole("combobox");
    const apple = screen.getByRole("option", { name: "Apple" });
    expect(apple).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", apple.id);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(selected).toBe("Apple");
  });

  it("moves the highlight with the arrows, skipping disabled rows", () => {
    let selected = "";
    render(
      <Command>
        <CommandInput placeholder="Search" />
        <CommandList>
          <CommandItem value="Apple" onSelect={(v) => (selected = v)}>Apple</CommandItem>
          <CommandItem value="Banana" disabled onSelect={(v) => (selected = v)}>Banana</CommandItem>
          <CommandItem value="Cherry" onSelect={(v) => (selected = v)}>Cherry</CommandItem>
        </CommandList>
      </Command>,
    );
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const cherry = screen.getByRole("option", { name: "Cherry" });
    expect(input).toHaveAttribute("aria-activedescendant", cherry.id);
    // Clamped at the end rather than wrapping.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", cherry.id);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(selected).toBe("Cherry");
    // Home stays with the caret of the editable field.
    fireEvent.keyDown(input, { key: "Home" });
    expect(input).toHaveAttribute("aria-activedescendant", cherry.id);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(selected).toBe("Apple");
  });

  it("leaves keys from other focusables inside Command alone", () => {
    let selected = "";
    let clicked = false;
    render(
      <Command>
        <CommandInput placeholder="Search" />
        <CommandList>
          <CommandItem value="Apple" onSelect={(v) => (selected = v)}>Apple</CommandItem>
        </CommandList>
        <button type="button" onClick={() => (clicked = true)}>Create</button>
      </Command>,
    );
    const button = screen.getByRole("button", { name: "Create" });
    const enter = fireEvent.keyDown(button, { key: "Enter" });
    expect(enter).toBe(true); // not default-prevented
    expect(selected).toBe("");
    fireEvent.click(button);
    expect(clicked).toBe(true);
  });

  it("moves the highlight to the first match when the query changes", () => {
    let selected = "";
    render(
      <Command>
        <CommandInput placeholder="Search" />
        <CommandList>
          <CommandItem value="Apple" onSelect={(v) => (selected = v)}>Apple</CommandItem>
          <CommandItem value="Banana" onSelect={(v) => (selected = v)}>Banana</CommandItem>
        </CommandList>
      </Command>,
    );
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "ban" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(selected).toBe("Banana");
  });

  describe("with shouldFilter={false}", () => {
    function ServerResults({
      rows,
      onSelect,
    }: {
      rows: readonly string[];
      onSelect: (value: string) => void;
    }) {
      return (
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            {rows.map((row) => (
              <CommandItem key={row} value={row} onSelect={onSelect}>
                {row}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      );
    }

    it("shows every row whatever the query, in the caller's order", () => {
      render(<ServerResults rows={["Zeta", "Alpha"]} onSelect={() => {}} />);
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "no-such-text" } });
      expect(screen.getAllByRole("option").map((el) => el.textContent)).toEqual([
        "Zeta",
        "Alpha",
      ]);
      expect(screen.queryByText("No results.")).toBeNull();
    });

    it("selects the highlighted row with Enter", () => {
      let selected = "";
      render(<ServerResults rows={["Zeta", "Alpha"]} onSelect={(v) => (selected = v)} />);
      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "x" } });
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(selected).toBe("Alpha");
    });

    it("puts the highlight on the first row of results that arrive later", () => {
      let selected = "";
      const onSelect = (v: string) => (selected = v);
      const { rerender } = render(<ServerResults rows={["Old"]} onSelect={onSelect} />);
      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "ne" } });
      rerender(<ServerResults rows={["Newer", "Newest"]} onSelect={onSelect} />);
      fireEvent.keyDown(input, { key: "Enter" });
      expect(selected).toBe("Newer");
    });

    it("shows the empty state by the number of rows actually mounted", () => {
      const { rerender } = render(<ServerResults rows={["Alpha"]} onSelect={() => {}} />);
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "q" } });
      expect(screen.queryByText("No results.")).toBeNull();
      rerender(<ServerResults rows={[]} onSelect={() => {}} />);
      expect(screen.getByText("No results.")).toBeInTheDocument();
    });
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
