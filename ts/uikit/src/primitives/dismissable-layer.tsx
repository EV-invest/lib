import * as React from "react";

/**
 * Calls `onDismiss` on Escape or on a pointer-down outside the layer — the
 * dep-light core of every overlay's "click away to close". Pass refs to any
 * nodes that should NOT count as outside (e.g. the trigger), via `exclude`.
 *
 * Mirrors the dismiss behaviour Rust expresses with a full-screen backdrop.
 */
export function useDismissableLayer(opts: {
  enabled: boolean;
  onDismiss: () => void;
  exclude?: Array<React.RefObject<Element | null>>;
}): React.RefObject<HTMLDivElement | null> {
  const { enabled, onDismiss, exclude } = opts;
  const ref = React.useRef<HTMLDivElement | null>(null);
  const onDismissRef = React.useRef(onDismiss);
  React.useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  React.useEffect(() => {
    if (!enabled) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (ref.current && target && ref.current.contains(target)) return;
      for (const r of exclude ?? []) {
        if (r.current && target && r.current.contains(target)) return;
      }
      onDismissRef.current();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismissRef.current();
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled, exclude]);

  return ref;
}
