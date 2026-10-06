"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LeadStep } from "../core/analytics";
import { estimateField } from "../core/pricing/flow";

/** One answer to the intro question. */
export interface LeadIntroOption {
  /** Posted under the intro's `field`: a slug. */
  value: string;
  label: string;
  /** Drawn on its tile, the brand's own. */
  icon?: ReactNode;
  /** `callback`: the rest of the form is the phone and its consent, posted as a callback. `form` (default): the form. */
  channel?: "form" | "callback" | undefined;
}

/**
 * A question asked before the need (`steps`) — how urgent, who is asking —
 * whose answer goes with the lead as one of the brand's extras: declare
 * `field` in `site.lead.extras`, or the server drops it.
 */
export interface LeadIntro {
  label: string;
  field: string;
  options: readonly LeadIntroOption[];
}

/** A screen of `layout="steps"`, named as `lead_form_step` reports it. */
export type StepId = Exclude<LeadStep, "contact">;

/**
 * The screens, in order: the intro question when there is one; then — unless
 * its answer asked for a call back, which needs the phone alone — the need,
 * the estimate's screens asked now (a question each, or a few sharing one,
 * named by the first), the postcode on its own screen (`localityStep="own"`),
 * and the phone, always last.
 */
export function stepsOf(o: { intro: boolean; callback: boolean; estimate: readonly (readonly string[])[]; localityOwn: boolean }): StepId[] {
  const out: StepId[] = o.intro ? ["intro"] : [];
  if (o.callback) return [...out, "phone"];
  out.push("need", ...o.estimate.flatMap(screen => (screen[0] === undefined ? [] : [estimateField(screen[0]) as StepId])));
  if (o.localityOwn) out.push("locality");
  out.push("phone");
  return out;
}

/** The screen a refused field is shown on: its own (an estimate's, the screen it shares), else the last. */
export function stepOfField(steps: readonly StepId[], field: string, estimate: readonly (readonly string[])[] = []): StepId | null {
  if (steps.length === 0) return null;
  const shared = estimate.find(screen => screen.some(id => estimateField(id) === field))?.[0];
  const own = field === "need" || field === "locality" ? field : shared !== undefined ? estimateField(shared) : null;
  const step = own !== null ? steps.find(s => s === own) : undefined;
  return step ?? steps[steps.length - 1] ?? null;
}

/**
 * Which screen is on: the one a refusal points at, else the one the visitor
 * went back to (`back`, `edit`), else the first not yet answered. An answer
 * calls `next`, and the first open screen comes back on. Each move is
 * reported once (`onStep`) — never the first screen, which `lead_form_view`
 * already counts.
 */
export function useLeadSteps(steps: readonly StepId[], answered: (id: StepId) => boolean, refused: StepId | null, onStep: (id: StepId) => void) {
  const [at, setAt] = useState<StepId | null>(null);
  const open = steps.find(s => !answered(s)) ?? steps[steps.length - 1] ?? "phone";
  const current = refused !== null && steps.includes(refused) ? refused : at !== null && steps.includes(at) ? at : open;
  const index = steps.indexOf(current);
  const shown = useRef(current);
  const report = useRef(onStep);
  report.current = onStep;
  useEffect(() => {
    if (shown.current === current) return;
    shown.current = current;
    report.current(current);
  }, [current]);
  return {
    current,
    index,
    back: () => setAt(steps[index - 1] ?? null),
    edit: (id: StepId) => setAt(id),
    next: () => setAt(null),
  };
}
