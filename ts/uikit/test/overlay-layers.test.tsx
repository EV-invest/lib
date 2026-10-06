import * as React from "react";
import { flushSync } from "react-dom";
import { describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, screen, act } from "@testing-library/react";
import { Dialog, DialogContent, DialogTitle } from "../src/components/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "../src/components/drawer";
import { CommandDialog, CommandInput, CommandItem, CommandList, Command } from "../src/components/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../src/components/dropdown-menu";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "../src/components/context-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../src/components/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../src/components/select";
import { Toaster, toast } from "../src/components/sonner";

// Unlike dismissable-layer.test, the keys here start where the user's focus is
// and travel the whole way: through React's root (where an `onKeyDown` may
// close a layer and pop it from the stack mid-flight) and on to the document,
// where every layer's listener asks whether the Escape is its own (#162).
const escapeOn = (el: Element | Document) => act(() => void fireEvent.keyDown(el, { key: "Escape" }));

const dialog = () => document.querySelector('[data-slot="dialog-content"]');
const drawerState = () =>
  document.querySelector('[data-slot="drawer-content"]')?.getAttribute("data-state") ?? null;

function InDialog({ children }: { children: React.ReactNode }) {
  return (
    <Dialog defaultOpen>
      <DialogContent showCloseButton={false}>
        <DialogTitle>Edit</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function InDrawer({ children }: { children: React.ReactNode }) {
  return (
    <Drawer defaultOpen>
      <DrawerContent>
        <DrawerTitle>Allocation</DrawerTitle>
        <p>Panel body</p>
        {children}
      </DrawerContent>
    </Drawer>
  );
}

describe("Escape and outside clicks reach only the top overlay layer", () => {
  describe("a DropdownMenu in a Dialog", () => {
    it("closes the menu on an Escape from its item, the Dialog on the next", () => {
      render(
        <InDialog>
          <DropdownMenu>
            <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Rename</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </InDialog>,
      );
      fireEvent.click(screen.getByText("Actions"));
      escapeOn(screen.getByRole("menuitem", { name: "Rename" }));
      expect(screen.queryByRole("menu")).toBeNull();
      expect(dialog()).toBeInTheDocument();
      escapeOn(screen.getByText("Actions"));
      expect(dialog()).toBeNull();
    });
  });

  it("leaves the Dialog open when a handler on the way closes the top layer first", () => {
    // The worst case for a stack read at the document: the Popover is already
    // closed and popped (flushSync commits and runs effects at once) by the
    // time the Dialog's listener hears the same key.
    function Tree() {
      // Opened after the Dialog: a layer opened in the Dialog's own commit sits
      // below it (#162, step 2).
      const [open, setOpen] = React.useState(false);
      return (
        <InDialog>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger>Details</PopoverTrigger>
            <PopoverContent
              onKeyDown={(e) => {
                if (e.key === "Escape") flushSync(() => setOpen(false));
              }}
            >
              <button type="button">Inside the popover</button>
            </PopoverContent>
          </Popover>
        </InDialog>
      );
    }
    render(<Tree />);
    fireEvent.click(screen.getByText("Details"));
    escapeOn(screen.getByText("Inside the popover"));
    expect(screen.queryByText("Inside the popover")).toBeNull();
    expect(dialog()).toBeInTheDocument();
  });

  describe("a ContextMenu in a Dialog", () => {
    it("closes the menu on an Escape from its item and leaves the Dialog", () => {
      render(
        <InDialog>
          <ContextMenu>
            <ContextMenuTrigger>Row</ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem>Copy</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </InDialog>,
      );
      fireEvent.contextMenu(screen.getByText("Row"));
      escapeOn(screen.getByRole("menuitem", { name: "Copy" }));
      expect(screen.queryByRole("menu")).toBeNull();
      expect(dialog()).toBeInTheDocument();
    });
  });

  describe("a Popover in a Drawer", () => {
    const tree = (
      <InDrawer>
        <Popover>
          <PopoverTrigger>Pick a user</PopoverTrigger>
          <PopoverContent>
            <Command>
              <CommandInput placeholder="Search" />
              <CommandList>
                <CommandItem value="alice">Alice</CommandItem>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </InDrawer>
    );

    it("closes the Popover on an Escape in its search, the Drawer on the next", () => {
      render(tree);
      fireEvent.click(screen.getByText("Pick a user"));
      escapeOn(screen.getByPlaceholderText("Search"));
      expect(screen.queryByPlaceholderText("Search")).toBeNull();
      expect(drawerState()).toBe("open");
      escapeOn(screen.getByText("Pick a user"));
      expect(drawerState()).toBe("closed");
    });

    it("closes only the Popover on a pointer-down in the Drawer outside it", () => {
      render(tree);
      fireEvent.click(screen.getByText("Pick a user"));
      fireEvent.pointerDown(screen.getByText("Panel body"));
      expect(screen.queryByPlaceholderText("Search")).toBeNull();
      expect(drawerState()).toBe("open");
    });

    it("keeps both on a pointer-down inside the Popover", () => {
      render(tree);
      fireEvent.click(screen.getByText("Pick a user"));
      fireEvent.pointerDown(screen.getByRole("option", { name: "Alice" }));
      expect(screen.getByPlaceholderText("Search")).toBeInTheDocument();
      expect(drawerState()).toBe("open");
    });
  });

  describe("a Select in a Drawer", () => {
    it("closes the list on an Escape the document hears, the Drawer on the next", () => {
      render(
        <InDrawer>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Pick" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a">Apple</SelectItem>
            </SelectContent>
          </Select>
        </InDrawer>,
      );
      fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
      escapeOn(document);
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(drawerState()).toBe("open");
      escapeOn(document);
      expect(drawerState()).toBe("closed");
    });
  });

  describe("a Drawer opened from a Dialog", () => {
    function Tree() {
      const [open, setOpen] = React.useState(false);
      return (
        <InDialog>
          <button type="button" onClick={() => setOpen(true)}>
            Details
          </button>
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerContent>
              <DrawerTitle>Details</DrawerTitle>
              <p>Drawer body</p>
            </DrawerContent>
          </Drawer>
        </InDialog>
      );
    }

    it("takes the Escape from the Dialog, which takes the next", () => {
      render(<Tree />);
      fireEvent.click(screen.getByText("Details"));
      escapeOn(screen.getByText("Drawer body"));
      expect(drawerState()).toBe("closed");
      expect(dialog()).toBeInTheDocument();
      escapeOn(document);
      expect(dialog()).toBeNull();
    });

    it("is inside the Dialog for a pointer-down in its panel", () => {
      render(<Tree />);
      fireEvent.click(screen.getByText("Details"));
      fireEvent.pointerDown(screen.getByText("Drawer body"));
      expect(drawerState()).toBe("open");
      expect(dialog()).toBeInTheDocument();
    });
  });

  describe("a CommandDialog opened from a Dialog", () => {
    function Tree() {
      const [open, setOpen] = React.useState(false);
      return (
        <InDialog>
          <button type="button" onClick={() => setOpen(true)}>
            Jump to
          </button>
          <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Go to" />
            <CommandList>
              <CommandItem value="settings">Settings</CommandItem>
            </CommandList>
          </CommandDialog>
        </InDialog>
      );
    }

    it("closes the palette on an Escape in its field and leaves the Dialog", () => {
      render(<Tree />);
      fireEvent.click(screen.getByText("Jump to"));
      escapeOn(screen.getByPlaceholderText("Go to"));
      expect(screen.queryByPlaceholderText("Go to")).toBeNull();
      expect(dialog()).toBeInTheDocument();
    });

    it("keeps the Dialog on a pointer-down inside the palette", () => {
      render(<Tree />);
      fireEvent.click(screen.getByText("Jump to"));
      fireEvent.pointerDown(screen.getByPlaceholderText("Go to"));
      expect(screen.getByPlaceholderText("Go to")).toBeInTheDocument();
      expect(dialog()).toBeInTheDocument();
    });

    it("still closes on its own scrim", () => {
      render(<Tree />);
      fireEvent.click(screen.getByText("Jump to"));
      fireEvent.click(document.querySelector('[data-slot="command-overlay"]')!);
      expect(screen.queryByPlaceholderText("Go to")).toBeNull();
    });
  });

  describe("a toast over a Dialog", () => {
    afterEach(() => {
      act(() => {
        document.querySelectorAll('[data-slot="toast-close"]').forEach((b) => fireEvent.click(b));
      });
    });

    it("leaves the Escape to the Dialog, even from the toast's own button", () => {
      render(
        <>
          <Toaster />
          <InDialog>
            <p>Body</p>
          </InDialog>
        </>,
      );
      act(() => void toast("Saved"));
      const close = document.querySelector<HTMLElement>('[data-slot="toast-close"]')!;
      escapeOn(close);
      expect(dialog()).toBeNull();
      expect(screen.getByText("Saved")).toBeInTheDocument();
    });
  });
});
