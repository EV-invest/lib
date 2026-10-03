/**
 * Booking, provider-agnostic: how a place's slot is set once a priced lead is
 * stored. The vocabulary is the panel's (snake_case, closed sets) and the
 * fixtures in `test/fixtures/booking/` are the contract it mirrors: a new
 * provider (`calendly`, next) extends the closed set with its own URL rule,
 * and nothing else on either side changes.
 */

/**
 * - `manual`: no external page — the site promises a call to set the slot, and
 *   the operator records it in the panel;
 * - `link`: any external booking page (strict https), opened on a click with
 *   `ref=<leadRef>` in its query;
 * - `cal_com`: a Cal.com event page on an allowed host, opened on a click with
 *   the name, the phone and `metadata[ref]=<leadRef>` prefilled.
 */
export const BOOKING_PROVIDERS = ["manual", "link", "cal_com"] as const;
export type BookingProvider = (typeof BOOKING_PROVIDERS)[number];

/** A place's booking, as `PlaceLive.booking` serves it and the panel's place settings edit it. */
export type BookingConfig = { provider: "manual" } | { provider: "link"; url: string } | { provider: "cal_com"; url: string };

/**
 * A booking the brand resolves itself rather than reads from the place — an
 * experiment's arm, say, on a provider only the brand's own adapter knows
 * yet. Every built-in config is one; the closed set above is what the place
 * settings and `booking.requested@1` accept.
 */
export interface OpenBookingConfig {
  provider: string;
  url?: string;
}

/** A place with no booking of its own — baked or live — promises a call. */
export const DEFAULT_BOOKING: BookingConfig = { provider: "manual" };

/** A lead's booking, as the panel's projection tracks it; the site only ever says `requested`. */
export const BOOKING_STATUSES = ["none", "requested", "booked", "canceled", "done", "no_show"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** The part of the day a visitor may prefer for a `manual` slot. */
export const PREFERRED_PARTS = ["morning", "afternoon", "evening"] as const;
export type PreferredPart = (typeof PREFERRED_PARTS)[number];

/**
 * The site's `booking.requested@1`: a lead asked for a slot. `link` and
 * `cal_com` send it when the page is opened; `manual` when the visitor sends
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

/**
 * Cal.com hosts a `cal_com` URL may point at when the site names none
 * (`SiteConfig.booking.calComHosts`): the hosted cloud. A brand on its own
 * Cal.com lists its domain too — the list replaces this one.
 */
export const DEFAULT_CAL_COM_HOSTS: readonly string[] = ["cal.com"];

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

export function isPreferredPart(value: unknown): value is PreferredPart {
  return PREFERRED_PARTS.some(p => p === value);
}

/** The place's booking, or the default promise of a call. */
export function bookingOf(place: { booking?: BookingConfig | undefined }): BookingConfig {
  return place.booking ?? DEFAULT_BOOKING;
}

/**
 * The one entry point for choosing a booking by an experiment's variant:
 * the arm's config when the variant names one, else the place's own. Called
 * where the page renders (a server component), and the result handed to
 * `LeadCapture`'s `bookingConfig` — a function cannot cross into the island.
 *
 * ```ts
 * bookingForVariant(view.place, variant, { google: { provider: "link", url }, calendly: { provider: "calendly", url } })
 * ```
 */
export function bookingForVariant(
  place: { booking?: BookingConfig | undefined },
  variant: string | null | undefined,
  arms: Readonly<Record<string, OpenBookingConfig>>,
): OpenBookingConfig {
  return (variant != null && Object.hasOwn(arms, variant) ? arms[variant] : undefined) ?? bookingOf(place);
}
