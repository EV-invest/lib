import type { Place, Rating } from "./types";

/** Google Business Profile API policy: no cached copy older than this. */
export const RATING_MAX_AGE_DAYS = 30;

/**
 * The rating, only while it may still be shown. A stale or future-dated copy
 * is treated as absent — the page then says nothing about a rating rather than
 * something the terms no longer allow.
 */
export function freshRating(place: Place<string>, now: Date): Rating | null {
  const rating = place.rating;
  if (!rating) return null;
  const fetched = Date.parse(rating.fetchedAt);
  if (Number.isNaN(fetched)) return null;
  const age = now.getTime() - fetched;
  if (age < 0 || age > RATING_MAX_AGE_DAYS * 86_400_000) return null;
  return rating;
}
