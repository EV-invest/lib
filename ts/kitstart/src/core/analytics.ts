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
} as const;

export type IntentChannel = "form_open" | "whatsapp" | "phone" | "booking";

/**
 * Every property name an event may carry. A customer's phone or address comes
 * through the same pages, and once it reaches PostHog the only remedy is
 * deleting the project's history — so the list is enforced by the sink (dev
 * throws, prod drops) rather than by review.
 */
export const ALLOWED_PROPS = ["brand_id", "location_id", "source", "device", "channel", "form_id"] as const;

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
