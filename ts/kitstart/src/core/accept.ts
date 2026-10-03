import { experimentProps } from "./analytics";
import { HONEYPOT_FIELD, LEGACY_HONEYPOT_FIELDS, RENDERED_AT_FIELD, screen, type RateLimiter } from "./antispam";
import { channelOf, MAX_FIELD, readCandidate, validateCandidate, type Lead, type LeadCandidate, type LeadChannel, type LeadPrice } from "./lead";
import { flowOf, readEstimateInputs, type LeadFlow } from "./pricing/flow";
import type { PricingModel } from "./pricing/model";
import { priceOf } from "./pricing/price";
import type { Site } from "./site";

/** Hidden fields the form carries besides what the visitor types. */
export const LOCATION_FIELD = "location";
export const LOCALE_FIELD = "locale";
export const FORM_ID_FIELD = "form_id";
/** The site's experiment assignment, posted so the submit counts in the right arm. */
export const EXPERIMENT_FIELD = "experiment";
export const VARIANT_FIELD = "variant";

/** What the submit event carries besides the form id: slugs only, never what was typed. */
export interface SubmitTags {
  experiment?: string;
  variant?: string;
}
const FORM_ID = /^[a-z0-9_-]{1,32}$/;

export type Outcome<L extends string> =
  /**
   * `ref`: the lead's public reference (`leadRef`). `duplicate`: a resend of
   * a submission already stored — answered as the first was, nothing sent again.
   */
  | { kind: "stored"; id: number; ref: string; lead: Lead; locale: L; formId: string; duplicate?: true }
  /** `field` names what to fix (`phone`, `consent`, … or `form`); `why` is for the log. */
  | { kind: "invalid"; why: string; field: string; channel: LeadChannel; formId: string; locale: L; slug: string | null }
  | { kind: "failed"; locale: L; slug: string | null };

export interface AcceptDeps {
  /** The commit point: resolves once the lead is durable. */
  insert: (lead: Lead) => Promise<number>;
  /** The lead a submission id was stored as (`LeadStore.findSubmission`); absent → no deduplication. */
  findSubmission?: (submissionId: string) => Promise<{ id: number; lead: Lead } | null>;
  /** Runs after the response is sent; see the route handler. */
  defer: (task: () => Promise<void> | void) => void;
  notify: (lead: Lead, id: number) => Promise<void>;
  /**
   * Queues the lead for a durable delivery (the webhook outbox) before the
   * answer, where a crash cannot drop it; a lead the notifier skips is skipped
   * here too. A failure logs and changes nothing — the lead is stored.
   */
  enqueue?: (lead: Lead, id: number, meta: { locale: string; formId: string; leadRef: string }) => void;
  /**
   * The price list to price an `estimate` or `fixed` lead with
   * (`createPricingSource(…).model`); absent → `site.pricing`. A failure is
   * no model: the lead is kept as a `quote`, never refused.
   */
  pricing?: () => Promise<PricingModel | null>;
  /**
   * Queue a rate-limited lead too, for the panel to show as suspect
   * (`LeadWebhookOptions.panelSuspect`). Off: it waits in the table, as before.
   * It is never mailed; a honeypot lead is never sent anywhere.
   */
  sendSuspect?: boolean;
  capture: (lead: Lead, formId: string, tags: SubmitTags) => void;
  limiter: RateLimiter;
  now: number;
  log: Pick<Console, "warn" | "error">;
}

function field(form: FormData, name: string): string | null {
  const value = form.get(name);
  return typeof value === "string" ? value.trim().slice(0, MAX_FIELD) : null;
}

