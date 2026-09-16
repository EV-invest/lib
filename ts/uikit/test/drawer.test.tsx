import { describe, it, expect, afterEach, vi } from "vitest";
import { render, fireEvent, createEvent, screen, act } from "@testing-library/react";
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

function tree(props = {}, extra: React.ReactNode = null) {
  return (
    <Drawer {...props}>
      <DrawerTrigger>Open</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Title</DrawerTitle>
          <DrawerDescription>Desc</DrawerDescription>
        </DrawerHeader>
        {extra}
        <DrawerFooter>
          <DrawerClose>Close</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

const scrim = () => document.querySelector('[data-slot="drawer-overlay"]');

// jsdom implements neither PointerEvent nor TransitionEvent, so RTL's
// `fireEvent.*` drops their init fields (clientX/Y / propertyName). Build the
// events by hand and pin what we need, mirroring the sonner test.
function firePointer(
  el: HTMLElement,
  type: "pointerDown" | "pointerMove" | "pointerUp" | "pointerCancel",
  pos: { x?: number; y?: number; id?: number },
) {
  const event = createEvent[type](el, { button: 0 });
  Object.defineProperty(event, "pointerId", { value: pos.id ?? 1 });
  Object.defineProperty(event, "clientX", { value: pos.x ?? 0 });
  Object.defineProperty(event, "clientY", { value: pos.y ?? 0 });
  fireEvent(el, event);
}
function fireTransitionEnd(el: HTMLElement, propertyName = "transform") {
  const event = createEvent.transitionEnd(el, { propertyName });
  Object.defineProperty(event, "propertyName", { value: propertyName });
  fireEvent(el, event);
}

// The drag physics need a panel size (jsdom lays nothing out) and a clock past
// the 500ms post-open drag guard. Fake timers freeze Date.now(), so a gesture
// fired without advancing has zero velocity and closes on distance alone.
const PANEL = 400;
function openForDrag(props = {}, extra: React.ReactNode = null) {
  vi.useFakeTimers();
  const utils = render(tree({ defaultOpen: true, ...props }, extra));
  const panel = screen.getByRole("dialog");
  vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({
    width: PANEL,
    height: PANEL,
  } as DOMRect);
  act(() => {
    vi.advanceTimersByTime(600);
  });
  return { ...utils, panel };
}

describe("Drawer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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
    expect(screen.getByRole("dialog")).toHaveAttribute("data-state", "closed");
    fireTransitionEnd(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape and reports via onOpenChange", () => {
    let lastOpen: boolean | null = null;
    render(tree({ defaultOpen: true, onOpenChange: (o: boolean) => (lastOpen = o) }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(lastOpen).toBe(false);
  });

  // The motion lives in motion.css and is keyed off data-slot + data-state +
  // data-vaul-drawer-direction, so the attributes are the whole contract: the
  // scrim once carried no data-state, which silently disabled its fade.
  it("animates in, on both the panel and the scrim", () => {
    render(tree({ defaultOpen: true }));
    const panel = screen.getByRole("dialog");
    expect(panel).toHaveAttribute("data-state", "open");
    expect(panel).toHaveAttribute("data-vaul-drawer-direction", "bottom");
    expect(panel.querySelector('[data-slot="drawer-handle"]')).not.toBeNull();
    expect(panel.querySelector('[data-slot="drawer-body"]')).not.toBeNull();
    expect(scrim()).toHaveAttribute("data-state", "open");
  });

  it("slides from the edge it is docked to", () => {
    render(tree({ defaultOpen: true, direction: "right" }));
    const panel = screen.getByRole("dialog");
    expect(panel).toHaveAttribute("data-vaul-drawer-direction", "right");
    expect(panel).toHaveAttribute("data-state", "open");
    expect(panel.querySelector('[data-slot="drawer-handle"]')).toBeNull();
  });

  // ── presence: the exit rides the transition ────────────────────────────
  it("stays mounted as closed until its own transform transitionend", () => {
    render(tree({ defaultOpen: true }));
    fireEvent.click(scrim()!);
    const panel = screen.getByRole("dialog");
    expect(panel).toHaveAttribute("data-state", "closed");
    expect(scrim()).toHaveAttribute("data-state", "closed");

    // a child's transition bubbling up, or another property, must not drop it
    fireTransitionEnd(screen.getByText("Close"));
    fireTransitionEnd(panel, "opacity");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireTransitionEnd(panel);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(scrim()).toBeNull();
  });

  it("unmounts on the fallback timer when transitionend never fires", () => {
    vi.useFakeTimers();
    render(tree({ defaultOpen: true }));
    fireEvent.click(screen.getByText("Close"));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("dialog")).toHaveAttribute("data-state", "closed");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("re-opening mid-exit flips back to open and is not dropped later", () => {
    vi.useFakeTimers();
    render(tree({ defaultOpen: true }));
    const panel = screen.getByRole("dialog");
    fireEvent.click(screen.getByText("Close"));
    expect(panel).toHaveAttribute("data-state", "closed");
    fireEvent.click(screen.getByText("Open"));
    expect(screen.getByRole("dialog")).toBe(panel);
    expect(panel).toHaveAttribute("data-state", "open");
    // the transition home ends on the same property; the stale timer is cancelled
    fireTransitionEnd(panel);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("dialog")).toHaveAttribute("data-state", "open");
  });

  // ── drag-to-dismiss ────────────────────────────────────────────────────
  it("closes when dragged past a quarter of its height", () => {
    const onOpenChange = vi.fn();
    const { panel } = openForDrag({ onOpenChange });
    firePointer(panel, "pointerDown", { y: 100 });
    firePointer(panel, "pointerMove", { y: 150 });
    expect(panel).toHaveAttribute("data-dragging", "true");
    expect(scrim()).toHaveAttribute("data-dragging", "true");
    expect(panel.style.transform).toBe("translate3d(0, 50px, 0)");
    expect((scrim() as HTMLElement).style.opacity).toBe("0.875");

    firePointer(panel, "pointerMove", { y: 100 + PANEL * 0.3 });
    firePointer(panel, "pointerUp", { y: 100 + PANEL * 0.3 });
    expect(panel).not.toHaveAttribute("data-dragging");
    expect(scrim()).not.toHaveAttribute("data-dragging");
    expect(panel.style.transform).toBe("");
    expect((scrim() as HTMLElement).style.opacity).toBe("");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(panel).toHaveAttribute("data-state", "closed");
  });

  it("closes on a short but fast flick", () => {
    const onOpenChange = vi.fn();
    const { panel } = openForDrag({ onOpenChange });
    firePointer(panel, "pointerDown", { y: 100 });
    firePointer(panel, "pointerMove", { y: 120 });
    act(() => {
      vi.advanceTimersByTime(10); // 20px in 10ms = 2px/ms > 0.4
    });
    firePointer(panel, "pointerUp", { y: 120 });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("snaps back from a short drag and stays open", () => {
    const onOpenChange = vi.fn();
    const { panel } = openForDrag({ onOpenChange });
    firePointer(panel, "pointerDown", { y: 100 });
    firePointer(panel, "pointerMove", { y: 130 });
    expect(panel.style.transform).toBe("translate3d(0, 30px, 0)");
    firePointer(panel, "pointerUp", { y: 130 });
    expect(panel.style.transform).toBe("");
    expect(panel).not.toHaveAttribute("data-dragging");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(panel).toHaveAttribute("data-state", "open");
  });

  it("never closes when dragged away from its edge", () => {
    const onOpenChange = vi.fn();
    const { panel } = openForDrag({ onOpenChange });
    firePointer(panel, "pointerDown", { y: 300 });
    firePointer(panel, "pointerMove", { y: 0 });
    // away from the edge is the scroll gesture: the drag is never allowed
    expect(panel).not.toHaveAttribute("data-dragging");
    expect(panel.style.transform).toBe("");
    firePointer(panel, "pointerUp", { y: 0 });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("dampens an over-drag once the gesture is allowed", () => {
    const { panel } = openForDrag();
    firePointer(panel, "pointerDown", { y: 100 });
    firePointer(panel, "pointerMove", { y: 110 }); // towards the edge: allowed from here on
    firePointer(panel, "pointerMove", { y: 0 }); // 100px away → ~20px, not 100
    expect(panel).toHaveAttribute("data-dragging", "true");
    const y = Number(/translate3d\(0, (-?[\d.]+)px, 0\)/.exec(panel.style.transform)?.[1]);
    expect(y).toBeLessThan(0);
    expect(y).toBeGreaterThan(-25);
    expect((scrim() as HTMLElement).style.opacity).toBe("1");
  });

  it("drags horizontally along the docked axis", () => {
    const onOpenChange = vi.fn();
    const { panel } = openForDrag({ onOpenChange, direction: "left" });
    firePointer(panel, "pointerDown", { x: 300 });
    firePointer(panel, "pointerMove", { x: 240 });
    expect(panel.style.transform).toBe("translate3d(-60px, 0, 0)");
    firePointer(panel, "pointerMove", { x: 300 - PANEL * 0.3 });
    firePointer(panel, "pointerUp", { x: 300 - PANEL * 0.3 });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("ignores a drag starting on a data-vaul-no-drag region", () => {
    const onOpenChange = vi.fn();
    const { panel } = openForDrag({ onOpenChange }, <div data-vaul-no-drag>Map</div>);
    const map = screen.getByText("Map");
    firePointer(map, "pointerDown", { y: 100 });
    firePointer(map, "pointerMove", { y: 300 });
    expect(panel).not.toHaveAttribute("data-dragging");
    firePointer(map, "pointerUp", { y: 300 });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("lets a scrolled child keep the gesture", () => {
    const onOpenChange = vi.fn();
    const { panel } = openForDrag({ onOpenChange }, <div data-testid="list">List</div>);
    const list = screen.getByTestId("list");
    Object.defineProperty(list, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(list, "clientHeight", { value: 200, configurable: true });
    Object.defineProperty(list, "scrollTop", { value: 40, writable: true, configurable: true });
    firePointer(list, "pointerDown", { y: 100 });
    firePointer(list, "pointerMove", { y: 300 });
    expect(panel).not.toHaveAttribute("data-dragging");
    // ... until it is scrolled back to the top: the same gesture picks up
    list.scrollTop = 0;
    firePointer(list, "pointerMove", { y: 320 });
    expect(panel).toHaveAttribute("data-dragging", "true");
    firePointer(list, "pointerUp", { y: 320 });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("snaps back on pointercancel without closing", () => {
    const onOpenChange = vi.fn();
    const { panel } = openForDrag({ onOpenChange });
    firePointer(panel, "pointerDown", { y: 100 });
    firePointer(panel, "pointerMove", { y: 300 });
    expect(panel).toHaveAttribute("data-dragging", "true");
    firePointer(panel, "pointerCancel", { y: 300 });
    expect(panel).not.toHaveAttribute("data-dragging");
    expect(panel.style.transform).toBe("");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("refuses a drag during the first 500ms after opening", () => {
    vi.useFakeTimers();
    render(tree({ defaultOpen: true }));
    const panel = screen.getByRole("dialog");
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({ height: PANEL } as DOMRect);
    firePointer(panel, "pointerDown", { y: 100 });
    firePointer(panel, "pointerMove", { y: 300 });
    expect(panel).not.toHaveAttribute("data-dragging");
    firePointer(panel, "pointerUp", { y: 300 });
    expect(panel).toHaveAttribute("data-state", "open");
  });

  // A click's target is the common ancestor of pointerdown and pointerup; had
  // the panel captured the pointer, every pointerup would land on it and no
  // button inside the sheet could ever be clicked.
  it("captures the pointer on the pressed element, not the panel", () => {
    const { panel } = openForDrag({}, <button data-testid="inner">Inner</button>);
    const inner = screen.getByTestId("inner");
    const onInner = vi.fn();
    const onPanel = vi.fn();
    (inner as HTMLElement & { setPointerCapture: unknown }).setPointerCapture = onInner;
    (panel as HTMLElement & { setPointerCapture: unknown }).setPointerCapture = onPanel;
    firePointer(inner, "pointerDown", { y: 100 });
    expect(onInner).toHaveBeenCalledWith(1);
    expect(onPanel).not.toHaveBeenCalled();
  });

  it("ignores a second pointer while a gesture is in flight", () => {
    const { panel } = openForDrag();
    firePointer(panel, "pointerDown", { y: 100 });
    firePointer(panel, "pointerMove", { y: 150 });
    expect(panel.style.transform).toBe("translate3d(0, 50px, 0)");
    // second finger: down + up without moving must not reset the first gesture
    firePointer(panel, "pointerDown", { y: 300, id: 2 });
    firePointer(panel, "pointerUp", { y: 300, id: 2 });
    expect(panel).toHaveAttribute("data-dragging", "true");
    expect(panel.style.transform).toBe("translate3d(0, 50px, 0)");
    firePointer(panel, "pointerUp", { y: 150 });
    expect(panel).not.toHaveAttribute("data-dragging");
  });

  // React bubbles events from a portal (a Select's listbox rendered under
  // document.body) through the component tree, so the panel's handlers see
  // pointers that never touched its DOM.
  it("does not start a drag from a portaled child", () => {
    const { panel } = openForDrag();
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    const down = createEvent.pointerDown(panel, { button: 0 });
    Object.defineProperty(down, "pointerId", { value: 1 });
    Object.defineProperty(down, "target", { value: outside });
    Object.defineProperty(down, "clientY", { value: 100 });
    fireEvent(panel, down);
    firePointer(panel, "pointerMove", { y: 300 });
    expect(panel).not.toHaveAttribute("data-dragging");
    expect(panel.style.transform).toBe("");
    outside.remove();
  });

  it("locks body scroll while open and restores it on close", () => {
    render(tree({ defaultOpen: true }));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByText("Close"));
    expect(document.body.style.overflow).toBe("");
  });
});
