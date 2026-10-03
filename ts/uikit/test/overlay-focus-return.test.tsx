import { describe, it, expect } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogTitle, AlertDialogTrigger } from "../src/components/alert-dialog";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "../src/components/dialog";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from "../src/components/drawer";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "../src/components/sheet";

// A clicked button is not focused in jsdom (nor in Safari), so the element
// focused before opening is <body>: focus has to come back through the
// trigger fallback, not the remembered element.
const overlays = [
  [
    "Sheet",
    <Sheet key="s">
      <SheetTrigger>open</SheetTrigger>
      <SheetContent>
        <SheetTitle>t</SheetTitle>
        <SheetClose>done</SheetClose>
      </SheetContent>
    </Sheet>,
  ],
  [
    "Dialog",
    <Dialog key="d">
      <DialogTrigger>open</DialogTrigger>
      <DialogContent>
        <DialogTitle>t</DialogTitle>
        <DialogClose>done</DialogClose>
      </DialogContent>
    </Dialog>,
  ],
  [
    "AlertDialog",
    <AlertDialog key="a">
      <AlertDialogTrigger>open</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>t</AlertDialogTitle>
        <AlertDialogCancel>done</AlertDialogCancel>
      </AlertDialogContent>
    </AlertDialog>,
  ],
  [
    "Drawer",
    <Drawer key="w">
      <DrawerTrigger>open</DrawerTrigger>
      <DrawerContent>
        <DrawerTitle>t</DrawerTitle>
        <DrawerClose>done</DrawerClose>
      </DrawerContent>
    </Drawer>,
  ],
] as const;

describe("closing an overlay hands focus back to its trigger", () => {
  it.each(overlays)("%s", (_, tree) => {
    const { getByText } = render(tree);
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.click(getByText("open"));
    expect(document.activeElement).not.toBe(getByText("open"));
    fireEvent.click(getByText("done"));
    expect(document.activeElement).toBe(getByText("open"));
  });

  it.each(overlays)("%s: the closing scrim stops taking clicks", (name, tree) => {
    const { getByText, baseElement } = render(tree);
    fireEvent.click(getByText("open"));
    fireEvent.click(getByText("done"));
    const slot = { Sheet: "sheet", Dialog: "dialog", AlertDialog: "alert-dialog", Drawer: "drawer" }[name];
    const scrim = baseElement.querySelector(`[data-slot="${slot}-overlay"]`);
    // jsdom unmounts at once (no animation), so a scrim still here must be closed and click-through.
    if (scrim) {
      expect(scrim).toHaveAttribute("data-state", "closed");
      expect(scrim.className).toContain("data-[state=closed]:pointer-events-none");
    }
  });
});
