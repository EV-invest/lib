import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "../src/components/sheet";

function tree(props = {}) {
  return (
    <Sheet {...props}>
      <SheetTrigger>open</SheetTrigger>
      <SheetContent {...props}>
        <SheetHeader>
          <SheetTitle>Title</SheetTitle>
          <SheetDescription>Body</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
}

describe("Sheet", () => {
  it("opens as a dialog with content visible", () => {
    const { getByText, queryByRole, getByRole } = render(tree());
    expect(queryByRole("dialog")).toBeNull();
    fireEvent.click(getByText("open"));
    const dialog = getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("data-state", "open");
    expect(getByText("Title")).toBeInTheDocument();
    expect(getByText("Body")).toBeInTheDocument();
  });

  it("applies side-specific slide-in classes", () => {
    const { getByText, getByRole } = render(
      <Sheet>
        <SheetTrigger>open</SheetTrigger>
        <SheetContent side="left">
          <SheetTitle>Left</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    fireEvent.click(getByText("open"));
    expect(getByRole("dialog").className).toContain("data-[state=open]:slide-in-from-left");
  });

  it("closes on Escape", () => {
    const { getByText, queryByRole, getByRole } = render(tree());
    fireEvent.click(getByText("open"));
    expect(getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(queryByRole("dialog")).toBeNull();
  });
});
