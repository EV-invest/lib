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
  // An estimate's price, shown for a full set of answers: the need and the
  // price's band (`centsBucket`), never the price — once per band and need.
  estimateShown: "lead_estimate_shown",
  // After a priced lead: the visitor opened the place's booking (`provider`),
  // and — only where the provider says so on the page (Cal.com's embed) — booked.
  bookingOpen: "lead_booking_open",
  bookingDone: "lead_booking_done",
} as const;

export type IntentChannel = "form_open" | "whatsapp" | "phone" | "sms" | "callback" | "booking";

/**
 * A form field as events name it — the role, never the brand's wire name, so
 * one field reads the same on every site. A brand's extra is its own name.
 */
export type LeadField = "need" | "locality" | "phone" | "name" | "consent" | (string & {});

/**
 * A screen of the lead form, as `lead_form_step` names it. `qualify-first`'s
 * two are `need` and `contact`; `steps` reports each screen it moves to —
 * `intro`, `need`, `estimate_<input id>`, `locality`, `phone`. `single` has one
 * screen and never reports a step. Slugs only: an input id, never an answer.
 */
export type LeadStep = "need" | "contact" | "intro" | "locality" | "phone" | `estimate_${string}`;

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
  // The brand's subject slug.
  "need",
  // A price's band, `"5000-7500"` (`centsBucket`) — never the price.
  "cents_bucket",
  // The booking's provider, `manual` | `link` | `cal_com` — never its URL.
  "provider",
] as const;

/**
 * The beacon's `distinct_id` as a lead may carry it to the panel
 * (`lead.created`'s `analytics_id`), so PostHog can join the lead to the
 * visit. The panel's own rule; anything else is dropped, never refused.
 */
export const ANALYTICS_ID = /^[A-Za-z0-9._:-]{1,128}$/;

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
 * followed by the page handing the visitor to another app. `distinctId`:
 * the visitor's id, held by the caller so a lead can name it; a random one
 * per sink without it.
 */
export function analyticsSink(target: AnalyticsTarget, locationId: string | null, distinctId?: string): AnalyticsSink {
  return createBeaconSink({
    key: target.key ?? undefined,
    ...(distinctId !== undefined ? { distinctId } : {}),
    host: target.host,
    allowedProps: ALLOWED_PROPS,
    globalProps: locationId ? { brand_id: target.brandId, location_id: locationId } : { brand_id: target.brandId },
  });
}
