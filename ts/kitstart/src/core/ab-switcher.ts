/**
 * The QA switcher's decisions, as plain functions over strings: what the
 * cookies assign, where a variant's tap leads, what a reset clears — whether
 * the menu shows at all is `ab-gate.ts`. The lazy panel only applies them to
 * `document.cookie` and `location`.
 *
 * The mechanism is the brand proxy's, unchanged: it keeps an assignment in a
 * cookie `ab_<key>`, and `?ab_<key>=<value>` forces a variant and sets the QA
 * cookie that marks the visit as a test.
 */

/** The prefix of an assignment cookie: `ab_lead_form` holds `lead_form`'s variant. */
export const AB_COOKIE_PREFIX = "ab_";
/** The default prefix of the query parameter that forces a variant. */
export const AB_FORCE_PARAM = "ab_";

/** A cookie's value from a `document.cookie` string, by exact name, or `null`. */
export function cookieValue(cookies: string, name: string): string | null {
  for (const pair of cookies.split(";")) {
    const eq = pair.indexOf("=");
    if (eq < 0 || pair.slice(0, eq).trim() !== name) continue;
    const raw = pair.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

/** Each key's assigned variant read off the cookies; a key with none is left out. */
export function abAssignments(cookies: string, keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = cookieValue(cookies, `${AB_COOKIE_PREFIX}${key}`);
    if (value) out[key] = value;
  }
  return out;
}

/** The same page forcing `key` to `value`: the other parameters and the hash kept, an earlier force replaced. */
export function abVariantUrl(href: string, key: string, value: string, forceParam: string = AB_FORCE_PARAM): string {
  const url = new URL(href);
  url.searchParams.set(`${forceParam}${key}`, value);
  return url.toString();
}

export interface AbReset {
  /** Each a `document.cookie` assignment that deletes one cookie. */
  cookies: string[];
  /** The page without the force parameters: left in, a reload would force the variant again. */
  url: string;
}

/**
 * What a reset clears. `"reassign"` drops the experiments' assignments only —
 * the variant is drawn again and the visit stays a test, the menu with it;
 * `"leave"` drops the QA cookie too. The QA cookie may itself start with the
 * assignment prefix (`ab__qa`), so it is excluded by name, never by pattern.
 */
export function abReset(href: string, keys: readonly string[], qaCookie: string, mode: "reassign" | "leave", forceParam: string = AB_FORCE_PARAM): AbReset {
  const names = keys.map(k => `${AB_COOKIE_PREFIX}${k}`).filter(n => n !== qaCookie);
  if (mode === "leave") names.push(qaCookie);
  const url = new URL(href);
  for (const key of keys) url.searchParams.delete(`${forceParam}${key}`);
  return { cookies: names.map(n => `${n}=; path=/; max-age=0`), url: url.toString() };
}
