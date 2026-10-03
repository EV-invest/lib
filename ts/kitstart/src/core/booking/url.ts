import { normalizePhone } from "../phone";
import type { BookingConfig } from "./model";

/** What the page knows of the lead when the visitor asks for a slot. */
export interface BookingPrefill {
  leadRef: string;
  /** As typed; `cal_com` only. */
  name?: string | null | undefined;
  /** As typed; `cal_com` only, and only as a number `normalizePhone` reads (E.164). */
  phone?: string | null | undefined;
}

function keyOf(pair: string): string {
  const key = pair.split("=", 1)[0] ?? "";
  try {
    return decodeURIComponent(key.replaceAll("+", " "));
  } catch {
    return key;
  }
}

/**
 * `url` with `pairs` in its query, each replacing any pair of the same key
 * the URL already had; the rest of the query is kept byte for byte. Keys go
 * as written (`metadata[ref]`, as Cal.com documents it), values encoded.
 */
function withQuery(url: string, pairs: readonly (readonly [string, string])[]): string {
  const u = new URL(url);
  const keys = new Set(pairs.map(([k]) => k));
  const kept = u.search
    .slice(1)
    .split("&")
    .filter(p => p !== "" && !keys.has(keyOf(p)));
  u.search = [...kept, ...pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`)].join("&");
  return u.toString();
}

/**
 * The page a click opens, or `null` for `manual`. The lead's reference always
 * goes in the QUERY, never the fragment: `link` as `ref=<leadRef>` (and
 * nothing else — an arbitrary host gets no personal data), `cal_com` as
 * `metadata[ref]=<leadRef>` with the name and the phone prefilled, so the
 * booking comes back to the panel naming its lead.
 */
export function bookingHref(config: BookingConfig, prefill: BookingPrefill): string | null {
  switch (config.provider) {
    case "manual":
      return null;
    case "link":
      return withQuery(config.url, [["ref", prefill.leadRef]]);
    case "cal_com": {
      const pairs: [string, string][] = [];
      const name = prefill.name?.trim();
      if (name) pairs.push(["name", name]);
      const phone = prefill.phone ? normalizePhone(prefill.phone) : null;
      if (phone) pairs.push(["attendeePhoneNumber", phone]);
      pairs.push(["metadata[ref]", prefill.leadRef]);
      return withQuery(config.url, pairs);
    }
  }
}
