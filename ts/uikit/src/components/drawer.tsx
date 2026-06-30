import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import { useFocusScope } from "../primitives/focus-scope";
import { mergeRefs } from "../primitives/merge-refs";
import { Portal } from "../primitives/portal";
import { Slot } from "../primitives/slot";
import {
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

// drag-to-dismiss: omitted vs vaul — see README Limitations

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

export function DrawerContent({ className, children, ...props }: React.ComponentProps<"div">) {
  const { open, setOpen, direction } = useDrawer();
  const scopeRef = useFocusScope(open);
  if (!open) return null;
  return (
    <Portal>
      <div
        data-slot="drawer-overlay"
        className={DRAWER_OVERLAY}
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        data-slot="drawer-content"
        data-state="open"
        data-vaul-drawer-direction={direction}
        ref={mergeRefs(scopeRef)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className={cn(DRAWER_CONTENT_BASE, drawerDirectionClasses[direction], className)}
        {...(props as Record<string, unknown>)}
      >
        {direction === "bottom" ? (
          <div
            data-slot="drawer-handle"
            className={DRAWER_HANDLE}
          />
        ) : null}
        {children}
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
