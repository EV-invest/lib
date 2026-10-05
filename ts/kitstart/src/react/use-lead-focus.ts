"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { focusNext, focusStep, nextEmpty, OFF_SELECTOR } from "./focus-next";

/** A screen on or off as `LeadSteps` draws it: the mark and the inline style. */
function setOff(step: HTMLElement, off: boolean): void {
  step.toggleAttribute("data-lead-off", off);
  step.style.display = off ? "none" : "";
}

/**
 * Where the focus goes once the visitor has answered: to the next screen in
 * `steps`, else — with `focusNext` — to the next empty field.
 *
 * `moveOn(change, from, stable)` applies the answer. When it changes no
 * screen (`stable`) and what comes next is a typed field, that field is
 * revealed and focused inside the tap: iOS opens the keyboard only for a
 * focus a gesture made. Otherwise the focus moves once React has drawn the
 * change. `focusAfterSelect()`: the same after the kit's select, whose list
 * hands the focus back to its trigger as it closes — so it waits for that.
 */
export function useLeadFocus(form: () => HTMLFormElement | null, o: { steps: boolean; focusNext: boolean; current: string }) {
  const { steps, current } = o;
  const pending = useRef<{ from: Element | null } | null>(null);
  const revealed = useRef<HTMLElement | null>(null);
  const afterSelect = useRef(false);

  useLayoutEffect(() => {
    const el = steps ? form() : null;
    // A screen revealed ahead of React is React's again: only the current one shows.
    for (const step of el?.querySelectorAll<HTMLElement>("[data-lead-step]") ?? []) setOff(step, step.dataset["leadStep"] !== current);
    // Revealed ahead, but not the screen React put on (a postcode typed and never confirmed): that screen's field instead.
    const lost = revealed.current?.closest(OFF_SELECTOR) != null;
    revealed.current = null;
    const move = pending.current ?? (lost ? { from: null } : null);
    if (!move) return;
    pending.current = null;
    if (steps) focusStep(el?.querySelector("[data-lead-step]:not([data-lead-off])"));
    else focusNext(form(), move.from);
  });
  // Passive, so after the select's own effect has given its trigger the focus back.
  useEffect(() => {
    if (!afterSelect.current) return;
    afterSelect.current = false;
    focusNext(form(), null);
  });

  return {
    moveOn(change: () => void, from: Element | null, stable: boolean): void {
      if (!steps && !o.focusNext) return change();
      change();
      const el = form();
      const next = stable && el ? nextEmpty(el, from, steps) : null;
      if (next && next.type !== "radio") {
        const step = next.closest<HTMLElement>("[data-lead-step]");
        if (step) setOff(step, false);
        next.focus();
        revealed.current = next;
      } else pending.current = { from };
    },
    focusAfterSelect(): void {
      afterSelect.current = o.focusNext;
    },
  };
}
