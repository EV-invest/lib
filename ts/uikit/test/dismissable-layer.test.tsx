import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, fireEvent, screen, act } from "@testing-library/react";
import { useDismissableLayer, type DismissEvent } from "../src/index";
import { Dialog, DialogContent, DialogTitle } from "../src/components/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "../src/components/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../src/components/dropdown-menu";

// Escape and pointer-downs as the document hears them — which is how they
// arrive where React's root is `document` (Next), whatever React did on the
// way. Both layers listen there; the stack decides who answers.
const escape = () => act(() => void fireEvent.keyDown(document, { key: "Escape" }));

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

const dialog = () => screen.queryByRole("dialog");

describe("dismissable layers stack", () => {
  describe("a Popover in a Dialog", () => {
    const tree = (
      <InDialog>
        <Popover>
          <PopoverTrigger>Details</PopoverTrigger>
          <PopoverContent>
            <button type="button">Inside the popover</button>
          </PopoverContent>
        </Popover>
      </InDialog>
    );

    it("closes the Popover on Escape, then the Dialog on the next", () => {
      render(tree);
      fireEvent.click(screen.getByText("Details"));
      expect(screen.getByText("Inside the popover")).toBeInTheDocument();
      escape();
      expect(screen.queryByText("Inside the popover")).toBeNull();
      expect(dialog()).toBeInTheDocument();
      escape();
      expect(dialog()).toBeNull();
    });

    it("takes a pointer-down inside the Popover as inside the Dialog too", () => {
      render(tree);
      fireEvent.click(screen.getByText("Details"));
      fireEvent.pointerDown(screen.getByText("Inside the popover"));
      expect(screen.getByText("Inside the popover")).toBeInTheDocument();
      expect(dialog()).toBeInTheDocument();
    });
  });

  describe("a DropdownMenu in a Dialog", () => {
    const tree = (
      <InDialog>
        <DropdownMenu>
          <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Rename</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </InDialog>
    );

    it("closes the menu on Escape and leaves the Dialog", () => {
      render(tree);
      fireEvent.click(screen.getByText("Actions"));
      expect(screen.getByRole("menu")).toBeInTheDocument();
      escape();
      expect(screen.queryByRole("menu")).toBeNull();
      expect(dialog()).toBeInTheDocument();
    });

    it("keeps the Dialog on a pointer-down on a menu item", () => {
      render(tree);
      fireEvent.click(screen.getByText("Actions"));
      fireEvent.pointerDown(screen.getByRole("menuitem", { name: "Rename" }));
      expect(dialog()).toBeInTheDocument();
    });
  });

  describe("two independent layers", () => {
    function Layer({ name, log }: { name: string; log: string[] }) {
      const [open, setOpen] = React.useState(true);
      const ref = useDismissableLayer({
        enabled: open,
        onDismiss: (e: DismissEvent) => {
          log.push(`${name}:${e.type}`);
          setOpen(false);
        },
      });
      return open ? <div ref={ref}>{name}</div> : null;
    }

    function Two({ log }: { log: string[] }) {
      const [second, setSecond] = React.useState(false);
      return (
        <>
          <Layer name="a" log={log} />
          <button type="button" onClick={() => setSecond(true)}>
            open b
          </button>
          {second && <Layer name="b" log={log} />}
        </>
      );
    }

    it("dismisses the later one on Escape, the earlier one on the next", () => {
      const log: string[] = [];
      render(<Two log={log} />);
      fireEvent.click(screen.getByText("open b"));
      escape();
      expect(log).toEqual(["b:keydown"]);
      escape();
      expect(log).toEqual(["b:keydown", "a:keydown"]);
    });

    it("dismisses both on a pointer-down outside them, and the earlier one only on a pointer-down in the later", () => {
      const log: string[] = [];
      const { unmount } = render(<Two log={log} />);
      fireEvent.click(screen.getByText("open b"));
      fireEvent.pointerDown(screen.getByText("b"));
      expect(log).toEqual([]);
      fireEvent.pointerDown(document.body);
      expect(log.sort()).toEqual(["a:pointerdown", "b:pointerdown"]);
      unmount();
    });
  });

  it("hands Escape to the Dialog once an open Popover inside it unmounts", () => {
    function Tree({ withPopover }: { withPopover: boolean }) {
      return (
        <InDialog>
          {withPopover && (
            <Popover defaultOpen>
              <PopoverTrigger>Details</PopoverTrigger>
              <PopoverContent>Inside the popover</PopoverContent>
            </Popover>
          )}
        </InDialog>
      );
    }
    const { rerender } = render(<Tree withPopover={false} />);
    rerender(<Tree withPopover />);
    expect(screen.getByText("Inside the popover")).toBeInTheDocument();
    rerender(<Tree withPopover={false} />);
    escape();
    expect(dialog()).toBeNull();
  });

  it("keeps its order under StrictMode's double effects", () => {
    render(
      <React.StrictMode>
        <InDialog>
          <Popover>
            <PopoverTrigger>Details</PopoverTrigger>
            <PopoverContent>Inside the popover</PopoverContent>
          </Popover>
        </InDialog>
      </React.StrictMode>,
    );
    fireEvent.click(screen.getByText("Details"));
    escape();
    expect(screen.queryByText("Inside the popover")).toBeNull();
    expect(dialog()).toBeInTheDocument();
    escape();
    expect(dialog()).toBeNull();
  });
});
