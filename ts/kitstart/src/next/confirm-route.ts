import { EXPERIMENT_FIELD, FORM_ID_FIELD, LOCALE_FIELD, LOCATION_FIELD, SHOWN_CENTS_FIELD, VARIANT_FIELD } from "../core/accept";
import { HONEYPOT_FIELD, RENDERED_AT_FIELD } from "../core/antispam";
import { CARD_FIELD, CARD_ID, SUBMISSION_FIELD, SUBMISSION_ID } from "../core/lead";
import { fillText, formatCents } from "../core/lead-capture-format";
import { flowTextOf, LEAD_CAPTURE_TEXT, type LeadCaptureText } from "../core/lead-capture-text";
import { createPlaceView } from "../core/place/view";
import { estimateField, flowOf, readEstimateInputs } from "../core/pricing/flow";
import type { PricingModel } from "../core/pricing/model";
import { PRICING_LIMITS } from "../core/pricing/model";
import { priceOf } from "../core/pricing/price";
import { createRouting } from "../core/routing";
import { bakedPlace, type Site } from "../core/site";
import type { PricingSource } from "../server/pricing-source";

/**
 * `app/quote/confirm/route.ts` — where a form posted without a script lands
 * when the price it showed has changed (`price_changed`). Its page may be a
 * cached render (ISR) that still shows the old price, so sending it back there
 * would refuse every resubmit; this page is never cached. It prices the
 * answers afresh, says the price changed, and asks to confirm: a form posting
 * to `/quote` with the fresh price as `shown_cents`.
 *
 * ```ts
 * export const dynamic = "force-dynamic";
 * export const GET = confirmRoute(site, { pricing });
 * ```
 *
 * The URL carries only what the visitor chose — the need, the answers, the
 * page's ids and the price they saw — never what they typed: the phone and
 * the postcode are asked again. A brand's extra fields are not carried.
 */
export interface ConfirmRouteDeps<L extends string> {
  /** The price list the quote route prices with; absent → `site.pricing`. */
  pricing?: PricingSource;
  /** The form's words; the kit's in the page's language by default. */
  text?: (locale: L) => LeadCaptureText;
  /** The quote route's path; `/quote`. */
  action?: string;
  now?: () => number;
}

export const CONFIRM_PATH = "/quote/confirm";
/** The price the visitor saw, in the confirmation's query. */
export const SHOWN_PARAM = "shown";

const escape = (s: string): string =>
  s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

const SLUG = /^[a-z0-9_-]{1,40}$/;
const CENTS = /^\d{1,12}$/;

/**
 * The confirmation's query for a refused form: the fields the visitor chose
 * and the page's own ids, slugs only, and the price shown. Used by the quote
 * route; nothing typed goes in it.
 */
export function confirmQuery(site: Pick<Site<string, string>, "lead">, form: FormData): URLSearchParams {
  const query = new URLSearchParams();
  const keep = (name: string, test: RegExp) => {
    const value = form.get(name);
    if (typeof value === "string" && test.test(value)) query.set(name, value);
  };
  for (const name of [LOCALE_FIELD, LOCATION_FIELD, FORM_ID_FIELD, EXPERIMENT_FIELD, VARIANT_FIELD]) keep(name, SLUG);
  keep(CARD_FIELD, CARD_ID);
  keep(SUBMISSION_FIELD, SUBMISSION_ID);
  const subject = form.get(site.lead.wire.subject);
  if (typeof subject === "string" && site.lead.subjects.includes(subject)) query.set(site.lead.wire.subject, subject);
  for (const [name, value] of form) {
    if (name.startsWith("estimate_") && typeof value === "string" && PRICING_LIMITS.slug.test(value) && SLUG.test(name.slice("estimate_".length))) query.set(name, value);
  }
  const shown = form.get(SHOWN_CENTS_FIELD);
  if (typeof shown === "string" && CENTS.test(shown)) query.set(SHOWN_PARAM, shown);
  return query;
}

