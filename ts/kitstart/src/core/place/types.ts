import type { BookingConfig } from "../booking/model";
/**
 * The place model. Three words, one each:
 *
 * - **Place** — the aggregate: one point of the business, baked config merged
 *   with the live source;
 * - **Presence** — how the place exists for a visitor: a storefront with an
 *   address, or a service area with none;
 * - **ServiceArea** — where the van goes.
 *
 * A service-area business has no address *in the type*, so no builder can
 * render one for it by accident — schema.org, the map and the footer all have
 * to ask `presence.kind` first.
 */

export type DayOfWeek = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

export interface PostalAddress {
  street: string;
  postalCode: string;
  locality: string;
  /** Région administrative, as schema.org `addressRegion`. */
  region: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
}

export interface Geo {
  lat: number;
  lng: number;
}

export interface OpeningHours {
  days: readonly DayOfWeek[];
  /** `HH:MM`, local time. */
  opens: string;
  closes: string;
}

/**
 * Google's rating for the place, mirrored from the Business Profile API. Never
 * baked: it exists only when the live source supplied it, and the API's terms
 * cap how long a copy may be shown, so `fetchedAt` travels with it.
 */
export interface Rating {
  value: number;
  count: number;
  /** ISO 8601. */
  fetchedAt: string;
}

/** Where the van goes: named communes, or a radius around a centre. */
export type ServiceArea =
  | { kind: "localities"; names: readonly string[] }
  | { kind: "radius"; center: Geo; km: number };

export type Presence<L extends string> =
  | {
      kind: "storefront";
      address: PostalAddress;
      geo: Geo | null;
      /** Absolute URL of the storefront or van photo taken at the place. */
      storefrontPhoto: string | null;
      /** How a visitor recognises the place — a local landmark, per language. */
      landmark: Readonly<Record<L, string>> | null;
    }
  | { kind: "service-area" };

export interface Place<L extends string> {
  /** The subdomain, or the path segment through the apex. */
  slug: string;
  /** The Google Business Profile's own name — the schema.org `name`. */
  gbpName: string;
  /** The short place name the copy uses: "Royat", "Lyon 3e". */
  name: Readonly<Record<L, string>>;
  presence: Presence<L>;
  serviceArea: readonly ServiceArea[] | null;
  /**
   * International numbers as printed; `null` → the brand's own. `telegram`:
   * the place's bot, its username without `@` (`PlaceLive.telegram`) —
   * absent or `null`, no bot; never the brand's.
   */
  channels: { phone: string | null; whatsapp: string | null; telegram?: string | null };
  /**
   * The panel's switches for the messengers (`PlaceLive.messengers`): `false`
   * takes one off the lead form's messenger variants (`messengerFacts`) only —
   * `contactOf`, the header's and the call bar's numbers, keeps it; absent is on.
   */
  messengers?: MessengerSwitches;
  hours: readonly OpeningHours[] | null;
  /** Live only. */
  rating: Rating | null;
  /**
   * How a priced lead's slot is set (`PlaceLive.booking`, the panel's place
   * settings); absent → `DEFAULT_BOOKING`, a call (`bookingOf`).
   */
  booking?: BookingConfig;
  /** Where the place asks for a Google review (`PlaceLive.reviewUrl`); live only, absent until the panel sends it. */
  reviewUrl?: string;
}

/** Which messengers the panel lets a place offer; a key left out is on. */
export interface MessengerSwitches {
  whatsapp?: boolean;
  telegram?: boolean;
}

/** The storefront half of a place, or `null` for a service-area business. */
export function storefrontOf<L extends string>(
  place: Place<L>,
): Extract<Presence<L>, { kind: "storefront" }> | null {
  return place.presence.kind === "storefront" ? place.presence : null;
}

/**
 * The communes a place names. Until the zone is named, a storefront serves its
 * own town; a radius names no commune.
 */
export function servedLocalities(place: Place<string>): string[] {
  if (place.serviceArea === null) {
    return place.presence.kind === "storefront" ? [place.presence.address.locality] : [];
  }
  return place.serviceArea.flatMap(area => (area.kind === "localities" ? area.names : []));
}