/** FNV-1a, 32 bits, as 8 hex: a tag, not a secret — the core has no `node:crypto`. */
function tag(seed: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * The lead's public reference, `lead-<row>-<8 hex>`: what the visitor's
 * booking carries (`utm_content`) and the webhook offers the panel as its
 * lead id (`LeadWebhookContext.leadRef`), so a booking finds its lead. The
 * row id for a person matching it to the mail; the tag because row ids start
 * over if the leads file is ever recreated. Seeded by the submission id when
 * there is one, so a resend is answered with the same reference.
 */
export function leadRef(id: number, seed: string): string {
  return `lead-${id}-${tag(seed)}`;
}

/**
 * How the lead's need is sold and at what price — the server's own number,
 * from the posted answers through the same `priceOf` the form showed; a
 * posted amount is never read. A callback asks for a call, not a price: no
 * flow. An estimate whose answers do not price (a stale form, a tampered
 * field) is kept as a `quote`: the customer is still a customer.
 */
async function priced(site: Pick<Site<string, string>, "lead" | "pricing">, form: FormData, lead: LeadCandidate, deps: AcceptDeps): Promise<{ flow?: LeadFlow; price?: LeadPrice }> {
  const flows = site.lead.flows;
  if (!flows || channelOf(lead) === "callback") return {};
  let model: PricingModel | null;
  try {
    model = deps.pricing ? await deps.pricing() : (site.pricing ?? null);
  } catch (error) {
    deps.log.error("quote: the price list could not be read; the lead is kept as a quote", error);
    model = null;
  }
  const flow = flowOf(flows, model, lead.subject);
  if (flow === "quote" || !model) return { flow: "quote" };
  const inputs = flow === "estimate" ? readEstimateInputs(model, lead.subject, name => field(form, name)) : {};
  const price = priceOf(model, lead.subject, inputs);
  if (!price) {
    deps.log.warn(`quote: an ${flow} for ${lead.subject} did not price from what was posted; kept as a quote`);
    return { flow: "quote" };
  }
  return { flow, price: { cents: price.cents, validFrom: model.validFrom, ...(flow === "estimate" ? { inputs } : {}) } };
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

/** The stored lead for a submission id; a failed lookup is no lookup — the insert's index still holds. */
async function stored(submissionId: string | undefined, deps: AcceptDeps): Promise<{ id: number; lead: Lead } | null> {
  if (!submissionId || !deps.findSubmission) return null;
  try {
    return await deps.findSubmission(submissionId);
  } catch (error) {
    deps.log.error("quote: the lookup of a resent submission failed", error);
    return null;
  }
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

  // It reaches analytics as a property; anything but a short slug is dropped.
  const posted = field(form, FORM_ID_FIELD);
  const formId = posted !== null && FORM_ID.test(posted) ? posted : "quote";

  const candidate = readCandidate(site.lead, form, slug);
  const rejection = validateCandidate(site.lead, candidate);
  if (rejection) {
    deps.log.warn(`quote: rejected a submission for ${slug ?? "no point"} at ${rejection.field}: missing ${rejection.why}`);
    return { kind: "invalid", why: rejection.why, field: rejection.field, channel: channelOf(candidate), formId, locale, slug };
  }

  // A resend of a stored submission (its answer was lost) is that lead: no
  // second row, no second mail, the limit not spent again.
  const prior = await stored(candidate.submissionId, deps);
  if (prior) return { kind: "stored", id: prior.id, ref: leadRef(prior.id, candidate.submissionId ?? ""), lead: prior.lead, locale, formId, duplicate: true };
  const sale = await priced(site, form, candidate, deps);

  // After validation, so a typo corrected and resent does not spend the limit.
  const verdict = screen({
    honeypot: [HONEYPOT_FIELD, ...LEGACY_HONEYPOT_FIELDS].map(name => field(form, name)).find(v => v) ?? null,
    renderedAt: field(form, RENDERED_AT_FIELD),
    clientKey,
    now: deps.now,
    limiter: deps.limiter,
  });
  const { consentText, ...rest } = candidate;
  const lead: Lead = {
    ...rest,
    ...sale,
    spamVerdict: verdict === "ok" ? null : verdict,
    // Stamped by the server: the moment it accepted the consent with the lead.
    ...(consentText ? { consent: { text: consentText, at: new Date(deps.now).toISOString() } } : {}),
  };

  let id: number;
  try {
    id = await deps.insert(lead);
  } catch (error) {
    // Two posts of one submission raced past the lookup; the unique index let one in.
    const winner = await stored(candidate.submissionId, deps);
    if (winner) return { kind: "stored", id: winner.id, ref: leadRef(winner.id, candidate.submissionId ?? ""), lead: winner.lead, locale, formId, duplicate: true };
    deps.log.error(`quote: the lead store rejected a submission for ${slug ?? "no point"}`, error);
    return { kind: "failed", locale, slug };
  }

  const ref = leadRef(id, candidate.submissionId ?? `${id}:${deps.now}`);

  // The render stamp comes from the client, so it only marks: a `too-fast`
  // lead (or one from a page cached before the stamp existed) is still sent
  // on, flagged. The honeypot and the rate limit are the server's own
  // evidence, and those leads wait in the table for a reviewer.
  const queue = () => {
    if (!deps.enqueue) return;
    try {
      deps.enqueue(lead, id, { locale, formId, leadRef: ref });
    } catch (error) {
      deps.log.error(`quote: lead ${id} is stored but could not be queued for its webhook`, error);
    }
  };
  if (lead.spamVerdict && lead.spamVerdict !== "too-fast") {
    const marked = lead.spamVerdict === "rate-limited" && deps.sendSuspect === true;
    deps.log.warn(`quote: lead ${id} stored as suspected spam (${lead.spamVerdict}); not notified${marked ? ", queued marked suspect" : ""}`);
    if (marked) queue();
    return { kind: "stored", id, ref, lead, locale, formId };
  }
  queue();
  deps.defer(async () => {
    try {
      await deps.notify(lead, id);
    } catch (error) {
      deps.log.error(`quote: lead ${id} is stored but its notification failed`, error);
    }
  });
  const tags: SubmitTags = experimentProps(field(form, EXPERIMENT_FIELD), field(form, VARIANT_FIELD));
  deps.defer(() => deps.capture(lead, formId, tags));
  return { kind: "stored", id, ref, lead, locale, formId };
}

