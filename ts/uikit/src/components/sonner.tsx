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
  /**
   * Auto-dismiss delay in ms (default 4000). Pass `Infinity` for a **persistent**
   * toast that never times out — it stays until the close button, a swipe, or
   * `toast.dismiss(id)` removes it. Hovering the stack also pauses the countdown.
   */
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

// The toaster carries the viewport inset itself (no padding) so the absolutely
// positioned toasts size to its box and don't spill past the edge.
const positionClasses: Record<ToastPosition, string> = {
  "top-left": "top-4 left-4",
  "top-center": "top-4 left-1/2 -translate-x-1/2",
  "top-right": "top-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
  "bottom-right": "bottom-4 right-4",
};

// Sonner-style stacking: only the front VISIBLE_TOASTS show collapsed; GAP is
// the px between them once expanded.
const VISIBLE_TOASTS = 3;
const GAP = 14;

interface ToastItemProps {
  toast: Toast;
  index: number; // 0 = front / newest
  total: number;
  offset: number; // px from the pinned edge to this toast's expanded slot
  paused: boolean; // the stack is hovered/focused — hold the auto-dismiss
  reportHeight: (id: number, height: number) => void;
  removeHeight: (id: number) => void;
}

function ToastItem({
  toast: t,
  index,
  total,
  offset,
  paused,
  reportHeight,
  removeHeight,
}: ToastItemProps) {
  const ref = React.useRef<HTMLLIElement>(null);
  const [height, setHeight] = React.useState(0);
  // remaining auto-dismiss budget (banked across hover pauses), the last start
  // timestamp, and the swipe-fling fallback timer.
  const remainingRef = React.useRef(t.duration);
  const startedRef = React.useRef(0);
  const flingRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const dragRef = React.useRef<{ x: number; time: number; dx: number } | null>(
    null,
  );

  // measure the *natural* height for the stack maths; re-measure on content
  // change. Back toasts are clamped to --front-height by the CSS, so unset the
  // height for the read (Sonner does the same) then hand it back to the CSS.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const h = el.getBoundingClientRect().height;
    el.style.height = "";
    if (h) {
      setHeight(h);
      reportHeight(t.id, h);
    }
  }, [t.id, t.message, t.description, reportHeight]);

  React.useEffect(() => () => removeHeight(t.id), [t.id, removeHeight]);

  // Auto-dismiss, pausable on hover. While `paused` (or closing, or a persistent
  // `duration: Infinity`) no timer runs; the cleanup banks the elapsed time so a
  // resume continues from the remaining budget rather than restarting.
  React.useEffect(() => {
    if (t.duration === Infinity || t.state === "closing" || paused) return;
    startedRef.current = Date.now();
    const id = setTimeout(() => store.dismiss(t.id), remainingRef.current);
    return () => {
      clearTimeout(id);
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (Date.now() - startedRef.current),
      );
    };
  }, [paused, t.id, t.duration, t.state]);

  // cancel the swipe-fling fallback if the toast unmounts first
  React.useEffect(
    () => () => {
      if (flingRef.current) clearTimeout(flingRef.current);
    },
    [],
  );

  // exit rides the transition: a closing toast slides back off and is dropped on
  // the transform's `transitionend` (guarded so stack repositioning never fires
  // it). No host timer — keeps parity with the Dioxus port.
  const onTransitionEnd = (e: React.TransitionEvent<HTMLLIElement>) => {
    if (t.state === "closing" && e.propertyName === "transform") {
      store.remove(t.id);
    }
  };

  // ── swipe-to-dismiss (horizontal pointer drag) ──────────────────────────
  // Tracked through the `--swipe-x` var so it *composes* with the stack
  // transform (`var(--y) translateX(var(--swipe-x))`) instead of overriding it.
  const onPointerDown = (e: React.PointerEvent<HTMLLIElement>) => {
    const el = ref.current;
    if (!el || e.button > 0 || t.state === "closing") return;
    if ((e.target as HTMLElement).closest('[data-slot="toast-close"]')) return;
    // auto-dismiss is already paused (a swipe means the pointer is over the stack)
    dragRef.current = { x: e.clientX, time: e.timeStamp, dx: 0 };
    el.setAttribute("data-swiping", "true"); // CSS drops the transition for 1:1 tracking
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
    el.style.setProperty("--swipe-x", `${dx}px`);
    el.style.opacity = `${Math.max(0, 1 - Math.abs(dx) / dist)}`;
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLLIElement>) => {
    const drag = dragRef.current;
    const el = ref.current;
    if (!drag || !el) return;
    dragRef.current = null;
    el.removeAttribute("data-swiping"); // CSS restores the transition
    const dt = e.timeStamp - drag.time;
    const velocity = dt > 0 ? Math.abs(drag.dx) / dt : 0;
    if (
      drag.dx !== 0 &&
      (Math.abs(drag.dx) >= SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY)
    ) {
      el.style.setProperty("--swipe-x", `${drag.dx > 0 ? 150 : -150}%`);
      el.style.opacity = "0";
      const remove = () => store.remove(t.id);
      el.addEventListener("transitionend", remove, { once: true });
      flingRef.current = setTimeout(remove, SWIPE_FLING_MS + 50); // fallback if transitionend is missed
    } else {
      // snap back: clear the swipe offset (the transition carries it home), then
      // hand styling back to the CSS. Auto-dismiss stays paused while hovered and
      // re-arms from the remaining budget once the pointer leaves.
      el.style.setProperty("--swipe-x", "0px");
      el.style.opacity = "1";
      el.addEventListener(
        "transitionend",
        () => {
          el.style.removeProperty("--swipe-x");
          el.style.opacity = "";
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
      data-front={index === 0}
      data-visible={index < VISIBLE_TOASTS}
      onTransitionEnd={onTransitionEnd}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      style={
        {
          "--index": index,
          "--z-index": total - index,
          "--offset": `${offset}px`,
          "--initial-height": `${height}px`,
        } as React.CSSProperties
      }
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
 * `position` (default `bottom-right`).
 *
 * Stacking mirrors Sonner: toasts pile up collapsed (the front three peeking,
 * each scaled + lifted by depth and clamped to the front toast's height) and
 * spread into a list on hover / keyboard focus — driven by the measured
 * `--front-height`/`--offset` vars and the `data-stack` CSS in `tokens.css`.
 * Each toast auto-dismisses after its `duration` (default 4000ms) via the same
 * animated `dismiss` as the close button (`data-state="closed"` → slide out →
 * unmount on `transitionend`), and is swipe-to-dismiss (horizontal drag, TS-only
 * pointer physics). Single dark palette — no theme switching.
 */
export function Toaster({
  position = "bottom-right",
  className,
  ...props
}: ToasterProps) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [heights, setHeights] = React.useState<Map<number, number>>(new Map());
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => store.subscribe(setToasts), []);

  // Pause auto-dismiss while the stack is hovered or keyboard-focused (Sonner
  // does the same). pointerover/out + focusin/out bubble from the toasts, so they
  // fire even though the <ol> itself is pointer-events:none; the contains() guard
  // keeps it paused while moving *within* the stack.
  const onEnter = () => setPaused(true);
  const onLeave = (e: React.PointerEvent | React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setPaused(false);
    }
  };

  const reportHeight = React.useCallback((id: number, h: number) => {
    setHeights((prev) => {
      if (prev.get(id) === h) return prev;
      const next = new Map(prev);
      next.set(id, h);
      return next;
    });
  }, []);
  const removeHeight = React.useCallback((id: number) => {
    setHeights((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const yPosition = position.startsWith("top") ? "top" : "bottom";
  const ordered = [...toasts].reverse(); // newest first → front of the stack
  // front toast's height; until it's measured fall back to the tallest known one
  // so the back toasts don't clamp to 0 for a frame when a new toast arrives
  const known = [...heights.values()];
  const frontHeight = ordered[0]
    ? (heights.get(ordered[0].id) ?? (known.length ? Math.max(...known) : 0))
    : 0;

  // cumulative offset: heights of the toasts in front of this one + index * GAP
  let sum = 0;
  const offsets = ordered.map((t, i) => {
    const o = sum + i * GAP;
    sum += heights.get(t.id) ?? 0;
    return o;
  });

  return (
    <ol
      data-slot="toaster"
      data-position={position}
      data-y-position={yPosition}
      data-stack=""
      style={
        {
          "--front-height": `${frontHeight}px`,
          "--gap": `${GAP}px`,
        } as React.CSSProperties
      }
      className={cn(
        "pointer-events-none fixed z-100 w-[calc(100%-2rem)] max-w-sm",
        positionClasses[position],
        className,
      )}
      {...props}
      onPointerOver={onEnter}
      onPointerOut={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
    >
      {ordered.map((t, i) => (
        <ToastItem
          key={t.id}
          toast={t}
          index={i}
          total={ordered.length}
          offset={offsets[i]!}
          paused={paused}
          reportHeight={reportHeight}
          removeHeight={removeHeight}
        />
      ))}
    </ol>
  );
}
