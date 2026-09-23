import { HONEYPOT_FIELD, RENDERED_AT_FIELD, screen, type RateLimiter } from "./antispam";
import { MAX_FIELD, readCandidate, validateCandidate, type Lead } from "./lead";
import type { Site } from "./site";

/** Hidden fields the form carries besides what the visitor types. */
export const LOCATION_FIELD = "location";
export const LOCALE_FIELD = "locale";
export const FORM_ID_FIELD = "form_id";

export type Outcome<L extends string> =
  | { kind: "stored"; id: number; lead: Lead; locale: L; formId: string }
  | { kind: "invalid"; why: string; locale: L; slug: string | null }
  | { kind: "failed"; locale: L; slug: string | null };

export interface AcceptDeps {
  /** The commit point: resolves once the lead is durable. */
  insert: (lead: Lead) => Promise<number>;
  /** Runs after the response is sent; see the route handler. */
  defer: (task: () => Promise<void> | void) => void;
  notify: (lead: Lead, id: number) => Promise<void>;
  capture: (lead: Lead, formId: string) => void;
  limiter: RateLimiter;
  now: number;
  log: Pick<Console, "warn" | "error">;
}

function field(form: FormData, name: string): string | null {
  const value = form.get(name);
  return typeof value === "string" ? value.trim().slice(0, MAX_FIELD) : null;
}

/**
 * The funnel's commit point, independent of HTTP. Order is the invariant:
 * validate → screen → **insert** → (deferred) notify and capture.
 *
 * Nothing that passes validation is thrown away. A submission the barriers
 * suspect is stored with its `spamVerdict` and simply not notified: a
 * mis-set clock, a fast thumb or a shared carrier NAT must not cost a real
 * customer, and a reviewer can still find the row. A lead with no point, or
 * one we no longer have (an old page, a stale form), is stored without one.
 *
 * A notification failure logs and changes nothing; a store failure is
 * `failed`, never `stored` — a thank-you page for a lead that was never
 * written is the worst outcome this system can produce.
 */
export function createAcceptLead<L extends string, P extends string>(
  site: Site<L, P>,
): (form: FormData, clientKey: string, deps: AcceptDeps) => Promise<Outcome<L>> {
  return (form, clientKey, deps) => accept(site, form, clientKey, deps);
}

async function accept<L extends string, P extends string>(
  site: Site<L, P>,
  form: FormData,
  clientKey: string,
  deps: AcceptDeps,
): Promise<Outcome<L>> {
  const rawSlug = field(form, LOCATION_FIELD);
  const slug = rawSlug && site.placeSlugs.includes(rawSlug) ? rawSlug : null;
  const rawLocale = field(form, LOCALE_FIELD);
  const locale = site.i18n.isLocale(rawLocale) ? rawLocale : site.i18n.defaultLocale;

  const candidate = readCandidate(site.lead, form, slug);
  const why = validateCandidate(site.lead, candidate);
  if (why) {
    deps.log.warn(`quote: rejected a submission for ${slug ?? "no point"}: missing ${why}`);
    return { kind: "invalid", why, locale, slug };
  }

  // After validation, so a typo corrected and resent does not spend the limit.
  const verdict = screen({
    honeypot: field(form, HONEYPOT_FIELD),
    renderedAt: field(form, RENDERED_AT_FIELD),
    clientKey,
    now: deps.now,
    limiter: deps.limiter,
  });
  const lead: Lead = { ...candidate, spamVerdict: verdict === "ok" ? null : verdict };

  let id: number;
  try {
    id = await deps.insert(lead);
  } catch (error) {
    deps.log.error(`quote: the lead store rejected a submission for ${slug ?? "no point"}`, error);
    return { kind: "failed", locale, slug };
  }

  const formId = field(form, FORM_ID_FIELD) ?? "quote";
  // The render stamp comes from the client, so it only marks: a `too-fast`
  // lead (or one from a page cached before the stamp existed) is still sent
  // on, flagged. The honeypot and the rate limit are the server's own
  // evidence, and those leads wait in the table for a reviewer.
  if (lead.spamVerdict && lead.spamVerdict !== "too-fast") {
    deps.log.warn(`quote: lead ${id} stored as suspected spam (${lead.spamVerdict}); not notified`);
    return { kind: "stored", id, lead, locale, formId };
  }
  deps.defer(async () => {
    try {
      await deps.notify(lead, id);
    } catch (error) {
      deps.log.error(`quote: lead ${id} is stored but its notification failed`, error);
    }
  });
  deps.defer(() => deps.capture(lead, formId));
  return { kind: "stored", id, lead, locale, formId };
}

