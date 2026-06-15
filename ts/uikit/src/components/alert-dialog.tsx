import * as React from "react";
import { cn } from "../lib/cn";
import { buttonVariants } from "./button";
import { useControllableState } from "../primitives/use-controllable-state";
import { useDismissableLayer } from "../primitives/dismissable-layer";
import { useFocusScope } from "../primitives/focus-scope";
import { usePresence } from "../primitives/presence";
import { mergeRefs } from "../primitives/merge-refs";
import { Portal } from "../primitives/portal";
import { Slot } from "../primitives/slot";

interface AlertDialogContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | null>(null);

function useAlertDialog(): AlertDialogContextValue {
  const ctx = React.useContext(AlertDialogContext);
  if (!ctx) throw new Error("AlertDialog parts must be used within <AlertDialog>");
  return ctx;
}

export interface AlertDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function AlertDialog({ open, defaultOpen = false, onOpenChange, children }: AlertDialogProps) {
  const [isOpen, setOpen] = useControllableState<boolean>({
    ...(open !== undefined ? { value: open } : {}),
    defaultValue: defaultOpen,
    ...(onOpenChange ? { onChange: onOpenChange } : {}),
  });
  const triggerRef = React.useRef<HTMLElement | null>(null);
  return (
    <AlertDialogContext.Provider value={{ open: isOpen, setOpen, triggerRef }}>
      {children}
    </AlertDialogContext.Provider>
  );
}

export interface AlertDialogTriggerProps extends React.ComponentProps<"button"> {
  asChild?: boolean;
}

export function AlertDialogTrigger({ asChild = false, onClick, ...props }: AlertDialogTriggerProps) {
  const { open, setOpen, triggerRef } = useAlertDialog();
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="alert-dialog-trigger"
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

export interface AlertDialogOverlayProps extends React.ComponentProps<"div"> {}

export function AlertDialogOverlay({ className, ...props }: AlertDialogOverlayProps) {
  const { open, setOpen } = useAlertDialog();
  return (
    <div
      data-slot="alert-dialog-overlay"
      data-state={open ? "open" : "closed"}
      onClick={() => setOpen(false)}
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className,
      )}
      {...(props as Record<string, unknown>)}
    />
  );
}

export interface AlertDialogContentProps extends React.ComponentProps<"div"> {}

export function AlertDialogContent({ className, children, ...props }: AlertDialogContentProps) {
  const { open, setOpen, triggerRef } = useAlertDialog();
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
      <AlertDialogOverlay />
      <div
        data-slot="alert-dialog-content"
        role="alertdialog"
        aria-modal="true"
        data-state={open ? "open" : "closed"}
        ref={mergeRefs(focusRef, dismissRef, presRef as React.Ref<HTMLDivElement>)}
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className,
        )}
        {...(props as Record<string, unknown>)}
      >
        {children}
      </div>
    </Portal>
  );
}

export function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

export function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export function AlertDialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="alert-dialog-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  );
}

export function AlertDialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="alert-dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export interface AlertDialogActionProps extends React.ComponentProps<"button"> {}

export function AlertDialogAction({ className, onClick, ...props }: AlertDialogActionProps) {
  const { setOpen } = useAlertDialog();
  return (
    <button
      data-slot="alert-dialog-action"
      className={cn(buttonVariants(), className)}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        setOpen(false);
      }}
      {...(props as Record<string, unknown>)}
    />
  );
}

export interface AlertDialogCancelProps extends React.ComponentProps<"button"> {}

export function AlertDialogCancel({ className, onClick, ...props }: AlertDialogCancelProps) {
  const { setOpen } = useAlertDialog();
  return (
    <button
      data-slot="alert-dialog-cancel"
      className={cn(buttonVariants({ variant: "outline" }), className)}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        setOpen(false);
      }}
      {...(props as Record<string, unknown>)}
    />
  );
}
