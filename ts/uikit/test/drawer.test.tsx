import { describe, it, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerClose,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
} from "../src/components/drawer";

function tree(props = {}) {
  return (
    <Drawer {...props}>
      <DrawerTrigger>Open</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Title</DrawerTitle>
          <DrawerDescription>Desc</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <DrawerClose>Close</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

describe("Drawer", () => {
  it("hides the content while closed", () => {
    render(tree());
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens on trigger click with a modal dialog", () => {
    render(tree());
    fireEvent.click(screen.getByText("Open"));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("data-vaul-drawer-direction", "bottom");
    expect(screen.getByText("Title")).toBeInTheDocument();
  });

  it("reflects the direction prop", () => {
    render(tree({ defaultOpen: true, direction: "right" }));
    expect(screen.getByRole("dialog")).toHaveAttribute(
      "data-vaul-drawer-direction",
      "right",
    );
  });

  it("closes when the close button is clicked", () => {
    render(tree({ defaultOpen: true }));
    fireEvent.click(screen.getByText("Close"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape and reports via onOpenChange", () => {
    let lastOpen: boolean | null = null;
    render(tree({ defaultOpen: true, onOpenChange: (o: boolean) => (lastOpen = o) }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(lastOpen).toBe(false);
  });
});
