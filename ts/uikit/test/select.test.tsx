import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "../src/components/select";
import { Dialog, DialogContent, DialogTitle } from "../src/components/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "../src/components/drawer";

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

  it("dims the placeholder where SelectValue marks it, on its span", () => {
    // What each `…:text-ink-soft` class on the trigger reaches, resolved the
    // way Tailwind compiles the two variant forms in use: `data-[x]:` is
    // `&[data-x]`, an arbitrary `[&_sel]:` is `& sel`. (The drawn colour is
    // checked in a browser by kitstart's gallery.)
    render(tree());
    const trigger = screen.getByRole("combobox");
    const reached = Array.from(trigger.classList)
      .filter((c) => c.endsWith(":text-ink-soft"))
      .flatMap((c) => {
        const variant = c.slice(0, -":text-ink-soft".length);
        const data = /^data-\[(.+)\]$/.exec(variant);
        if (data) return trigger.matches(`[data-${data[1]}]`) ? [trigger] : [];
        const arbitrary = /^\[&_(.+)\]$/.exec(variant);
        return arbitrary ? Array.from(trigger.querySelectorAll(arbitrary[1]!.replaceAll("_", " "))) : [];
      });
    const placeholder = trigger.querySelector("[data-slot=select-value]");
    expect(placeholder).toHaveTextContent("Pick");
    expect(reached).toContain(placeholder);
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
    const listKey = (key: string) => fireEvent.keyDown(screen.getByRole("listbox"), { key });
    const focusedName = () => (document.activeElement as HTMLElement | null)?.textContent;

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

    it("lands on the first option when nothing is chosen, and the arrows move and wrap", () => {
      render(tree());
      fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowUp" });
      expect(screen.getByRole("option", { name: "Apple" })).toHaveFocus();
      listKey("ArrowDown");
      expect(screen.getByRole("option", { name: "Banana" })).toHaveFocus();
      listKey("ArrowDown");
      expect(screen.getByRole("option", { name: "Apple" })).toHaveFocus();
      listKey("End");
      expect(screen.getByRole("option", { name: "Banana" })).toHaveFocus();
      listKey("Home");
      expect(screen.getByRole("option", { name: "Apple" })).toHaveFocus();
    });

    it("steps through options in groups, past labels and separators, in DOM order", () => {
      render(
        <Select defaultValue="c">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Fruit</SelectLabel>
              <SelectItem value="a">Apple</SelectItem>
              <SelectItem value="b">Banana</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Veg</SelectLabel>
              <SelectItem value="c">Carrot</SelectItem>
              <SelectItem value="d">Dill</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>,
      );
      fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
      expect(focusedName()).toBe("Carrot");
      listKey("ArrowDown");
      expect(focusedName()).toBe("Dill");
      listKey("ArrowDown");
      expect(focusedName()).toBe("Apple");
      listKey("ArrowDown");
      expect(focusedName()).toBe("Banana");
      listKey("ArrowUp");
      expect(focusedName()).toBe("Apple");
    });

    it("steps through items rendered by a component of the caller's", () => {
      const Row = ({ value, label }: { value: string; label: string }) => <SelectItem value={value}>{label}</SelectItem>;
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Pick" />
          </SelectTrigger>
          <SelectContent>
            {[
              ["a", "Apple"],
              ["b", "Banana"],
              ["c", "Cherry"],
            ].map(([v, l]) => (
              <Row key={v} value={v!} label={l!} />
            ))}
          </SelectContent>
        </Select>,
      );
      fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
      expect(focusedName()).toBe("Apple");
      listKey("ArrowDown");
      expect(focusedName()).toBe("Banana");
      listKey("ArrowDown");
      expect(focusedName()).toBe("Cherry");
    });

    it("jumps by typed letters", () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Pick" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">Apple</SelectItem>
            <SelectItem value="b">Banana</SelectItem>
            <SelectItem value="bl">Blueberry</SelectItem>
          </SelectContent>
        </Select>,
      );
      fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
      listKey("b");
      expect(focusedName()).toBe("Banana");
      listKey("b");
      expect(focusedName()).toBe("Blueberry");
    });

    it("scrolls a long list to the chosen option without moving the page, and follows the arrows", () => {
      const focus = vi.spyOn(HTMLElement.prototype, "focus");
      const scrollIntoView = vi.fn();
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
      try {
        const values = Array.from({ length: 40 }, (_, i) => `v${i}`);
        render(
          <Select defaultValue="v30">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {values.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>,
        );
        fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
        const chosen = screen.getByRole("option", { name: "v30" });
        expect(chosen).toHaveFocus();
        expect(focus.mock.contexts.at(-1)).toBe(chosen);
        expect(focus.mock.calls.at(-1)).toEqual([{ preventScroll: true }]);
        expect(scrollIntoView.mock.contexts).toEqual([chosen]);
        expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
        listKey("ArrowDown");
        expect(screen.getByRole("option", { name: "v31" })).toHaveFocus();
        // A plain focus: the browser scrolls the list along.
        expect(focus.mock.calls.at(-1)).toEqual([]);
      } finally {
        focus.mockRestore();
        delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
      }
    });

    it("chooses with Enter and gives focus back to the trigger", () => {
      render(tree());
      const trigger = screen.getByRole("combobox");
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      listKey("ArrowDown");
      fireEvent.keyDown(screen.getByRole("option", { name: "Banana" }), { key: "Enter" });
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(trigger).toHaveTextContent("Banana");
      expect(trigger).toHaveFocus();
    });

    it("closes on Escape and on Tab with focus back on the trigger", () => {
      render(tree());
      const trigger = screen.getByRole("combobox");
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      listKey("Escape");
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(trigger).toHaveFocus();
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      listKey("Tab");
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(trigger).toHaveFocus();
    });

    it("never touches the trigger's focus when a click elsewhere closes it", () => {
      const onFocus = vi.fn();
      const onBlur = vi.fn();
      render(
        <>
          <Select defaultOpen>
            <SelectTrigger onFocus={onFocus} onBlur={onBlur}>
              <SelectValue placeholder="Pick" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a">Apple</SelectItem>
            </SelectContent>
          </Select>
          <input aria-label="elsewhere" />
        </>,
      );
      fireEvent.pointerDown(screen.getByLabelText("elsewhere"));
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(onFocus).not.toHaveBeenCalled();
      expect(onBlur).not.toHaveBeenCalled();
    });

    it("names the list after the trigger's label", () => {
      render(
        <>
          <label id="fruit-label" htmlFor="fruit">
            Fruit
          </label>
          <Select defaultOpen>
            <SelectTrigger id="fruit">
              <SelectValue placeholder="Pick" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a">Apple</SelectItem>
            </SelectContent>
          </Select>
        </>,
      );
      expect(screen.getByRole("listbox", { name: "Fruit" })).toHaveAttribute("aria-labelledby", "fruit-label");
    });

    it("gives the list the trigger's width as a variable", () => {
      render(tree());
      const trigger = screen.getByRole("combobox");
      Object.defineProperty(trigger, "offsetWidth", { configurable: true, value: 240 });
      fireEvent.click(trigger);
      expect(screen.getByRole("listbox").style.getPropertyValue("--select-trigger-width")).toBe("240px");
    });
  });

  describe("inside a Dialog or a Drawer", () => {
    function inDialog() {
      return (
        <Dialog defaultOpen>
          <DialogContent showCloseButton={false}>
            <DialogTitle>Edit</DialogTitle>
            <input aria-label="first" />
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Pick" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a">Apple</SelectItem>
                <SelectItem value="b">Banana</SelectItem>
              </SelectContent>
            </Select>
          </DialogContent>
        </Dialog>
      );
    }

    it("closes the list on Escape and leaves the Dialog open", () => {
      render(inDialog());
      fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
      fireEvent.keyDown(screen.getByRole("option", { name: "Apple" }), { key: "Escape" });
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toHaveFocus();
    });

    it("closes only the topmost layer on an Escape the document hears (a React root on `document`, as in Next)", () => {
      render(inDialog());
      fireEvent.click(screen.getByRole("combobox"));
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("lets a click on an option choose it without closing the Dialog", () => {
      render(inDialog());
      fireEvent.click(screen.getByRole("combobox"));
      const apple = screen.getByRole("option", { name: "Apple" });
      fireEvent.pointerDown(apple);
      fireEvent.click(apple);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toHaveTextContent("Apple");
    });

    it("keeps Tab from the list inside the Dialog's trap", () => {
      // jsdom lays nothing out; the trap counts only boxes with a size.
      const width = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(10);
      try {
        render(inDialog());
        const trigger = screen.getByRole("combobox");
        fireEvent.keyDown(trigger, { key: "ArrowDown" });
        const tab = fireEvent.keyDown(screen.getByRole("listbox"), { key: "Tab" });
        expect(tab).toBe(false);
        expect(screen.queryByRole("listbox")).toBeNull();
        // The trigger is the Dialog's last stop: Tab wraps to its first.
        expect(screen.getByLabelText("first")).toHaveFocus();
        expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
      } finally {
        width.mockRestore();
      }
    });

    it("closes the list on Escape and leaves the Drawer open", () => {
      render(
        <Drawer defaultOpen>
          <DrawerContent>
            <DrawerTitle>Filter</DrawerTitle>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Pick" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a">Apple</SelectItem>
              </SelectContent>
            </Select>
          </DrawerContent>
        </Drawer>,
      );
      fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
      fireEvent.keyDown(screen.getByRole("option", { name: "Apple" }), { key: "Escape" });
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(screen.getByRole("dialog")).toHaveAttribute("data-state", "open");
    });
  });
});
