"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** The attribute a trigger elsewhere on the page names the need it is about in. */
export const NEED_ATTR = "data-need";

const MINUTE = 60_000;
const subscribeMinute = (tick: () => void) => {
  const timer = setInterval(tick, MINUTE);
  return () => clearInterval(timer);
};
// The minute, not the millisecond: the snapshot must be stable between reads.
const minuteNow = () => Math.floor(Date.now() / MINUTE) * MINUTE;

/**
 * "Now" for the opening hours: the render's stamp on the server and while
 * hydrating — so the two agree — then the visitor's clock, a minute at a time.
 * A page cached for ten minutes is put right once it runs.
 */
export function useNow(renderedAt: number): number {
  return useSyncExternalStore(subscribeMinute, minuteNow, () => renderedAt);
}

/**
 * `value`, held at what it was when `hold` turned on, until it turns off. The
 * channel order runs on the clock, and a channel that moves is a form React
 * draws anew: what was typed is gone, and the retry of a post still waiting
 * on the server would go to a form no longer on the page.
 */
export function useHeld<T>(value: T, hold: boolean): T {
  const [held, setHeld] = useState<{ value: T } | null>(null);
  // Adjusted during render, React's own pattern for state derived from a prop.
  if (hold && held === null) setHeld({ value });
  if (!hold && held !== null) setHeld(null);
  return held ? held.value : value;
}

const subscribeNothing = () => () => {};
/** `false` on the server and while hydrating, `true` from the render after. */
export const useHydrated = (): boolean => useSyncExternalStore(subscribeNothing, () => true, () => false);

/**
 * The need, chosen for the visitor when the page knows it: the prop, then
 * `?need=` once the script runs (a cached page cannot read the query), then a
 * tap on any `[data-need]` trigger — the card the visitor came from. Only one
 * of `needs` is taken; anything else is ignored.
 */
export function useNeed(
  initial: string | undefined,
  needs: readonly string[],
  /** Told when the page, not the visitor's own pick, set the need. */
  onPreset: () => void,
): [string | undefined, (need: string) => void] {
  const [need, setNeed] = useState(initial !== undefined && needs.includes(initial) ? initial : undefined);
  const key = needs.join("\n");
  const preset = useRef(onPreset);
  preset.current = onPreset;

  useEffect(() => {
    const list = key.split("\n");
    const take = (value: string | null | undefined) => {
      if (!value || !list.includes(value)) return;
      setNeed(value);
      preset.current();
    };
    take(new URLSearchParams(window.location.search).get("need"));
    const onClick = (event: MouseEvent) => {
      const trigger = event.target instanceof Element ? event.target.closest(`[${NEED_ATTR}]`) : null;
      take(trigger?.getAttribute(NEED_ATTR));
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [key]);

  return [need, setNeed];
}

/**
 * Opens the `<details>` the page's fragment names — the call bar links to the
 * callback by id, and not every browser opens a closed one it scrolls to.
 */
export function useOpenOnHash(id: string): void {
  useEffect(() => {
    const open = () => {
      if (window.location.hash !== `#${id}`) return;
      const el = document.getElementById(id);
      if (el instanceof HTMLDetailsElement) el.open = true;
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [id]);
}
