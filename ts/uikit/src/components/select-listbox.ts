"use client";

import * as React from "react";
import { focusCandidates } from "../primitives/focus-scope";

// Keyboard and focus for `SelectContent`, kept out of the component itself.
// The options are read from the DOM, never counted from `children`: a
// `SelectGroup`, a `SelectLabel` or an item behind a component of the
// caller's is invisible to `Children`, and an index counted there points at
// the wrong row.

const TYPEAHEAD_MS = 500;

export function listOptions(list: HTMLElement | null): HTMLElement[] {
  return Array.from(list?.querySelectorAll<HTMLElement>("[role='option']:not([data-disabled])") ?? []);
}

/**
 * Opening lands on the chosen option (else the first), as a native select
 * does. Focus without scrolling — the page must not jump on the frame the
 * list is placed — then the list alone brings that option into view.
 */
export function landOnChosen(list: HTMLElement | null): void {
  const options = listOptions(list);
  const target = options.find((o) => o.getAttribute("aria-selected") === "true") ?? options[0];
  if (!target) return;
  target.focus({ preventScroll: true });
  target.scrollIntoView?.({ block: "nearest" });
}

/** Arrows, Home, End and type-ahead over the options; `true` when the key was one of them. */
export function useListboxKeys(listRef: React.RefObject<HTMLElement | null>) {
  const typed = React.useRef({ text: "", at: 0 });
  return React.useCallback(
    (event: React.KeyboardEvent): boolean => {
      const options = listOptions(listRef.current);
      if (options.length === 0) return false;
      const current = options.indexOf(document.activeElement as HTMLElement);
      const move = (index: number) => {
        event.preventDefault();
        // A plain focus: the browser scrolls the list to follow the arrows.
        options[(index + options.length) % options.length]?.focus();
        return true;
      };
      switch (event.key) {
        case "ArrowDown":
          return move(current + 1);
        case "ArrowUp":
          return move(current < 0 ? -1 : current - 1);
        case "Home":
          return move(0);
        case "End":
          return move(options.length - 1);
      }
      // Space chooses (the option's own handler), as Enter does: it is not type-ahead.
      if (event.key.length !== 1 || event.key === " " || event.ctrlKey || event.metaKey || event.altKey) return false;
      const now = Date.now();
      const t = typed.current;
      t.text = now - t.at > TYPEAHEAD_MS ? event.key.toLowerCase() : t.text + event.key.toLowerCase();
      t.at = now;
      // One letter repeated cycles through the options that start with it.
      const repeated = t.text.split("").every((c) => c === t.text[0]);
      const query = repeated ? t.text[0]! : t.text;
      const from = repeated ? current + 1 : Math.max(current, 0);
      for (let i = 0; i < options.length; i++) {
        const index = (from + i) % options.length;
        if ((options[index]!.textContent ?? "").trim().toLowerCase().startsWith(query)) return move(index);
      }
      event.preventDefault();
      return true;
    },
    [listRef],
  );
}

/**
 * Tab from the open list goes on from the trigger. The list is portaled to the
 * end of the document, so the browser's own Tab would leave from there: focus
 * goes back to the trigger first and the browser's Tab carries on from it.
 * Inside a modal (a Dialog, a Drawer) that is not enough — the trap listens on
 * the modal, never sees a key from the portal, and would let a Tab from its
 * last field out — so there the next field is found here, wrapping as the
 * trap would.
 */
export function tabFromTrigger(event: React.KeyboardEvent, trigger: HTMLElement | null): void {
  if (!trigger) return;
  const modal = trigger.closest<HTMLElement>("[aria-modal='true']");
  if (!modal) {
    trigger.focus();
    return;
  }
  event.preventDefault();
  const stops = focusCandidates(modal).filter((el) => el === trigger || el.offsetWidth > 0 || el.offsetHeight > 0);
  const at = stops.indexOf(trigger);
  const next = stops[(at + (event.shiftKey ? -1 : 1) + stops.length) % stops.length];
  (at < 0 || !next ? trigger : next).focus();
}