function page(lang: string, title: string, body: string): Response {
  const html = `<!doctype html><html lang="${escape(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escape(title)}</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:2rem auto;padding:0 1rem;line-height:1.5">${body}</body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

export function confirmRoute<L extends string, P extends string>(site: Site<L, P>, deps: ConfirmRouteDeps<L> = {}): (request: Request) => Promise<Response> {
  const routing = createRouting(site);
  const action = deps.action ?? "/quote";
  const now = deps.now ?? Date.now;

  return async request => {
    const url = new URL(request.url);
    const q = (name: string): string | null => url.searchParams.get(name);
    const rawLocale = q(LOCALE_FIELD);
    const locale = site.i18n.isLocale(rawLocale) ? rawLocale : site.i18n.defaultLocale;
    const rawSlug = q(LOCATION_FIELD);
    const place = rawSlug ? bakedPlace(site, rawSlug) : undefined;
    const card = q(CARD_FIELD);
    const anchor = card !== null && CARD_ID.test(card) ? card : "quote";
    const host = request.headers.get("host") ?? url.host;
    const back = (): Response => {
      const mode = place && routing.hostSlug(host) === place.slug ? "host" : "path";
      const location = place ? createPlaceView(site, place, locale, mode).href(`#${anchor}`) : `/${locale}#${anchor}`;
      return new Response(null, { status: 303, headers: { Location: location, "Cache-Control": "no-store" } });
    };

    const need = q(site.lead.wire.subject);
    if (need === null) return back();
    let model: PricingModel | null;
    try {
      model = deps.pricing ? await deps.pricing.model() : (site.pricing ?? null);
    } catch {
      model = null;
    }
    const flow = flowOf(site.lead.flows, model, need);
    if (flow === "quote" || !model) return back();
    const inputs = flow === "estimate" ? readEstimateInputs(model, need, name => q(name)) : {};
    const price = priceOf(model, need, inputs);
    if (!price) return back();

    const kit = locale.startsWith("en") ? LEAD_CAPTURE_TEXT.en : LEAD_CAPTURE_TEXT.fr;
    const base = deps.text?.(locale) ?? kit;
    const flowText = flowTextOf(base, locale);
    const fresh = formatCents(price.cents, locale);
    const shown = q(SHOWN_PARAM);
    const said = shown !== null && CENTS.test(shown) ? fillText(flowText.priceChanged, { price: fresh, shown: formatCents(Number(shown), locale) }) : flowText.priceChangedGeneric;

    const hidden: [string, string][] = [
      [site.lead.wire.subject, need],
      ...Object.entries(inputs).map(([input, option]): [string, string] => [estimateField(input), option]),
      [SHOWN_CENTS_FIELD, String(price.cents)],
      [RENDERED_AT_FIELD, String(now())],
    ];
    for (const name of [LOCALE_FIELD, LOCATION_FIELD, FORM_ID_FIELD, EXPERIMENT_FIELD, VARIANT_FIELD, CARD_FIELD, SUBMISSION_FIELD]) {
      const value = q(name);
      if (value !== null) hidden.push([name, value]);
    }
    const field = (name: string, label: string, type: string, autocomplete: string) =>
      `<p><label for="${escape(name)}">${escape(label)}</label><br><input id="${escape(name)}" name="${escape(name)}" type="${type}" autocomplete="${autocomplete}" required style="font-size:1rem;padding:.5rem;width:100%"></p>`;
    const body = [
      `<h1>${escape(flowText.priceTitle)} : ${escape(fresh)}</h1>`,
      `<p role="alert">${escape(said)}</p>`,
      `<p>${escape(flowText.priceNote)}</p>`,
      `<form method="post" action="${escape(action)}">`,
      ...hidden.map(([name, value]) => `<input type="hidden" name="${escape(name)}" value="${escape(value)}">`),
      `<input type="text" name="${HONEYPOT_FIELD}" tabindex="-1" autocomplete="off" value="" aria-hidden="true" style="position:absolute;left:-9999px">`,
      field(site.lead.wire.locality, base.localityLabel, "text", "postal-code"),
      field(site.lead.wire.mobile, base.phoneLabel, "tel", "tel"),
      `<p><button type="submit" style="font-size:1rem;padding:.75rem 1.5rem">${escape(flowText.bookSubmit)}</button></p>`,
      "</form>",
    ].join("");
    return page(site.i18n.hreflangOf(locale), flowText.priceTitle, body);
  };
}
