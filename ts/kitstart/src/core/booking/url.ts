import { normalizePhone } from "../phone";
import type { BookingChoice } from "./model";

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
 * The page a click opens, or `null` for `manual`. The lead's reference goes
 * in the QUERY, never the fragment: `link` as `ref=<leadRef>` (and nothing
 * else — an arbitrary host gets no personal data); `cal_com` as
 * `metadata[ref]` with the name and the phone. `google_calendar` takes no
 * parameter: its URL as is, and the panel matches by contact and time.
 */
export function bookingHref(choice: BookingChoice, prefill: BookingPrefill): string | null {
  const name = prefill.name?.trim();
  const phone = prefill.phone ? normalizePhone(prefill.phone) : null;
  switch (choice.provider) {
    case "manual":
      return null;
    case "link":
      return withQuery(choice.url, [["ref", prefill.leadRef]]);
    case "google_calendar":
      return choice.url;
    case "cal_com": {
      const pairs: [string, string][] = [];
      if (name) pairs.push(["name", name]);
      if (phone) pairs.push(["attendeePhoneNumber", phone]);
      pairs.push(["metadata[ref]", prefill.leadRef]);
      return withQuery(choice.url, pairs);
    }
  }
}
