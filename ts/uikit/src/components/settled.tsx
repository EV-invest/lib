"use client";

import * as React from "react";

export interface SettledProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** True while the data this surface needs is in flight. */
  loading: boolean;
  /** What stands in meanwhile — a `Skeleton` or a group of them. */
  skeleton: React.ReactNode;
  /** The content; also the empty and error states, guarded on the same condition. */
  children: React.ReactNode;
}

/**
 * The skeleton → content handover. Swapped in a single frame, a skeleton reads
 * as a flicker — the eye sees that something changed, not what. Here the
 * content fades and rises the last `--ev-rise` into place
 * (`data-state="revealed"`, motion.css).
 *
 * Deliberately not a cross-fade: the two would have to overlap, which means
 * taking one out of flow and animating a height, and the surface would jump
 * when the content is a different size. And no entrance when no skeleton was
 * shown — data already present on the first render cuts straight in; fading it
 * would invent a delay the data never had.
 *
 * `data-state`: `loading` → `revealed` after a skeleton, `ready` without one.
 */
export function Settled({ loading, skeleton, children, ...props }: SettledProps) {
  // Adjusted during render, not in an effect, so the entrance plays on the very
  // first render after `loading` drops: an effect would paint the content opaque
  // once and only then start the fade. `reveals` keys the wrapper, so a later
  // refetch that shows the skeleton again gets a handover of its own.
  const [wasLoading, setWasLoading] = React.useState(loading);
  const [reveals, setReveals] = React.useState(0);
  if (wasLoading !== loading) {
    setWasLoading(loading);
    if (wasLoading) setReveals((n) => n + 1);
  }
  if (loading) {
    return (
      <div data-slot="settled" data-state="loading" aria-busy="true" {...props}>
        {skeleton}
      </div>
    );
  }
  return (
    <div key={reveals} data-slot="settled" data-state={reveals > 0 ? "revealed" : "ready"} {...props}>
      {children}
    </div>
  );
}
