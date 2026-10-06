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

// Which layer an Escape belongs to, fixed when the key starts its trip. By the
// time the document hears it, a React `onKeyDown` on the way (a Select's, a
// consumer's) may already have closed the top layer and — a discrete update
// commits synchronously — popped it, so the layer below would find itself on
// top and close on the same key. Recorded in the window's capture phase, which
// runs before any DOM listener, React's root included.
const escapeOwner = new WeakMap<Event, LayerRef>();

function recordEscapeOwner(event: KeyboardEvent) {
  const top = stack[stack.length - 1];
  if (event.key === "Escape" && top && !escapeOwner.has(event)) escapeOwner.set(event, top);
}

function ownsEscape(own: LayerRef, event: KeyboardEvent): boolean {
  // An event dispatched where the window never sees it falls back to the live top.
  return (escapeOwner.get(event) ?? stack[stack.length - 1]) === own;
}

function push(layer: LayerRef) {
  if (stack.length === 0) window.addEventListener("keydown", recordEscapeOwner, true);
  stack.push(layer);
}

function pop(layer: LayerRef) {
  const index = stack.indexOf(layer);
  if (index >= 0) stack.splice(index, 1);
  if (stack.length === 0) window.removeEventListener("keydown", recordEscapeOwner, true);
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
 * the Dialog. The Escape goes to the layer that was on top when the key was
 * pressed, even if a handler on its way closed that layer first.
 *
 * `pointerOutside: false` keeps the layer on the stack (it takes Escape, and
 * the layers below see a pointer-down inside it as inside) but leaves outside
 * clicks to the caller — for an overlay whose own scrim is what "outside"
 * means (Drawer, CommandDialog).
 *
 * Mirrors the dismiss behaviour Rust expresses with a full-screen backdrop.
 */
export function useDismissableLayer(opts: {
  enabled: boolean;
  onDismiss: (event: DismissEvent) => void;
  exclude?: Array<React.RefObject<Element | null>>;
  /** Dismiss on a pointer-down outside the layer. Default `true`. */
  pointerOutside?: boolean;
}): React.RefObject<HTMLDivElement | null> {
  const { enabled, onDismiss, exclude, pointerOutside = true } = opts;
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
    push(ref);

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
      if (event.key === "Escape" && ownsEscape(ref, event)) onDismissRef.current(event);
    }

    if (pointerOutside) document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      pop(ref);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled, pointerOutside]);

  return ref;
}
