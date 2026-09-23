import { after } from "next/server.js";
import { createAcceptLead } from "../core/accept";
import { analyticsSink, EVENTS } from "../core/analytics";
import { RateLimiter } from "../core/antispam";
import type { LeadStore } from "../core/lead";
import type { Place } from "../core/place/types";
import { createPlaceView } from "../core/place/view";
import { createRouting, THANKS } from "../core/routing";
import { bakedPlace, contactOf, type Site } from "../core/site";
import { clientKey } from "../server/client-key";
import type { ServerEnv } from "../server/env";
import { openLeadStore } from "../server/lead-store";
import type { LeadNotifier } from "../server/notify";

/**
 * `app/quote/route.ts` — the no-JS path, and the one that has to keep working:
 * a plain form POST answered with a 303, so a refresh does not resubmit.
 *
 * ```ts
 * export const dynamic = "force-dynamic";
 * export const POST = quoteRoute(site, { env: serverEnv, notifier, unavailable });
 * ```
 */
export interface UnavailableCopy {
  title: string;
  heading: string;
  body: string;
  callLabel: string;
}

export interface QuoteRouteDeps<L extends string> {
  env: () => Pick<ServerEnv, "leadsDb" | "posthogKey" | "posthogHost">;
  /** Built once at boot so a missing sender fails startup, not a lead. */
  notifier: () => LeadNotifier;
  /** The self-contained 500's words, when the store refused the lead. */
  unavailable: (locale: L, place: Place<L> | null) => UnavailableCopy;
  /** Opened on first use (`next build` imports the route); defaults to `LEADS_DB_URL`'s. */
  store?: () => LeadStore;
  limiter?: RateLimiter;
  /** Work after the response; `after` from `next/server` by default. */
  defer?: (task: () => Promise<void> | void) => void;
  now?: () => number;
  log?: Pick<Console, "warn" | "error">;
}

/** The Rust server's body limit; a quote is a few short fields. */
const MAX_BODY = 64 * 1024;

const escape = (s: string): string =>
  s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

function seeOther(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}

export function quoteRoute<L extends string, P extends string>(
  site: Site<L, P>,
  deps: QuoteRouteDeps<L>,
): (request: Request) => Promise<Response> {
  const accept = createAcceptLead(site);
  const routing = createRouting(site);
  const limiter = deps.limiter ?? new RateLimiter(5, 10 * 60_000);
  const defer = deps.defer ?? after;
  const log = deps.log ?? console;
  let store: LeadStore | undefined;
  const leadStore = (): LeadStore => {
    store ??= deps.store ? deps.store() : openLeadStore(deps.env().leadsDb);
    return store;
  };

  /** Where a page of the submitting place is — or of the brand, with none. */
  function href(request: Request, slug: string | null, locale: L, suffix: string): string {
    const place = slug ? bakedPlace(site, slug) : undefined;
    if (!place) return `/${locale}${suffix}`;
    // Links follow the host the form was posted from: the place's own, or the
    // apex fallback path.
    const mode = routing.hostSlug(request.headers.get("host") ?? "") === place.slug ? "host" : "path";
    return createPlaceView(site, place, locale, mode).href(suffix);
  }

  /** Self-contained: the thing that failed may be the thing that renders pages. */
  function unavailable(slug: string | null, locale: L): Response {
    const place = (slug ? bakedPlace(site, slug) : undefined) ?? null;
    const phone = place ? contactOf(site, place).phone : site.brand.phone;
    const words = deps.unavailable(locale, place);
    const call = phone ? `<p><a href="tel:${escape(phone.replace(/[^\d+]/g, ""))}">${escape(words.callLabel)}</a></p>` : "";
    const html = `<!doctype html><html lang="${escape(locale)}"><meta charset="utf-8"><meta name="robots" content="noindex"><title>${escape(words.title)}</title><body style="font-family:system-ui;max-width:36rem;margin:4rem auto;padding:0 1.25rem"><h1>${escape(words.heading)}</h1><p>${escape(words.body)}</p>${call}</body></html>`;
    return new Response(html, { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  return async request => {
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return new Response(null, { status: 413 });
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return new Response(null, { status: 400 });
    }
    const env = deps.env();
    const outcome = await accept(form, clientKey(request.headers), {
      insert: lead => leadStore().insert(lead),
      defer,
      notify: (lead, id) => deps.notifier().notify(lead, id),
      capture: (lead, formId) =>
        analyticsSink({ key: env.posthogKey, host: env.posthogHost, brandId: site.brand.id }, lead.placeSlug).capture(EVENTS.leadSubmit, {
          form_id: formId,
        }),
      limiter,
      now: deps.now?.() ?? Date.now(),
      log,
    });
    switch (outcome.kind) {
      // A suspected bot is answered exactly as a person is.
      case "stored":
        return seeOther(href(request, outcome.lead.placeSlug, outcome.locale, THANKS));
      case "invalid":
        return seeOther(href(request, outcome.slug, outcome.locale, outcome.slug ? "#quote" : ""));
      case "failed":
        return unavailable(outcome.slug, outcome.locale);
    }
  };
}
