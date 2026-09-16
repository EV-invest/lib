import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import { useFocusScope } from "../primitives/focus-scope";
import { mergeRefs } from "../primitives/merge-refs";
import { Portal } from "../primitives/portal";
import { Slot } from "../primitives/slot";
import {
  DRAWER_BODY,
  DRAWER_CONTENT_BASE,
  DRAWER_DESCRIPTION,
  DRAWER_FOOTER,
  DRAWER_HANDLE,
  DRAWER_HEADER,
  DRAWER_OVERLAY,
  DRAWER_TITLE,
  drawerDirectionClasses,
  type DrawerDirection,
} from "../generated/drawer";

export type { DrawerDirection };

// Drag-to-dismiss tuning (pointer physics, TS-only — Rust stays render-only).
// Values from Vaul: a release past 25% of the panel's size along the drag
// axis, or a flick faster than 0.4px/ms, closes; anything short snaps back.
// Drags are refused for the first 500ms after opening so the enter finishes.
const CLOSE_THRESHOLD = 0.25;
const VELOCITY_THRESHOLD = 0.4;
const DRAG_AFTER_OPEN_MS = 500;
// The closing node is dropped on its exit `transitionend`; this is the safety
// net for when that never fires (display:none ancestor, tab hidden, a full
// drag that left the panel exactly at its off-screen transform). Just past
// the 500ms transition in motion.css.
const EXIT_FALLBACK_MS = 600;

interface DrawerContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  direction: DrawerDirection;
}

const DrawerContext = React.createContext<DrawerContextValue | null>(null);

function useDrawer(): DrawerContextValue {
  const ctx = React.useContext(DrawerContext);
  if (!ctx) throw new Error("Drawer parts must be used within <Drawer>");
  return ctx;
}

export interface DrawerProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  direction?: DrawerDirection;
  children?: React.ReactNode;
}

export function Drawer({
  open,
  defaultOpen = false,
  onOpenChange,
  direction = "bottom",
  children,
}: DrawerProps) {
  const [isOpen, setOpen] = useControllableState<boolean>({
    ...(open !== undefined ? { value: open } : {}),
    defaultValue: defaultOpen,
    ...(onOpenChange ? { onChange: onOpenChange } : {}),
  });
  return (
    <DrawerContext.Provider value={{ open: isOpen, setOpen, direction }}>
      <div data-slot="drawer">{children}</div>
    </DrawerContext.Provider>
  );
}

export interface DrawerTriggerProps extends React.ComponentProps<"button"> {
  asChild?: boolean;
}

export function DrawerTrigger({ asChild = false, onClick, ...props }: DrawerTriggerProps) {
  const { setOpen } = useDrawer();
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="drawer-trigger"
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        setOpen(true);
      }}
      {...(props as Record<string, unknown>)}
    />
  );
}

export interface DrawerCloseProps extends React.ComponentProps<"button"> {
  asChild?: boolean;
}

export function DrawerClose({ asChild = false, onClick, ...props }: DrawerCloseProps) {
  const { setOpen } = useDrawer();
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="drawer-close"
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        setOpen(false);
      }}
      {...(props as Record<string, unknown>)}
    />
  );
}

/**
 * Standalone scrim, redundant with the one {@link DrawerContent} renders (as in
 * shadcn). Mounted only while open; the animated exit lives on the content's
 * own scrim.
 */
export function DrawerOverlay({ className, ...props }: React.ComponentProps<"div">) {
  const { open, setOpen } = useDrawer();
  if (!open) return null;
  return (
    <div
      data-slot="drawer-overlay"
      data-state="open"
      onClick={() => setOpen(false)}
      className={cn(DRAWER_OVERLAY, className)}
      {...props}
    />
  );
}

// Positive delta = the finger moved towards the docked edge (bottom: down,
// top: up, right: right, left: left), i.e. the closing direction.
const EDGE_SIGN: Record<DrawerDirection, 1 | -1> = {
  bottom: 1,
  top: -1,
  right: 1,
  left: -1,
};

function isVertical(direction: DrawerDirection): boolean {
  return direction === "bottom" || direction === "top";
}

function translateAlong(direction: DrawerDirection, px: number): string {
  return isVertical(direction) ? `translate3d(0, ${px}px, 0)` : `translate3d(${px}px, 0, 0)`;
}

// Vaul's over-drag curve: the panel barely moves past its docked edge. Only
// starts displacing once the finger has gone ~6px (log(v + 1) > 2); before
// that the curve is negative, which reads as "stay home".
function dampen(px: number): number {
  return Math.max(8 * (Math.log(px + 1) - 2), 0);
}

