import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import { useDismissableLayer } from "../primitives/dismissable-layer";
import { usePresence } from "../primitives/presence";
import { mergeRefs } from "../primitives/merge-refs";
import { Slot } from "../primitives/slot";
import {
  NAVIGATION_MENU,
  NAVIGATION_MENU_CONTENT,
  NAVIGATION_MENU_INDICATOR,
  NAVIGATION_MENU_ITEM,
  NAVIGATION_MENU_LINK,
  NAVIGATION_MENU_LIST,
  NAVIGATION_MENU_TRIGGER_STYLE,
  NAVIGATION_MENU_VIEWPORT,
} from "../generated/navigation-menu";

/**
 * Fused canonical trigger class string, the mirror of Rust's
 * `navigation_menu_trigger_style()`. Reuse it to style a plain link the same way
 * a `NavigationMenuTrigger` is styled.
 */
export function navigationMenuTriggerStyle(): string {
  return NAVIGATION_MENU_TRIGGER_STYLE;
}

interface ItemCtx {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}
const NavigationMenuItemContext = React.createContext<ItemCtx | null>(null);
function useItem(): ItemCtx {
  const ctx = React.useContext(NavigationMenuItemContext);
  if (!ctx) throw new Error("NavigationMenu parts must be used within <NavigationMenuItem>");
  return ctx;
}

export function NavigationMenu({
  className,
  children,
  viewport = true,
  ...props
}: React.ComponentProps<"nav"> & { viewport?: boolean }) {
  return (
    <nav
      data-slot="navigation-menu"
      data-viewport={viewport}
      role="navigation"
      className={cn(
        NAVIGATION_MENU,
        className,
      )}
      {...props}
    >
      {children}
      {viewport && <NavigationMenuViewport />}
    </nav>
  );
}

export function NavigationMenuList({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="navigation-menu-list"
      role="list"
      className={cn(
        NAVIGATION_MENU_LIST,
        className,
      )}
      {...props}
    />
  );
}

export interface NavigationMenuItemProps extends React.ComponentProps<"li"> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function NavigationMenuItem({
  className,
  open,
  defaultOpen = false,
  onOpenChange,
  children,
  ...props
}: NavigationMenuItemProps) {
  const [isOpen, setOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  return (
    <NavigationMenuItemContext.Provider value={{ open: isOpen, setOpen, triggerRef }}>
      <li data-slot="navigation-menu-item" className={cn(NAVIGATION_MENU_ITEM, className)} {...props}>
        {children}
      </li>
    </NavigationMenuItemContext.Provider>
  );
}

export function NavigationMenuTrigger({
  className,
  children,
  onClick,
  ...props
}: React.ComponentProps<"button">) {
  const { open, setOpen, triggerRef } = useItem();
  return (
    <button
      ref={triggerRef}
      type="button"
      data-slot="navigation-menu-trigger"
      data-state={open ? "open" : "closed"}
      className={cn(navigationMenuTriggerStyle(), "group", className)}
      onClick={(e) => {
        onClick?.(e);
        setOpen(!open);
      }}
      {...props}
    >
      {children}{" "}
      <svg
        className="relative top-[1px] ml-1 size-3 transition duration-300 group-data-[state=open]:rotate-180"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}

export function NavigationMenuContent({ className, children, ...props }: React.ComponentProps<"div">) {
  const { open, setOpen, triggerRef } = useItem();
  const { isPresent, ref: presenceRef } = usePresence(open);
  const dismissRef = useDismissableLayer({
    enabled: open,
    onDismiss: () => setOpen(false),
    exclude: [triggerRef],
  });
  if (!isPresent) return null;
  return (
    <div
      ref={mergeRefs(presenceRef, dismissRef)}
      data-slot="navigation-menu-content"
      data-state={open ? "open" : "closed"}
      className={cn(
        NAVIGATION_MENU_CONTENT,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function NavigationMenuViewport({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className="absolute top-full left-0 isolate z-50 flex justify-center">
      <div
        data-slot="navigation-menu-viewport"
        className={cn(
          NAVIGATION_MENU_VIEWPORT,
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function NavigationMenuLink({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"a"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "a";
  return (
    <Comp
      data-slot="navigation-menu-link"
      className={cn(
        NAVIGATION_MENU_LINK,
        className,
      )}
      {...(props as Record<string, unknown>)}
    />
  );
}

export function NavigationMenuIndicator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="navigation-menu-indicator"
      className={cn(
        NAVIGATION_MENU_INDICATOR,
        className,
      )}
      {...props}
    >
      <div className="bg-border relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm shadow-md" />
    </div>
  );
}
