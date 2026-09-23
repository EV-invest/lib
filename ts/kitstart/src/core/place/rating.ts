import type { Place, Rating } from "./types";

/** Google Business Profile API policy: no cached copy older than this. */
export const RATING_MAX_AGE_DAYS = 30;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * An instant from the live source: RFC 3339 with an offset or `Z`, or a bare
 * date (midnight UTC). A date-time without an offset is refused — `Date.parse`
 * would read it in the server's own zone, so one timestamp would mean two
 * instants on two pods (and in the Rust port). `null` for anything else.
 */
export function parseInstant(value: string): number | null {
  if (!DATE.test(value) && !DATE_TIME.test(value)) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/**
 * The rating, only while it may still be shown. A stale or future-dated copy
 * is treated as absent — the page then says nothing about a rating rather than
 * something the terms no longer allow.
 */
export function freshRating(place: Place<string>, now: Date): Rating | null {
  const rating = place.rating;
  if (!rating) return null;
  const fetched = parseInstant(rating.fetchedAt);
  if (fetched === null) return null;
  const age = now.getTime() - fetched;
  if (age < 0 || age > RATING_MAX_AGE_DAYS * 86_400_000) return null;
  return rating;
}