// Vaul's `shouldDrag`, minus snap points. `towardsEdge` false = the user is
// pulling the panel further open, which on a vertical sheet is the scroll
// gesture — hand it to the scroller. The scroll walk is vertical-only: a
// horizontal sheet never competes with its body's vertical scroll.
function shouldDrag(
  target: EventTarget | null,
  panel: HTMLElement,
  direction: DrawerDirection,
  towardsEdge: boolean,
): boolean {
  if (!(target instanceof Element)) return false;
  if (target.tagName === "SELECT") return false; // https://github.com/emilkowalski/vaul/issues/483
  if (target.closest("[data-vaul-no-drag]")) return false;
  if (!isVertical(direction)) return true;
  if (!towardsEdge) return false;
  const selection = window.getSelection?.()?.toString();
  if (selection && selection.length > 0) return false;
  // any scroller between the finger and the panel that isn't at its top owns
  // the gesture; the user can scroll up and the next move re-asks
  let el: Element | null = target;
  while (el && el !== panel) {
    if (el.scrollHeight > el.clientHeight && el.scrollTop > 0) return false;
    el = el.parentElement;
  }
  return true;
}

interface DragGesture {
  pointerId: number;
  // the element under the finger at pointerdown — once the panel captures the
  // pointer, every later event's `target` is the panel itself, and the scroll
  // walk in `shouldDrag` would never see the scroller it started in
  target: EventTarget | null;
  start: number; // clientX/Y along the axis
  time: number;
  size: number; // panel extent along the axis, for the close threshold + scrim fade
  allowed: boolean | null; // null = undecided; true sticks for the gesture (Vaul's isAllowedToDrag)
  delta: number;
}

// ── drag-to-dismiss (Vaul pointer physics) ────────────────────────────────
// No React state on the hot path: the gesture lives in a ref and every move is
// one inline `transform` write on the panel plus one `opacity` write on the
// scrim. Not a CSS var: a custom-property change re-resolves inherited values
// across the whole subtree, per move.
function useDrawerDrag(opts: {
  panelRef: React.RefObject<HTMLDivElement | null>;
  scrimRef: React.RefObject<HTMLDivElement | null>;
  direction: DrawerDirection;
  open: boolean;
  present: boolean;
  openedAtRef: React.RefObject<number>;
  onClose: () => void;
}) {
  const { panelRef, scrimRef, direction, open, present, openedAtRef, onClose } = opts;
  const dragRef = React.useRef<DragGesture | null>(null);

  // Native scroll suppression. Once a gesture is allowed, the browser must not
  // turn the same touch into a scroll/overscroll of a body sitting at its top —
  // that would pointercancel us mid-drag. Pointer events precede the compat
  // touch events, so `allowed` is already decided when this runs. React's
  // onTouchMove is passive, hence the manual listener.
  React.useEffect(() => {
    if (!present) return;
    const panel = panelRef.current;
    if (!panel) return;
    const onTouchMove = (e: TouchEvent) => {
      if (dragRef.current?.allowed) e.preventDefault();
    };
    panel.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => panel.removeEventListener("touchmove", onTouchMove);
  }, [present, panelRef]);

  const axisPos = (e: React.PointerEvent) => (isVertical(direction) ? e.clientY : e.clientX);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    // one gesture at a time: a second finger must not reset the first one's
    // state and leave the panel stranded mid-drag
    if (!panel || e.button > 0 || !open || dragRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-slot="drawer-close"]')) return;
    // React bubbles portal events (a Select's listbox, a Popover) through the
    // tree; a drag can only start from the panel's own DOM
    if (!panel.contains(target)) return;
    const rect = panel.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      target,
      start: axisPos(e),
      time: Date.now(),
      size: isVertical(direction) ? rect.height : rect.width,
      allowed: null,
      delta: 0,
    };
    // Capture on the element under the finger, not the panel (Vaul does the
    // same): a click's target is the common ancestor of pointerdown and
    // pointerup, so capturing on the panel would steal every click from the
    // buttons and links inside. No preventDefault either — inputs inside the
    // sheet must still focus on tap.
    try {
      target.setPointerCapture?.(e.pointerId);
    } catch {
      // jsdom / unsupported — capture is a nice-to-have, the drag works without it
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || !panel) return;
    const delta = (axisPos(e) - drag.start) * EDGE_SIGN[direction];
    drag.delta = delta;
    if (!drag.allowed) {
      if (Date.now() - openedAtRef.current < DRAG_AFTER_OPEN_MS) return;
      // refused on this move only — the user may scroll the body to its top
      // and carry on, so the gesture stays alive
      if (!shouldDrag(drag.target, panel, direction, delta > 0)) return;
      drag.allowed = true;
      panel.setAttribute("data-dragging", "true"); // CSS drops the transitions for 1:1 tracking
      scrimRef.current?.setAttribute("data-dragging", "true");
    }
    const scrim = scrimRef.current;
    if (delta < 0) {
      panel.style.transform = translateAlong(direction, -dampen(-delta) * EDGE_SIGN[direction]);
      if (scrim) scrim.style.opacity = "1";
      return;
    }
    panel.style.transform = translateAlong(direction, delta * EDGE_SIGN[direction]);
    if (scrim) {
      scrim.style.opacity = `${Math.min(1, Math.max(0, 1 - delta / drag.size))}`;
    }
  };

  // Release hands styling back to the CSS: with the inline transform gone and
  // data-dragging cleared in the same frame, the restored transition carries
  // the panel from wherever the finger left it — home on a snap-back, or (with
  // data-state=closed committed by `onClose` in the same frame) straight off.
  const endGesture = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || !panel || e.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    try {
      (drag.target as HTMLElement).releasePointerCapture?.(drag.pointerId);
    } catch {
      // jsdom / unsupported
    }
    if (!drag.allowed) return;
    panel.removeAttribute("data-dragging");
    panel.style.transform = "";
    const scrim = scrimRef.current;
    if (scrim) {
      scrim.removeAttribute("data-dragging");
      scrim.style.opacity = "";
    }
    if (cancelled || drag.delta <= 0) return;
    const dt = Date.now() - drag.time;
    const velocity = dt > 0 ? drag.delta / dt : 0;
    if (velocity > VELOCITY_THRESHOLD || drag.delta >= drag.size * CLOSE_THRESHOLD) {
      onClose();
    }
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => endGesture(e, false),
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => endGesture(e, true),
  };
}

