import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import { useFloating } from "../primitives/use-floating";
import { usePresence } from "../primitives/presence";
import { mergeRefs } from "../primitives/merge-refs";
import { Portal } from "../primitives/portal";
import { Slot } from "../primitives/slot";
import { HOVER_CARD_CONTENT } from "../generated/hover-card";

interface HoverCardContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

const HoverCardContext = React.createContext<HoverCardContextValue | null>(null);

function useHoverCard(): HoverCardContextValue {
  const ctx = React.useContext(HoverCardContext);
  if (!ctx) throw new Error("HoverCard parts must be used within <HoverCard>");
  return ctx;
}

export interface HoverCardProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function HoverCard({ open, defaultOpen = false, onOpenChange, children }: HoverCardProps) {
  const [isOpen, setOpen] = useControllableState<boolean>({
    ...(open !== undefined ? { value: open } : {}),
    defaultValue: defaultOpen,
    ...(onOpenChange ? { onChange: onOpenChange } : {}),
  });
  const anchorRef = React.useRef<HTMLElement | null>(null);
  return (
    <HoverCardContext.Provider value={{ open: isOpen, setOpen, anchorRef }}>
      {children}
    </HoverCardContext.Provider>
  );
}

export interface HoverCardTriggerProps extends React.ComponentProps<"a"> {
  asChild?: boolean;
}

export function HoverCardTrigger({
  asChild = false,
  onPointerEnter,
  onPointerLeave,
  ...props
}: HoverCardTriggerProps) {
  const { setOpen, anchorRef } = useHoverCard();
  const Comp = asChild ? Slot : "a";
  return (
    <Comp
      data-slot="hover-card-trigger"
      ref={anchorRef as React.Ref<never>}
      onPointerEnter={(e: React.PointerEvent<HTMLAnchorElement>) => {
        onPointerEnter?.(e);
        setOpen(true);
      }}
      onPointerLeave={(e: React.PointerEvent<HTMLAnchorElement>) => {
        onPointerLeave?.(e);
        setOpen(false);
      }}
      {...(props as Record<string, unknown>)}
    />
  );
}

export interface HoverCardContentProps extends React.ComponentProps<"div"> {
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

export function HoverCardContent({
  className,
  side: sideProp = "bottom",
  align = "center",
  sideOffset = 4,
  children,
  ...props
}: HoverCardContentProps) {
  const { open, anchorRef } = useHoverCard();
  const { isPresent, ref: presRef } = usePresence(open);
  const { floatingRef, style, side } = useFloating({
    anchorRef,
    open,
    side: sideProp,
    align,
    offset: sideOffset,
  });
  if (!isPresent) return null;
  return (
    <Portal>
      <div
        data-slot="hover-card-content"
        data-state={open ? "open" : "closed"}
        data-side={side}
        data-align={align}
        ref={mergeRefs(floatingRef, presRef)}
        style={style}
        className={cn(HOVER_CARD_CONTENT, className)}
        {...(props as Record<string, unknown>)}
      >
        {children}
      </div>
    </Portal>
  );
}
