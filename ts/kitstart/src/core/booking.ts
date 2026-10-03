import { calendlyUrl } from "./place/types";

/** Calendly's own origin: the only one a booking message is taken from. */
export const CALENDLY_ORIGIN = "https://calendly.com";

/** What a lead's booking page is opened with: who, and the lead it joins. */
export interface BookingPrefill {
  /** The visitor's name, when the form asked for one. */
  name: string | null;
  /** As typed; Calendly gets it as the answer to the event's first question (`a1`). */
  phone: string | null;
  /** The lead's public reference (`leadRef`): Calendly hands it back to the panel as `utm_content`. */
  leadRef: string | null;
  /** The page's host, which Calendly wants before it posts its events to the frame's parent. */
  embedDomain: string;
}

/**
 * The scheduling page framed for one lead: Calendly's embed parameters (it
 * posts `calendly.*` messages to the parent only when framed with them), the
 * visitor's name and phone so nothing is typed twice, and `utm_content` — the
 * lead's reference, which the panel's Calendly webhook matches the booking
 * to. `null` for a URL that is not a Calendly scheduling page.
 */
export function bookingFrameUrl(url: string, prefill: BookingPrefill): string | null {
  const page = calendlyUrl(url);
  if (!page) return null;
  const out = new URL(page);
  out.searchParams.set("embed_domain", prefill.embedDomain);
  out.searchParams.set("embed_type", "Inline");
  if (prefill.name) out.searchParams.set("name", prefill.name);
  if (prefill.phone) out.searchParams.set("a1", prefill.phone);
  if (prefill.leadRef) out.searchParams.set("utm_content", prefill.leadRef);
  return out.href;
}

/** Whether a `message` event is Calendly saying the visitor booked: from its origin, and that event only. */
export function isBookingScheduled(event: { origin: string; data: unknown }): boolean {
  if (event.origin !== CALENDLY_ORIGIN) return false;
  const data = event.data;
  return typeof data === "object" && data !== null && Reflect.get(data, "event") === "calendly.event_scheduled";
}
