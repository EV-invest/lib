import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import { useFocusScope } from "../primitives/focus-scope";
import { mergeRefs } from "../primitives/merge-refs";
import { Portal } from "../primitives/portal";
import { Slot } from "../primitives/slot";

// drag-to-dismiss: omitted vs vaul — see README Limitations

type DrawerDirection = "top" | "bottom" | "left" | "right";

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

const directionClasses: Record<DrawerDirection, string> = {
  bottom: "inset-x-0 bottom-0 mt-24 max-h-[80vh] flex-col rounded-t-lg border-b-0",
  top: "inset-x-0 top-0 mb-24 max-h-[80vh] flex-col rounded-b-lg border-t-0",
  left: "inset-y-0 left-0 w-3/4 flex-row border-r sm:max-w-sm",
  right: "inset-y-0 right-0 w-3/4 flex-row border-l sm:max-w-sm",
};

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
      className={cn("fixed inset-0 z-50 bg-black/50", className)}
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
        className="fixed inset-0 z-50 bg-black/50"
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
        className={cn(
          "bg-background fixed z-50 flex h-auto border",
          directionClasses[direction],
          className,
        )}
        {...(props as Record<string, unknown>)}
      >
        {direction === "bottom" ? (
          <div
            data-slot="drawer-handle"
            className="bg-muted mx-auto mt-4 hidden h-2 w-[100px] shrink-0 rounded-full"
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
      className={cn("flex flex-col gap-0.5 p-4 text-center sm:gap-1.5 sm:text-left", className)}
      {...props}
    />
  );
}

export function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

export function DrawerTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  );
}

export function DrawerDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}
