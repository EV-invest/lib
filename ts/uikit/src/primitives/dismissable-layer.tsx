"use client";

import * as React from "react";

type LayerRef = React.RefObject<HTMLDivElement | null>;

// The open layers, oldest first. An overlay opened inside another (a Select in
// a Dialog, a Popover in a Drawer) is portaled out of its parent's subtree, so
// "outside the parent" would include it: the stack is what tells a nested
// layer from the rest of the page.
const stack: LayerRef[] = [];

function isInsideHigherLayer(own: LayerRef, target: Node): boolean {
  const index = stack.indexOf(own);
  // Not on the stack (a listener outliving its cleanup): nothing is above it.
  if (index < 0) return false;
  return stack.slice(index + 1).some((layer) => layer.current?.contains(target) ?? false);
}

/** Why a layer is being dismissed: the event itself, for a caller that treats keys and pointers apart. */
export type DismissEvent = PointerEvent | KeyboardEvent;

/**
 * Calls `onDismiss` on Escape or on a pointer-down outside the layer — the
 * dep-light core of every overlay's "click away to close". Pass refs to any
 * nodes that should NOT count as outside (e.g. the trigger), via `exclude`.
 *
 * Layers stack, in the order they opened: Escape dismisses only the topmost
 * layer on this stack, and a pointer-down inside a layer opened above this one
 * is not outside it — so a Select's list inside a Dialog closes the list, not
 * the Dialog. The stack knows only the overlays built on this hook: a
 * `Drawer` or `CommandDialog` (Escape in their own React `onKeyDown`) is not
 * on it, and a menu that also closes on Escape in its React `onKeyDown` lets
 * the key bubble through React's tree to what holds it. Moving those onto the
 * stack is a follow-up.
 *
 * Mirrors the dismiss behaviour Rust expresses with a full-screen backdrop.
 */
export function useDismissableLayer(opts: {
  enabled: boolean;
  onDismiss: (event: DismissEvent) => void;
  exclude?: Array<React.RefObject<Element | null>>;
}): React.RefObject<HTMLDivElement | null> {
  const { enabled, onDismiss, exclude } = opts;
  const ref = React.useRef<HTMLDivElement | null>(null);
  const onDismissRef = React.useRef(onDismiss);
  // Callers pass `exclude` inline, a new array each render: read through a ref,
  // or the effect would re-run and move this layer to the top of the stack.
  const excludeRef = React.useRef(exclude);
  React.useEffect(() => {
    onDismissRef.current = onDismiss;
    excludeRef.current = exclude;
  });

  React.useEffect(() => {
    if (!enabled) return;
    stack.push(ref);

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (ref.current && ref.current.contains(target)) return;
      for (const r of excludeRef.current ?? []) {
        if (r.current && r.current.contains(target)) return;
      }
      if (isInsideHigherLayer(ref, target)) return;
      onDismissRef.current(event);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && stack[stack.length - 1] === ref) onDismissRef.current(event);
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      const index = stack.indexOf(ref);
      if (index >= 0) stack.splice(index, 1);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled]);

  return ref;
}
