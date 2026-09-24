import { describe, it, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
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

  it("sizes the trigger from the shared form scale", () => {
    const { unmount } = render(tree());
    expect(screen.getByRole("combobox")).toHaveClass("h-9", "rounded-[var(--control-radius)]");
    unmount();
    render(
      <Select>
        <SelectTrigger size="lg">
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
      </Select>,
    );
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("data-size", "lg");
    expect(trigger).toHaveClass("h-12", "px-4", "text-base");
    expect(trigger).not.toHaveClass("text-sm");
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

  it("walks past children that are not elements (an i18n object, a render function)", () => {
    // what i18next's <Trans> leaves in the tree: an interpolation object
    const Trans = ({ children }: { children?: unknown }) => <>{String((children as { count?: number })?.count)}</>;
    const Fn = ({ children }: { children?: unknown }) => <>{typeof children === "function" ? "fn" : null}</>;
    render(
      <Select defaultValue="a">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectLabel>
            <Trans>{{ count: 3 } as unknown as React.ReactNode}</Trans>
          </SelectLabel>
          <Fn>{(() => null) as unknown as React.ReactNode}</Fn>
          <SelectItem value="a">Apple</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(document.querySelector('[data-slot="select-value"]')).toHaveTextContent("Apple");
  });

  it("shows an item's text, not its markup, so no id inside it is rendered twice", () => {
    render(
      <Select defaultValue="a" defaultOpen>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">
            <span id="apple-flag">🍎</span> Apple
          </SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(document.querySelectorAll("#apple-flag")).toHaveLength(1);
    expect(document.querySelector('[data-slot="select-value"]')).toHaveTextContent("🍎 Apple");
  });

  it("shows textValue when the item gives one", () => {
    render(
      <Select defaultValue="fr">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="fr" textValue="France">
            France <small>+33</small>
          </SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(document.querySelector('[data-slot="select-value"]')).toHaveTextContent(/^France$/);
  });

  it("updates the trigger when a wrapped item's label is first learnt, without a new selection", () => {
    const Wrapped = () => <SelectItem value="k">Kiwi</SelectItem>;
    render(
      <Select defaultValue="k">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <Wrapped />
        </SelectContent>
      </Select>,
    );
    const value = document.querySelector('[data-slot="select-value"]')!;
    expect(value).toHaveTextContent("k");
    fireEvent.click(screen.getByRole("combobox"));
    expect(value).toHaveTextContent("Kiwi");
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

  describe("keyboard", () => {
    it("opens on ArrowDown and lands on the chosen option", () => {
      render(tree({ defaultValue: "b" }));
      const trigger = screen.getByRole("combobox");
      expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
      trigger.focus();
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      const listbox = screen.getByRole("listbox");
      expect(trigger).toHaveAttribute("aria-controls", listbox.id);
      expect(screen.getByRole("option", { name: "Banana" })).toHaveFocus();
    });

    it("lands on the first option when nothing is chosen, and the arrows move", () => {
      render(tree());
      const trigger = screen.getByRole("combobox");
      fireEvent.keyDown(trigger, { key: "ArrowUp" });
      expect(screen.getByRole("option", { name: "Apple" })).toHaveFocus();
      fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowDown" });
      expect(screen.getByRole("option", { name: "Banana" })).toHaveFocus();
    });

    it("chooses with Enter and gives focus back to the trigger", () => {
      render(tree());
      const trigger = screen.getByRole("combobox");
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowDown" });
      fireEvent.keyDown(screen.getByRole("option", { name: "Banana" }), { key: "Enter" });
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(trigger).toHaveTextContent("Banana");
      expect(trigger).toHaveFocus();
    });

    it("closes on Escape and on Tab with focus back on the trigger", () => {
      render(tree());
      const trigger = screen.getByRole("combobox");
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(trigger).toHaveFocus();
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      fireEvent.keyDown(screen.getByRole("listbox"), { key: "Tab" });
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(trigger).toHaveFocus();
    });

    it("gives the list the trigger's width as a variable", () => {
      render(tree());
      const trigger = screen.getByRole("combobox");
      Object.defineProperty(trigger, "offsetWidth", { configurable: true, value: 240 });
      fireEvent.click(trigger);
      expect(screen.getByRole("listbox").style.getPropertyValue("--select-trigger-width")).toBe("240px");
    });

    it("leaves focus where a click outside put it", () => {
      render(
        <>
          {tree({ defaultOpen: true })}
          <input aria-label="elsewhere" />
        </>,
      );
      const elsewhere = screen.getByLabelText("elsewhere");
      fireEvent.pointerDown(elsewhere);
      elsewhere.focus();
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(elsewhere).toHaveFocus();
    });
  });
});