/**
 * The panel plus its scrim. Presence outlives `open`: once it turns false the
 * panel flips to `data-state="closed"` and is unmounted when its exit
 * `transform` transition ends (or the fallback timer fires). Re-opening
 * mid-exit just flips the state back and the same transition carries the
 * panel home. Drag-to-dismiss is TS-only pointer physics; opt a region out
 * with `data-vaul-no-drag`.
 */
export function DrawerContent({ className, children, ...props }: React.ComponentProps<"div">) {
  const { open, setOpen, direction } = useDrawer();
  // Derived during render so the panel is in the same commit that opened it —
  // the enter keyframe plays on insertion, no mount flip needed.
  const [present, setPresent] = React.useState(open);
  if (open && !present) setPresent(true);
  const closing = present && !open;

  const scopeRef = useFocusScope(open);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const scrimRef = React.useRef<HTMLDivElement | null>(null);
  const openedAtRef = React.useRef(0);

  React.useEffect(() => {
    if (open) openedAtRef.current = Date.now();
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Safety net for a missed exit transitionend; the cleanup is what cancels it
  // on re-open.
  React.useEffect(() => {
    if (!closing) return;
    const id = setTimeout(() => setPresent(false), EXIT_FALLBACK_MS);
    return () => clearTimeout(id);
  }, [closing]);

  const drag = useDrawerDrag({
    panelRef,
    scrimRef,
    direction,
    open,
    present,
    openedAtRef,
    onClose: () => setOpen(false),
  });

  if (!present) return null;
  const state = closing ? "closed" : "open";
  return (
    <Portal>
      <div
        ref={scrimRef}
        data-slot="drawer-overlay"
        data-state={state}
        className={DRAWER_OVERLAY}
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        data-slot="drawer-content"
        data-state={state}
        data-vaul-drawer-direction={direction}
        ref={mergeRefs(scopeRef, panelRef)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        // transitionend bubbles from children (a hover on a button inside),
        // so pin it to the panel's own exit transform
        onTransitionEnd={(e) => {
          if (closing && e.propertyName === "transform" && e.target === e.currentTarget) {
            setPresent(false);
          }
        }}
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onPointerCancel={drag.onPointerCancel}
        className={cn(DRAWER_CONTENT_BASE, drawerDirectionClasses[direction], className)}
        {...(props as Record<string, unknown>)}
      >
        {direction === "bottom" ? (
          <div
            data-slot="drawer-handle"
            className={DRAWER_HANDLE}
          />
        ) : null}
        <div
          data-slot="drawer-body"
          className={DRAWER_BODY}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
}

export function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(DRAWER_HEADER, className)}
      {...props}
    />
  );
}

export function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn(DRAWER_FOOTER, className)}
      {...props}
    />
  );
}

export function DrawerTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-title"
      className={cn(DRAWER_TITLE, className)}
      {...props}
    />
  );
}

export function DrawerDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-description"
      className={cn(DRAWER_DESCRIPTION, className)}
      {...props}
    />
  );
}
