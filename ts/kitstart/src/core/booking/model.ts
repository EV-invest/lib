/**
 * Booking, provider-agnostic: how a place's slot is set once a priced lead is
 * stored. The vocabulary is the panel's (snake_case, closed sets) and the
 * fixtures in `test/fixtures/booking/` are the contract it mirrors: a new
 * provider extends the closed set with its own URL rule, and nothing else on
 * either side changes.
 */

/**
 * - `manual`: no external page — the site promises a call to set the slot, and
 *   the operator records it in the panel. Always available; carries no URL.
 * - `link`: any external booking page (strict https), opened with
 *   `ref=<leadRef>` in its query.
 * - `google_calendar`: a Google appointment schedule, opened as is — it takes
 *   no parameter, so the panel matches its bookings by contact and time.
 * - `cal_com`: a Cal.com event, opened with the name, the phone and
 *   `metadata[ref]=<leadRef>` prefilled.
 */
export const BOOKING_PROVIDERS = ["manual", "link", "google_calendar", "cal_com"] as const;
export type BookingProvider = (typeof BOOKING_PROVIDERS)[number];
/** The providers with a page to open — every one but `manual`. */
export type PageProvider = Exclude<BookingProvider, "manual">;

/**
 * A place's booking, as `PlaceLive.booking` serves it and the panel's place
 * settings edit it: the providers it has a page on, and the one it offers by
 * default — `manual` or one of them. An experiment (`booking_provider`) may
 * pick another of the place's providers (`bookingOf`).
 */
export interface BookingConfig {
  default: BookingProvider;
  providers: Readonly<Partial<Record<PageProvider, { url: string }>>>;
}

/** The booking one page offers: the provider chosen for this visitor, and its page. */
export type BookingChoice = { provider: "manual" } | { provider: PageProvider; url: string };

/**
 * A choice a brand's own adapter makes sense of — what `LeadBooking` takes.
 * Every `BookingChoice` is one; the closed set is what the place settings
 * and `booking.requested@1` accept.
 */
export interface OpenBookingConfig {
  provider: string;
  url?: string;
}

/** A place with no booking of its own — baked or live — promises a call. */
export const DEFAULT_BOOKING: BookingConfig = { default: "manual", providers: {} };

/** The experiment whose variant names the provider a visitor is offered, the same key on every brand. */
export const BOOKING_EXPERIMENT = "booking_provider";

/** A lead's booking, as the panel's projection tracks it; the site only ever says `requested`. */
export const BOOKING_STATUSES = ["none", "requested", "booked", "canceled", "done", "no_show"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** The part of the day a visitor may prefer for a `manual` slot. */
export const PREFERRED_PARTS = ["morning", "afternoon", "evening"] as const;
export type PreferredPart = (typeof PREFERRED_PARTS)[number];

/**
 * The site's `booking.requested@1`: a lead asked for a slot. A provider with
 * a page sends it when the page is opened; `manual` when the visitor sends
 * the (optional) preference — which only `manual` carries.
 */
export interface BookingRequest {
  /** The lead's public reference (`leadRef`) — the panel's lead id. */
  leadRef: string;
  provider: BookingProvider;
  /** `YYYY-MM-DD`; `manual` only. */
  preferredDate?: string;
  /** `manual` only. */
  preferredPart?: PreferredPart;
}

/** `booking.requested@1`'s properties as the panel reads them. */
export interface BookingRequestedProperties {
  lead_ref: string;
  provider: BookingProvider;
  preferred_date?: string;
  preferred_part?: PreferredPart;
}

/** The Cal.com hosts a `cal_com` URL may point at unless the site names its own: ours, and the hosted cloud. */
export const DEFAULT_CAL_COM_HOSTS: readonly string[] = ["cal.evinvest.ltd", "cal.com"];

/** What a validator is told besides the value: the site's (or brand's) Cal.com hosts. */
export interface BookingRules {
  /** Exact hostnames, lowercase; a subdomain is another host. Default `DEFAULT_CAL_COM_HOSTS`. */
  calComHosts?: readonly string[];
}

export const BOOKING_LIMITS = {
  maxUrl: 2048,
  /** A Cal.com username or event slug: one path segment, no dot segment. */
  calComSegment: /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/,
} as const;

/** `lead-<row>-<8 hex>`, as `leadRef` mints it. */
const LEAD_REF = /^lead-[1-9]\d{0,14}-[0-9a-f]{8}$/;

export function isLeadRef(value: unknown): value is string {
  return typeof value === "string" && LEAD_REF.test(value);
}

export function isBookingProvider(value: unknown): value is BookingProvider {
  return BOOKING_PROVIDERS.some(p => p === value);
}

export function isPageProvider(value: unknown): value is PageProvider {
  return value !== "manual" && isBookingProvider(value);
}

export function isPreferredPart(value: unknown): value is PreferredPart {
  return PREFERRED_PARTS.some(p => p === value);
}

/**
 * The one entry point for which booking a visitor is offered: the provider
 * the experiment's variant (`booking_provider`) names, when the place has it
 * (`manual` it always has), else the place's default. The chosen provider is
 * what `booking.requested@1` and `lead_booking_open/done` report, so the arms
 * compare.
 */
export function bookingOf(place: { booking?: BookingConfig | undefined }, variant?: string | null): BookingChoice {
  const booking = place.booking ?? DEFAULT_BOOKING;
  const pick = (provider: unknown): BookingChoice | null => {
    if (provider === "manual") return { provider };
    if (!isPageProvider(provider)) return null;
    const page = booking.providers[provider];
    return page ? { provider, url: page.url } : null;
  };
  return pick(variant) ?? pick(booking.default) ?? { provider: "manual" };
}
