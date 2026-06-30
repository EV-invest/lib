import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import { useDismissableLayer } from "../primitives/dismissable-layer";
import { useFocusScope } from "../primitives/focus-scope";
import { usePresence } from "../primitives/presence";
import { mergeRefs } from "../primitives/merge-refs";
import { Portal } from "../primitives/portal";
import { Slot } from "../primitives/slot";
import {
  SHEET_CLOSE,
  SHEET_CONTENT,
  SHEET_DESCRIPTION,
  SHEET_FOOTER,
  SHEET_HEADER,
  SHEET_OVERLAY,
  SHEET_SIDE_BOTTOM,
  SHEET_SIDE_LEFT,
  SHEET_SIDE_RIGHT,
  SHEET_SIDE_TOP,
  SHEET_TITLE,
} from "../generated/sheet";

interface SheetContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheet(): SheetContextValue {
  const ctx = React.useContext(SheetContext);
  if (!ctx) throw new Error("Sheet parts must be used within <Sheet>");
  return ctx;
}

export interface SheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function Sheet({ open, defaultOpen = false, onOpenChange, children }: SheetProps) {
  const [isOpen, setOpen] = useControllableState<boolean>({
    ...(open !== undefined ? { value: open } : {}),
    defaultValue: defaultOpen,
    ...(onOpenChange ? { onChange: onOpenChange } : {}),
  });
  const triggerRef = React.useRef<HTMLElement | null>(null);
  return (
    <SheetContext.Provider value={{ open: isOpen, setOpen, triggerRef }}>
      {children}
    </SheetContext.Provider>
  );
}

export interface SheetTriggerProps extends React.ComponentProps<"button"> {
  asChild?: boolean;
}

export function SheetTrigger({ asChild = false, onClick, ...props }: SheetTriggerProps) {
  const { open, setOpen, triggerRef } = useSheet();
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="sheet-trigger"
      aria-expanded={open}
      ref={triggerRef as React.Ref<HTMLButtonElement>}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        setOpen(true);
      }}
      {...(props as Record<string, unknown>)}
    />
  );
}

export interface SheetOverlayProps extends React.ComponentProps<"div"> {}

export function SheetOverlay({ className, ...props }: SheetOverlayProps) {
  const { open, setOpen } = useSheet();
  return (
    <div
      data-slot="sheet-overlay"
      data-state={open ? "open" : "closed"}
      onClick={() => setOpen(false)}
      className={cn(SHEET_OVERLAY, className)}
      {...(props as Record<string, unknown>)}
    />
  );
}

const sheetSideClasses = {
  right: SHEET_SIDE_RIGHT,
  left: SHEET_SIDE_LEFT,
  top: SHEET_SIDE_TOP,
  bottom: SHEET_SIDE_BOTTOM,
} as const;

const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export interface SheetContentProps extends React.ComponentProps<"div"> {
  side?: "top" | "right" | "bottom" | "left";
}

export function SheetContent({ className, children, side = "right", ...props }: SheetContentProps) {
  const { open, setOpen, triggerRef } = useSheet();
  const { isPresent, ref: presRef } = usePresence(open);
  const focusRef = useFocusScope(open);
  const dismissRef = useDismissableLayer({
    enabled: open,
    onDismiss: () => setOpen(false),
    exclude: [triggerRef],
  });
  if (!isPresent) return null;
  return (
    <Portal>
      <SheetOverlay />
      <div
        data-slot="sheet-content"
        role="dialog"
        aria-modal="true"
        data-state={open ? "open" : "closed"}
        ref={mergeRefs(focusRef, dismissRef, presRef as React.Ref<HTMLDivElement>)}
        className={cn(SHEET_CONTENT, sheetSideClasses[side], className)}
        {...(props as Record<string, unknown>)}
      >
        {children}
        <button
          type="button"
          data-slot="sheet-close"
          onClick={() => setOpen(false)}
          className={SHEET_CLOSE}
        >
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </Portal>
  );
}

export interface SheetCloseProps extends React.ComponentProps<"button"> {
  asChild?: boolean;
}

export function SheetClose({ asChild = false, onClick, ...props }: SheetCloseProps) {
  const { setOpen } = useSheet();
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="sheet-close"
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        setOpen(false);
      }}
      {...(props as Record<string, unknown>)}
    />
  );
}

export function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(SHEET_HEADER, className)}
      {...props}
    />
  );
}

export function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(SHEET_FOOTER, className)}
      {...props}
    />
  );
}

export function SheetTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="sheet-title"
      className={cn(SHEET_TITLE, className)}
      {...props}
    />
  );
}

export function SheetDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="sheet-description"
      className={cn(SHEET_DESCRIPTION, className)}
      {...props}
    />
  );
}
