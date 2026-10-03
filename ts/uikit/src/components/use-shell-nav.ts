"use client";

import * as React from "react";

/**
 * The optimistic half of a nav: the id of the item just clicked, until the
 * pathname catches up.
 *
 * A router that waits for the next page's payload changes the pathname 150–300ms
 * after the click — exactly the window in which a highlight that has not moved
 * reads as a click that did not land. So the clicked item is marked at once.
 *
 * The entry remembers the pathname it was made on, so the moment the pathname
 * changes it is stale by construction and the URL is the truth again. It is
 * cleared during render, not in an effect (an effect would paint one frame with
 * the URL's row marked and the stale one not), and cleared rather than ignored:
 * left behind, it would come back to life on a return to the page it was made
 * on. A click that never navigates is forgotten by the next one.
 */
export function usePendingNavigation(
  pathname: string,
): readonly [pendingId: string | null, markPending: (id: string) => void] {
  const [pending, setPending] = React.useState<{ id: string; from: string } | null>(null);
  if (pending && pending.from !== pathname) setPending(null);
  const pendingId = pending && pending.from === pathname ? pending.id : null;
  const markPending = React.useCallback(
    (id: string) => setPending({ id, from: pathname }),
    [pathname],
  );
  return [pendingId, markPending] as const;
}

/**
 * Places the section's `[data-slot="shell-nav-marker"]` over its
 * `[aria-current="page"]` row, by measurement: rows differ in count and every
 * label is somebody's translation, and SSR cannot know those offsets (until the
 * first placement the row carries the fill itself — see motion.css). Re-runs
 * when `at` changes and whenever the section resizes — rows come and go, labels
 * change width with the locale or a font swap.
 */
export function useSlideMarker(
  ref: React.RefObject<HTMLElement | null>,
  at: string | null,
): void {
  // Which marker node was last placed, so a re-run over the same node — a move,
  // a resize — is told apart from a marker that has just mounted. `undefined`
  // until the first run, so only a marker mounting AFTER the section settled
  // counts as entering (and fades); one hydration finds on its row cuts in.
  const placed = React.useRef<HTMLElement | null | undefined>(undefined);
  React.useLayoutEffect(() => {
    const section = ref.current;
    if (!section) return;
    const place = () => {
      const marker = section.querySelector<HTMLElement>('[data-slot="shell-nav-marker"]');
      const row = section.querySelector<HTMLElement>('[aria-current="page"]');
      const fresh = marker !== placed.current;
      const entering = fresh && placed.current !== undefined;
      placed.current = marker;
      if (!marker || !row) return;
      if (fresh) marker.style.transition = "none";
      marker.style.transform = `translate(${row.offsetLeft}px, ${row.offsetTop}px)`;
      marker.style.width = `${row.offsetWidth}px`;
      marker.style.height = `${row.offsetHeight}px`;
      if (fresh) {
        // A transition is decided by the style AFTER the change: flushing the
        // placement first makes it the starting point, so a new marker appears on
        // its row instead of sliding in from the section's origin.
        void marker.offsetWidth;
        marker.style.transition = "";
        marker.dataset["placed"] = entering ? "entered" : "first";
      }
    };
    place();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(place);
    observer.observe(section);
    return () => observer.disconnect();
  }, [ref, at]);
}
