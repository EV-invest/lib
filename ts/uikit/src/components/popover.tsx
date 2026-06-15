import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import { useFloating } from "../primitives/use-floating";
import { useDismissableLayer } from "../primitives/dismissable-layer";
import { usePresence } from "../primitives/presence";
import { mergeRefs } from "../primitives/merge-refs";
import { Portal } from "../primitives/portal";
import { Slot } from "../primitives/slot";

interface PopoverContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function usePopover(): PopoverContextValue {
  const ctx = React.useContext(PopoverContext);
  if (!ctx) throw new Error("Popover parts must be used within <Popover>");
  return ctx;
}

export interface PopoverProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function Popover({ open, defaultOpen = false, onOpenChange, children }: PopoverProps) {
  const [isOpen, setOpen] = useControllableState<boolean>({
    ...(open !== undefined ? { value: open } : {}),
    defaultValue: defaultOpen,
    ...(onOpenChange ? { onChange: onOpenChange } : {}),
  });
  const anchorRef = React.useRef<HTMLElement | null>(null);
  return (
    <PopoverContext.Provider value={{ open: isOpen, setOpen, anchorRef }}>
      {children}
    </PopoverContext.Provider>
  );
}

export interface PopoverTriggerProps extends React.ComponentProps<"button"> {
  asChild?: boolean;
}

export function PopoverTrigger({ asChild = false, onClick, ...props }: PopoverTriggerProps) {
  const { open, setOpen, anchorRef } = usePopover();
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="popover-trigger"
      aria-expanded={open}
      ref={anchorRef as React.Ref<never>}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        setOpen(!open);
      }}
      {...(props as Record<string, unknown>)}
    />
  );
}

export interface PopoverAnchorProps extends React.ComponentProps<"div"> {
  asChild?: boolean;
}

export function PopoverAnchor({ asChild = false, ...props }: PopoverAnchorProps) {
  const { anchorRef } = usePopover();
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      data-slot="popover-anchor"
      ref={anchorRef as React.Ref<never>}
      {...(props as Record<string, unknown>)}
    />
  );
}

export interface PopoverContentProps extends React.ComponentProps<"div"> {
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

export function PopoverContent({
  className,
  side: sideProp = "bottom",
  align = "center",
  sideOffset = 4,
  children,
  ...props
}: PopoverContentProps) {
  const { open, setOpen, anchorRef } = usePopover();
  const { isPresent, ref: presRef } = usePresence(open);
  const { floatingRef, style, side } = useFloating({
    anchorRef,
    open,
    side: sideProp,
    align,
    offset: sideOffset,
  });
  const dismissRef = useDismissableLayer({
    enabled: open,
    onDismiss: () => setOpen(false),
    exclude: [anchorRef],
  });
  if (!isPresent) return null;
  return (
    <Portal>
      <div
        data-slot="popover-content"
        data-state={open ? "open" : "closed"}
        data-side={side}
        data-align={align}
        ref={mergeRefs(floatingRef, dismissRef, presRef)}
        style={style}
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 rounded-md border p-4 shadow-md outline-hidden",
          className,
        )}
        {...(props as Record<string, unknown>)}
      >
        {children}
      </div>
    </Portal>
  );
}
