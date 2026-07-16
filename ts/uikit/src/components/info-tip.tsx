import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import { useFloating } from "../primitives/use-floating";
import { useDismissableLayer } from "../primitives/dismissable-layer";
import { usePresence } from "../primitives/presence";
import { useHoverIntent } from "../primitives/use-hover-intent";
import { mergeRefs } from "../primitives/merge-refs";
import { Portal } from "../primitives/portal";
import { Slot } from "../primitives/slot";
import { POPOVER_CONTENT } from "../generated/popover";

/**
 * `InfoTip` — the ⓘ-beside-a-label *toggletip*. It reuses the popover machinery
 * (controllable state + floating + dismissable layer + portal) but deliberately
 * NOT the tooltip ARIA: the trigger is a real `<button aria-expanded aria-controls>`
 * and the bubble is a `role="status"` live region, never `role="tooltip"`. That is
 * the pattern that stays correct across mouse, keyboard and touch (a `role=tooltip`
 * is hover/focus-only and never opens on tap). Hover-with-intent (~0.5s) is layered
 * on as a mouse-only enhancement; click/tap/Enter/Space toggle instantly.
 *
 * The bubble holds plain, non-interactive help text — it does not trap focus and
 * nothing inside it is focusable, so there is no focus to manage or return.
 */
interface InfoTipContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  contentId: string;
}

const InfoTipContext = React.createContext<InfoTipContextValue | null>(null);

function useInfoTip(): InfoTipContextValue {
  const ctx = React.useContext(InfoTipContext);
  if (!ctx) throw new Error("InfoTip parts must be used within <InfoTip>");
  return ctx;
}

export interface InfoTipProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function InfoTip({
  open,
  defaultOpen = false,
  onOpenChange,
  children,
}: InfoTipProps) {
  const [isOpen, setOpen] = useControllableState<boolean>({
    ...(open !== undefined ? { value: open } : {}),
    defaultValue: defaultOpen,
    ...(onOpenChange ? { onChange: onOpenChange } : {}),
  });
  const anchorRef = React.useRef<HTMLElement | null>(null);
  const contentId = React.useId();
  return (
    <InfoTipContext.Provider
      value={{ open: isOpen, setOpen, anchorRef, contentId }}
    >
      {children}
    </InfoTipContext.Provider>
  );
}

// lucide `info`, inlined per the kit's no-lucide-dep icon convention.
function InfoGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("size-4", className)}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export interface InfoTipTriggerProps extends React.ComponentProps<"button"> {
  asChild?: boolean;
  /** Accessible name for the icon-only button. */
  label?: string;
  /** Milliseconds the mouse must dwell before the tip opens on hover. */
  hoverDelay?: number;
}

export function InfoTipTrigger({
  asChild = false,
  label = "More information",
  hoverDelay = 500,
  className,
  onClick,
  onBlur,
  onPointerEnter,
  onPointerLeave,
  children,
  ...props
}: InfoTipTriggerProps) {
  const { open, setOpen, anchorRef, contentId } = useInfoTip();
  const hover = useHoverIntent({
    onOpen: () => setOpen(true),
    onClose: () => setOpen(false),
    openDelay: hoverDelay,
  });
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="info-tip-trigger"
      data-state={open ? "open" : "closed"}
      type={asChild ? undefined : "button"}
      aria-label={label}
      aria-expanded={open}
      aria-controls={contentId}
      ref={anchorRef as React.Ref<never>}
      className={cn(
        "inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full align-middle text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:text-main-accent-t1",
        className,
      )}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        setOpen(!open);
      }}
      onBlur={(e: React.FocusEvent<HTMLButtonElement>) => {
        onBlur?.(e);
        setOpen(false);
      }}
      onPointerEnter={(e: React.PointerEvent<HTMLButtonElement>) => {
        onPointerEnter?.(e);
        hover.onPointerEnter(e);
      }}
      onPointerLeave={(e: React.PointerEvent<HTMLButtonElement>) => {
        onPointerLeave?.(e);
        hover.onPointerLeave(e);
      }}
      {...(props as Record<string, unknown>)}
    >
      {children ?? <InfoGlyph />}
    </Comp>
  );
}

export interface InfoTipContentProps extends React.ComponentProps<"div"> {
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

export function InfoTipContent({
  className,
  side: sideProp = "bottom",
  align = "center",
  sideOffset = 6,
  children,
  ...props
}: InfoTipContentProps) {
  const { open, setOpen, anchorRef, contentId } = useInfoTip();
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
        id={contentId}
        role="status"
        aria-live="polite"
        data-slot="info-tip-content"
        data-state={open ? "open" : "closed"}
        data-side={side}
        data-align={align}
        ref={mergeRefs(floatingRef, dismissRef, presRef)}
        style={style}
        className={cn(POPOVER_CONTENT, "w-64 p-3 text-sm", className)}
        {...(props as Record<string, unknown>)}
      >
        {children}
      </div>
    </Portal>
  );
}
