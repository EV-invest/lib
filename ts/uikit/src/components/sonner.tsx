import * as React from "react";
import { cn } from "../lib/cn";

export type ToastVariant = "default" | "success" | "error" | "info" | "warning";

export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface ToastOptions {
  description?: React.ReactNode;
  duration?: number;
  variant?: ToastVariant;
}

export interface Toast {
  id: number;
  message: React.ReactNode;
  description?: React.ReactNode;
  duration: number;
  variant: ToastVariant;
}

const DEFAULT_DURATION = 4000;

/**
 * Module-level toast store: a plain observable holding the live toast array.
 * `toast(...)` mutates it and notifies subscribers; the {@link Toaster}
 * component is the sole subscriber. This is the JS-native global the Rust
 * mirror cannot have — Dioxus has no clean cross-component mutable singleton,
 * so it uses a `ToasterProvider` + `use_toaster()` hook instead.
 */
const store = (() => {
  let toasts: Toast[] = [];
  let id = 0;
  const listeners = new Set<(toasts: Toast[]) => void>();

  const emit = () => {
    for (const listener of listeners) listener(toasts);
  };

  const add = (message: React.ReactNode, opts: ToastOptions = {}): number => {
    const next: Toast = {
      id: ++id,
      message,
      description: opts.description,
      duration: opts.duration ?? DEFAULT_DURATION,
      variant: opts.variant ?? "default",
    };
    toasts = [...toasts, next];
    emit();
    return next.id;
  };

  const dismiss = (toastId: number) => {
    toasts = toasts.filter((t) => t.id !== toastId);
    emit();
  };

  const subscribe = (listener: (toasts: Toast[]) => void): (() => void) => {
    listeners.add(listener);
    listener(toasts);
    return () => {
      listeners.delete(listener);
    };
  };

  return { add, dismiss, subscribe };
})();

export interface ToastFn {
  (message: React.ReactNode, opts?: ToastOptions): number;
  success: (message: React.ReactNode, opts?: ToastOptions) => number;
  error: (message: React.ReactNode, opts?: ToastOptions) => number;
  info: (message: React.ReactNode, opts?: ToastOptions) => number;
  warning: (message: React.ReactNode, opts?: ToastOptions) => number;
  dismiss: (id: number) => void;
}

/**
 * Global toast handle. `toast(msg)` enqueues a neutral toast; the `.success`,
 * `.error`, `.info` and `.warning` helpers pin the variant; `toast.dismiss(id)`
 * removes one early. Mirrors Rust's `use_toaster()` handle methods.
 */
export const toast: ToastFn = Object.assign(
  (message: React.ReactNode, opts?: ToastOptions) => store.add(message, opts),
  {
    success: (message: React.ReactNode, opts?: ToastOptions) =>
      store.add(message, { ...opts, variant: "success" }),
    error: (message: React.ReactNode, opts?: ToastOptions) =>
      store.add(message, { ...opts, variant: "error" }),
    info: (message: React.ReactNode, opts?: ToastOptions) =>
      store.add(message, { ...opts, variant: "info" }),
    warning: (message: React.ReactNode, opts?: ToastOptions) =>
      store.add(message, { ...opts, variant: "warning" }),
    dismiss: (id: number) => store.dismiss(id),
  },
);

const toastVariantClasses: Record<ToastVariant, string> = {
  default: "bg-popover text-popover-foreground border-border",
  success: "bg-popover text-popover-foreground border-main-accent-t2/40",
  error: "bg-popover text-popover-foreground border-destructive/50",
  info: "bg-popover text-popover-foreground border-border",
  warning: "bg-popover text-popover-foreground border-border",
};

const positionClasses: Record<ToastPosition, string> = {
  "top-left": "top-0 left-0 items-start",
  "top-center": "top-0 left-1/2 -translate-x-1/2 items-center",
  "top-right": "top-0 right-0 items-end",
  "bottom-left": "bottom-0 left-0 items-start",
  "bottom-center": "bottom-0 left-1/2 -translate-x-1/2 items-center",
  "bottom-right": "bottom-0 right-0 items-end",
};

function ToastItem({ toast: t }: { toast: Toast }) {
  React.useEffect(() => {
    if (t.duration === Infinity) return;
    const timer = setTimeout(() => store.dismiss(t.id), t.duration);
    return () => clearTimeout(timer);
  }, [t.id, t.duration]);

  return (
    <li
      role="status"
      aria-live="polite"
      data-slot="toast"
      data-variant={t.variant}
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-md border p-4 text-sm shadow-lg",
        toastVariantClasses[t.variant],
      )}
    >
      <div className="flex-1 space-y-1">
        <div className="font-medium">{t.message}</div>
        {t.description ? (
          <div className="text-muted-foreground text-sm">{t.description}</div>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Close"
        data-slot="toast-close"
        onClick={() => store.dismiss(t.id)}
        className="text-foreground/50 hover:text-foreground shrink-0 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </li>
  );
}

export interface ToasterProps extends React.ComponentProps<"ol"> {
  position?: ToastPosition;
}

/**
 * Renders the live toast stack from the module store. Fixed-positioned per
 * `position` (default `bottom-right`); each toast auto-dismisses after its
 * `duration` (default 4000ms) via `setTimeout`. Single dark palette — no theme
 * switching (the upstream `next-themes` dependency is dropped).
 */
export function Toaster({
  position = "bottom-right",
  className,
  ...props
}: ToasterProps) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  React.useEffect(() => store.subscribe(setToasts), []);

  return (
    <ol
      data-slot="toaster"
      data-position={position}
      className={cn(
        "pointer-events-none fixed z-100 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 p-4",
        positionClasses[position],
        className,
      )}
      {...props}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </ol>
  );
}
