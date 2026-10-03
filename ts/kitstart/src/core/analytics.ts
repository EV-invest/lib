import { createBeaconSink, type AnalyticsSink } from "@evinvest/analytics";
import { THANKS } from "./routing";

/**
 * The event model. Analytics records; it never decides what renders.
 *
 * `contact_intent_click` is an intention, not a lead: a click on `tel:` is
 * visible, whether the call happened is not. It is named apart from
 * `lead_form_submit` so the two numbers can never be read as one.
 */
export const EVENTS = {
  pageView: "location_page_view",
  intent: "contact_intent_click",
  leadSubmit: "lead_form_submit",
  // The lead form's own funnel, one schema for every brand so an experiment's
  // results pool across sites: seen → touched → stuck on a field → step → sent.
  formView: "lead_form_view",
  formStart: "lead_form_start",
  fieldError: "lead_form_field_error",
  formStep: "lead_form_step",
  // The script's post that never got an answer (no network, no answer in time).
  submitError: "lead_form_submit_error",
  // The server's refusal (`reason`, the `field`): the visitor was sent back.
  formReject: "lead_form_reject",
} as const;

export type IntentChannel = "form_open" | "whatsapp" | "phone" | "sms" | "callback" | "booking";

/**
 * A form field as events name it — the role, never the brand's wire name, so
 * one field reads the same on every site. A brand's extra is its own name.
 */
export type LeadField = "need" | "locality" | "phone" | "name" | "consent" | (string & {});

/** `qualify-first`'s two screens; `single` has one and never reports a step. */
export type LeadStep = "need" | "contact";

/**
 * Every property name an event may carry. A customer's phone or address comes
 * through the same pages, and once it reaches PostHog the only remedy is
 * deleting the project's history — so the list is enforced by the sink (dev
 * throws, prod drops) rather than by review. `experiment` and `variant` are
 * the site's assignment, passed in; `field` is a field's role, never its value.
 */
export const ALLOWED_PROPS = [
  "brand_id",
  "location_id",
  "source",
  "device",
  "channel",
  "form_id",
  "experiment",
  "variant",
  "field",
  "step",
  "layout",
  "reason",
  // A field error that blocked the submit (`true`), or a hint (`false`).
  "blocking",
] as const;

/** What an experiment's assignment looks like on the wire: short slugs, nothing a person typed. */
export const EXPERIMENT_SLUG = /^[a-z0-9_-]{1,32}$/;

/** An experiment's assignment as event properties, or nothing when it is not a pair of slugs. */
export function experimentProps(experiment: string | null | undefined, variant: string | null | undefined): { experiment: string; variant: string } | Record<string, never> {
  return experiment && variant && EXPERIMENT_SLUG.test(experiment) && EXPERIMENT_SLUG.test(variant) ? { experiment, variant } : {};
}

/**
 * The thank-you page is the form's receipt, not a visit to the point: counting
 * it as `location_page_view` would add a page view to every lead.
 */
export function countsAsPageView(pathname: string): boolean {
  return !pathname.replace(/\/+$/, "").endsWith(THANKS);
}

/**
 * Where events go, and whose they are. `key: null` → every capture is a silent
 * no-op. `brandId` travels in the target, not in an import of the site config:
 * this module reaches the client island, and the config would ride with it.
 */
export interface AnalyticsTarget {
  key: string | null;
  host: string;
  brandId: string;
}

/**
 * Cookieless by construction: a beacon sink keeps its `distinct_id` in memory,
 * writes no cookie and no storage, and needs no consent banner. `sendBeacon`
 * because the events that matter most — a tap on `tel:` or `wa.me` — are
 * followed by the page handing the visitor to another app.
 */
export function analyticsSink(target: AnalyticsTarget, locationId: string | null): AnalyticsSink {
  return createBeaconSink({
    key: target.key ?? undefined,
    host: target.host,
    allowedProps: ALLOWED_PROPS,
    globalProps: locationId ? { brand_id: target.brandId, location_id: locationId } : { brand_id: target.brandId },
  });
}
