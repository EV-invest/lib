import { useState } from "react";
import {
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  type DrawerDirection,
} from "@evinvest/uikit";

const DIRECTIONS: DrawerDirection[] = ["bottom", "top", "left", "right"];

// Long enough to overflow the capped sheet on a phone, so the drag-vs-scroll
// hand-off (drag only from the body's top) is exercised, not just the swipe.
const LINES = Array.from({ length: 40 }, (_, i) => `Line ${i + 1} of the drawer body`);

export function DrawerDemo() {
  const [direction, setDirection] = useState<DrawerDirection>("bottom");
  const [open, setOpen] = useState(false);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {DIRECTIONS.map((d) => (
          <Button key={d} variant={d === direction ? "primary" : "outline"} size="sm" onClick={() => setDirection(d)}>
            {d}
          </Button>
        ))}
      </div>
      <Drawer open={open} onOpenChange={setOpen} direction={direction}>
        <DrawerTrigger asChild>
          <Button data-testid="drawer-open">Open drawer</Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Drag me</DrawerTitle>
            <DrawerDescription>Swipe towards the edge, or tap the scrim.</DrawerDescription>
          </DrawerHeader>
          <ul className="flex flex-col gap-2 px-4">
            {LINES.map((l) => (
              <li key={l} className="text-ink-soft text-sm">
                {l}
              </li>
            ))}
          </ul>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </section>
  );
}
