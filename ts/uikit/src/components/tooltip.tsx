import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import { useFloating } from "../primitives/use-floating";
import { usePresence } from "../primitives/presence";
import { mergeRefs } from "../primitives/merge-refs";
import { Portal } from "../primitives/portal";
import { Slot } from "../primitives/slot";

interface TooltipContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

function useTooltip(): TooltipContextValue {
  const ctx = React.useContext(TooltipContext);
  if (!ctx) throw new Error("Tooltip parts must be used within <Tooltip>");
  return ctx;
}

export interface TooltipProviderProps {
  children?: React.ReactNode;
}

export function TooltipProvider({ children }: TooltipProviderProps) {
  return <>{children}</>;
}

export interface TooltipProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function Tooltip({ open, defaultOpen = false, onOpenChange, children }: TooltipProps) {
  const [isOpen, setOpen] = useControllableState<boolean>({
    ...(open !== undefined ? { value: open } : {}),
    defaultValue: defaultOpen,
    ...(onOpenChange ? { onChange: onOpenChange } : {}),
  });
  const anchorRef = React.useRef<HTMLElement | null>(null);
  return (
    <TooltipProvider>
      <TooltipContext.Provider value={{ open: isOpen, setOpen, anchorRef }}>
        {children}
      </TooltipContext.Provider>
    </TooltipProvider>
  );
}

export interface TooltipTriggerProps extends React.ComponentProps<"button"> {
  asChild?: boolean;
}

export function TooltipTrigger({
  asChild = false,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  ...props
}: TooltipTriggerProps) {
  const { setOpen, anchorRef } = useTooltip();
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="tooltip-trigger"
      ref={anchorRef as React.Ref<never>}
      onPointerEnter={(e: React.PointerEvent<HTMLButtonElement>) => {
        onPointerEnter?.(e);
        setOpen(true);
      }}
      onPointerLeave={(e: React.PointerEvent<HTMLButtonElement>) => {
        onPointerLeave?.(e);
        setOpen(false);
      }}
      onFocus={(e: React.FocusEvent<HTMLButtonElement>) => {
        onFocus?.(e);
        setOpen(true);
      }}
      onBlur={(e: React.FocusEvent<HTMLButtonElement>) => {
        onBlur?.(e);
        setOpen(false);
      }}
      {...(props as Record<string, unknown>)}
    />
  );
}

export interface TooltipContentProps extends React.ComponentProps<"div"> {
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
}

export function TooltipContent({
  className,
  side: sideProp = "top",
  sideOffset = 0,
  children,
  ...props
}: TooltipContentProps) {
  const { open, anchorRef } = useTooltip();
  const { isPresent, ref: presRef } = usePresence(open);
  const { floatingRef, style, side } = useFloating({
    anchorRef,
    open,
    side: sideProp,
    offset: sideOffset,
  });
  if (!isPresent) return null;
  return (
    <Portal>
      <div
        data-slot="tooltip-content"
        role="tooltip"
        data-state={open ? "open" : "closed"}
        data-side={side}
        ref={mergeRefs(floatingRef, presRef)}
        style={style}
        className={cn(
          "bg-foreground text-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit rounded-md px-3 py-1.5 text-xs text-balance",
          className,
        )}
        {...(props as Record<string, unknown>)}
      >
        {children}
      </div>
    </Portal>
  );
}
