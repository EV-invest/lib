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
  DIALOG_CLOSE,
  DIALOG_CONTENT,
  DIALOG_DESCRIPTION,
  DIALOG_FOOTER,
  DIALOG_HEADER,
  DIALOG_OVERLAY,
  DIALOG_TITLE,
} from "../generated/dialog";

interface DialogContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialog(): DialogContextValue {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error("Dialog parts must be used within <Dialog>");
  return ctx;
}

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function Dialog({ open, defaultOpen = false, onOpenChange, children }: DialogProps) {
  const [isOpen, setOpen] = useControllableState<boolean>({
    ...(open !== undefined ? { value: open } : {}),
    defaultValue: defaultOpen,
    ...(onOpenChange ? { onChange: onOpenChange } : {}),
  });
  const triggerRef = React.useRef<HTMLElement | null>(null);
  return (
    <DialogContext.Provider value={{ open: isOpen, setOpen, triggerRef }}>
      {children}
    </DialogContext.Provider>
  );
}

export interface DialogTriggerProps extends React.ComponentProps<"button"> {
  asChild?: boolean;
}

export function DialogTrigger({ asChild = false, onClick, ...props }: DialogTriggerProps) {
  const { open, setOpen, triggerRef } = useDialog();
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="dialog-trigger"
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

export type DialogPortalProps = { children?: React.ReactNode };

export function DialogPortal({ children }: DialogPortalProps) {
  return <>{children}</>;
}

export interface DialogOverlayProps extends React.ComponentProps<"div"> {}

export function DialogOverlay({ className, ...props }: DialogOverlayProps) {
  const { open, setOpen } = useDialog();
  return (
    <div
      data-slot="dialog-overlay"
      data-state={open ? "open" : "closed"}
      onClick={() => setOpen(false)}
      className={cn(DIALOG_OVERLAY, className)}
      {...(props as Record<string, unknown>)}
    />
  );
}

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

export interface DialogContentProps extends React.ComponentProps<"div"> {
  showCloseButton?: boolean;
}

export function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogContentProps) {
  const { open, setOpen, triggerRef } = useDialog();
  const { isPresent, ref: presRef } = usePresence(open);
  const focusRef = useFocusScope(open);
  const dismissRef = useDismissableLayer({
    enabled: open,
    onDismiss: () => setOpen(false),
    exclude: [triggerRef],
  });
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!isPresent) return null;
  return (
    <Portal>
      <DialogOverlay />
      <div
        data-slot="dialog-content"
        role="dialog"
        aria-modal="true"
        data-state={open ? "open" : "closed"}
        ref={mergeRefs(focusRef, dismissRef, presRef as React.Ref<HTMLDivElement>)}
        className={cn(DIALOG_CONTENT, className)}
        {...(props as Record<string, unknown>)}
      >
        {children}
        {showCloseButton && (
          <button
            type="button"
            data-slot="dialog-close"
            onClick={() => setOpen(false)}
            className={DIALOG_CLOSE}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </button>
        )}
      </div>
    </Portal>
  );
}

export interface DialogCloseProps extends React.ComponentProps<"button"> {
  asChild?: boolean;
}

export function DialogClose({ asChild = false, onClick, ...props }: DialogCloseProps) {
  const { setOpen } = useDialog();
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="dialog-close"
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        setOpen(false);
      }}
      {...(props as Record<string, unknown>)}
    />
  );
}

export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(DIALOG_HEADER, className)}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(DIALOG_FOOTER, className)}
      {...props}
    />
  );
}

export function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="dialog-title"
      className={cn(DIALOG_TITLE, className)}
      {...props}
    />
  );
}

export function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="dialog-description"
      className={cn(DIALOG_DESCRIPTION, className)}
      {...props}
    />
  );
}
