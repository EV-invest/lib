import * as React from "react";
import { cn } from "../lib/cn";

export type ToastVariant = "default" | "success" | "error" | "info" | "warning";

/**
 * Lifecycle phase of a toast. It is added `"open"` (plays the enter keyframe);
 * {@link ToastFn.dismiss} flips it to `"closing"` (plays the exit keyframe) and
 * the live node is dropped once the exit `animationend` fires. Mirrors Rust's
 * `ToastState` enum and the `data-state` the shared `tokens.css` keys on.
 */
export type ToastState = "open" | "closing";

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
  state: ToastState;
}

const DEFAULT_DURATION = 4000;

// Swipe-to-dismiss tuning (pointer physics, TS-only — Rust stays render-only).
// Values from Sonner: a horizontal drag past 45px, or a flick faster than
// 0.11px/ms, flings the toast off; anything short snaps back.
const SWIPE_THRESHOLD = 45;
const SWIPE_VELOCITY = 0.11;
const SWIPE_FLING_MS = 200;

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
      state: "open",
    };
    toasts = [...toasts, next];
    emit();
    return next.id;
  };

  // Begins the exit animation: flip the toast to `closing` (`data-state=closed`)
  // and keep it mounted so the exit keyframe can play. The live node is dropped
  // by `remove`, wired to the exit `animationend` — no timer matched to the CSS.
  const dismiss = (toastId: number) => {
    toasts = toasts.map((t) =>
      t.id === toastId ? { ...t, state: "closing" as const } : t,
    );
    emit();
  };

  // Drops a toast outright. Wired to the exit `animationend`; the guard that it
  // is actually `closing` (the enter `animationend` fires too) lives at the call
  // site in {@link ToastItem}.
  const remove = (toastId: number) => {
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

  return { add, dismiss, remove, subscribe };
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
  const ref = React.useRef<HTMLLIElement>(null);
  // Holds whichever timeout is pending for this toast (auto-dismiss, or the
  // swipe-fling fallback); `clearTimer` cancels it on unmount or gesture start.
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const dragRef = React.useRef<{ x: number; time: number; dx: number } | null>(
    null,
  );

  const clearTimer = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);
  const startTimer = React.useCallback(() => {
    clearTimer();
    if (t.duration === Infinity || t.state === "closing") return;
    timerRef.current = setTimeout(() => store.dismiss(t.id), t.duration);
  }, [clearTimer, t.id, t.duration, t.state]);

  React.useEffect(() => {
    startTimer();
    return clearTimer;
  }, [startTimer, clearTimer]);

  // ── swipe-to-dismiss (horizontal pointer drag) ──────────────────────────
  // The live transform is driven inline, so the finished enter keyframe's fill
  // (CSS animations beat normal declarations) is released with `animation:none`
  // for the duration of the gesture and handed back to the CSS on snap-back.
  const onPointerDown = (e: React.PointerEvent<HTMLLIElement>) => {
    const el = ref.current;
    if (!el || e.button > 0 || t.state === "closing") return;
    if ((e.target as HTMLElement).closest('[data-slot="toast-close"]')) return;
    clearTimer();
    dragRef.current = { x: e.clientX, time: e.timeStamp, dx: 0 };
    el.setAttribute("data-swiping", "true");
    el.style.animation = "none";
    el.style.transition = "none";
    try {
      el.setPointerCapture?.(e.pointerId);
    } catch {
      // jsdom / unsupported — capture is a nice-to-have, the drag works without it
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLLIElement>) => {
    const drag = dragRef.current;
    const el = ref.current;
    if (!drag || !el) return;
    const dx = e.clientX - drag.x;
    drag.dx = dx;
    const dist = el.offsetWidth || 256;
    el.style.transform = `translateX(${dx}px)`;
    el.style.opacity = `${Math.max(0, 1 - Math.abs(dx) / dist)}`;
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLLIElement>) => {
    const drag = dragRef.current;
    const el = ref.current;
    if (!drag || !el) return;
    dragRef.current = null;
    el.removeAttribute("data-swiping");
    const dt = e.timeStamp - drag.time;
    const velocity = dt > 0 ? Math.abs(drag.dx) / dt : 0;
    el.style.transition = `transform ${SWIPE_FLING_MS}ms ease-out, opacity ${SWIPE_FLING_MS}ms ease-out`;
    if (drag.dx !== 0 && (Math.abs(drag.dx) >= SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY)) {
      el.style.transform = `translateX(${drag.dx > 0 ? 150 : -150}%)`;
      el.style.opacity = "0";
      const remove = () => store.remove(t.id);
      el.addEventListener("transitionend", remove, { once: true });
      timerRef.current = setTimeout(remove, SWIPE_FLING_MS + 50); // fallback if transitionend is missed
    } else {
      el.style.transform = "translateX(0)";
      el.style.opacity = "1";
      el.addEventListener(
        "transitionend",
        () => {
          // hand the resting + future exit styles back to the CSS keyframes
          el.style.transition = "";
          el.style.transform = "";
          el.style.opacity = "";
          el.style.animation = "";
          startTimer();
        },
        { once: true },
      );
    }
  };

  return (
    <li
      ref={ref}
      role="status"
      aria-live="polite"
      data-slot="toast"
      data-variant={t.variant}
      data-state={t.state === "closing" ? "closed" : "open"}
      onAnimationEnd={() => {
        if (t.state === "closing") store.remove(t.id);
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      className={cn(
        "pointer-events-auto flex w-full touch-pan-y items-start gap-3 rounded-md border p-4 text-sm shadow-lg select-none",
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
 * `duration` (default 4000ms) via `setTimeout`, which routes through the same
 * animated `dismiss` as the close button: the toast flips to
 * `data-state="closed"`, plays the exit keyframe from the shared `tokens.css`,
 * and is unmounted on its `animationend` (no timer matched to the CSS).
 * Direction follows `data-position`; `prefers-reduced-motion` swaps the slide
 * for a fade. Toasts are also swipe-to-dismiss (horizontal pointer drag — this
 * pointer physics is TS-only; Rust stays render-only). Single dark palette — no
 * theme switching (the upstream `next-themes` dependency is dropped).
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
