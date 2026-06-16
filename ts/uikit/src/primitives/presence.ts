import * as React from "react";

/**
 * Tracks whether an overlay should be mounted. Mount/unmount steps in lockstep
 * with `present`: enter animations (`data-[state=open]:animate-in`) still play
 * on mount, but the kit intentionally does **not** defer unmount for an exit
 * animation — deferring made portaled overlays flicker on close. Pass `ref`
 * through to the animated node (kept for API stability / future use).
 */
export function usePresence(present: boolean): {
  isPresent: boolean;
  ref: React.RefObject<HTMLElement | null>;
} {
  const ref = React.useRef<HTMLElement | null>(null);
  return { isPresent: present, ref };
}
