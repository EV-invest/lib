"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { EVENTS, experimentProps, type LeadField, type LeadStep } from "../core/analytics";
import type { LeadFlow } from "../core/pricing/flow";
import { centsBucket } from "../core/pricing/price";
import { useAnalyticsSink } from "./analytics-context";

/** The attribute a lead form's control names its role in, for `lead_form_field_error`. */
export const FIELD_ATTR = "data-lead-field";

export interface LeadEvents {
  step(step: LeadStep): void;
  /** A hint under a field (`blocking: false`); the browser's refusal is counted by itself (`blocking: true`). */
  fieldError(field: LeadField): void;
  /** The script's post got no answer: `network` or `timeout`, and which form. */
  submitError(reason: "network" | "timeout", channel: "form" | "callback"): void;
  /** An estimate's price for a full set of answers: its band only, once per need and band. */
  estimateShown(need: string, cents: number): void;
  /** The booking page opened, by a click; and Calendly saying the slot is booked. */
  bookingOpen(need: string, flow: LeadFlow): void;
  bookingDone(need: string, flow: LeadFlow): void;
}

/**
 * The lead form's own funnel, reported through the boundary's sink: seen
 * (half of it in view, once), started (the first focus inside, once), a
 * field the browser refused (`invalid`, by role — never the value), and the
 * step `qualify-first` moved to. Every event carries the form, the layout and
 * the site's experiment, so the arms of a test compare on one schema.
 */
export function useLeadEvents(root: RefObject<HTMLElement | null>, tags: { formId: string; layout: string; experiment?: { name: string; variant: string } | undefined }): LeadEvents {
  const sink = useAnalyticsSink();
  const { formId, layout } = tags;
  const name = tags.experiment?.name;
  const variant = tags.experiment?.variant;
  const props = useMemo(() => ({ form_id: formId, layout, ...experimentProps(name, variant) }), [formId, layout, name, variant]);
  const started = useRef(false);
  const shown = useRef(new Set<string>());

  useEffect(() => {
    const el = root.current;
    if (!sink || !el) return;
    let seen = false;
    const view = () => {
      if (seen) return;
      seen = true;
      sink.capture(EVENTS.formView, props);
    };
    // Without an observer (an old browser, a test DOM) rendering is seeing.
    const observer = typeof IntersectionObserver === "function" ? new IntersectionObserver(es => es.some(e => e.isIntersecting) && view(), { threshold: 0.5 }) : null;
    if (observer) observer.observe(el);
    else view();
    const focus = () => {
      if (started.current) return;
      started.current = true;
      sink.capture(EVENTS.formStart, props);
    };
    // `invalid` does not bubble: listened to on the way down.
    const invalid = (event: Event) => {
      const field = event.target instanceof Element ? event.target.getAttribute(FIELD_ATTR) : null;
      if (field) sink.capture(EVENTS.fieldError, { ...props, field, blocking: true });
    };
    el.addEventListener("focusin", focus);
    el.addEventListener("invalid", invalid, true);
    return () => {
      observer?.disconnect();
      el.removeEventListener("focusin", focus);
      el.removeEventListener("invalid", invalid, true);
    };
  }, [sink, root, props]);

  return useMemo(
    () => ({
      step: step => sink?.capture(EVENTS.formStep, { ...props, step }),
      fieldError: field => sink?.capture(EVENTS.fieldError, { ...props, field, blocking: false }),
      submitError: (reason, channel) => sink?.capture(EVENTS.submitError, { ...props, reason, channel }),
      estimateShown: (need, cents) => {
        const cents_bucket = centsBucket(cents);
        const key = `${need}\n${cents_bucket}`;
        if (shown.current.has(key)) return;
        shown.current.add(key);
        sink?.capture(EVENTS.estimateShown, { ...props, need, cents_bucket });
      },
      bookingOpen: (need, flow) => sink?.capture(EVENTS.bookingOpen, { ...props, need, flow }),
      bookingDone: (need, flow) => sink?.capture(EVENTS.bookingDone, { ...props, need, flow }),
    }),
    [sink, props],
  );
}
