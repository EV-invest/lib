import { after } from "next/server.js";
import { createAcceptLead } from "../core/accept";
import { analyticsSink, EVENTS } from "../core/analytics";
import { RateLimiter } from "../core/antispam";
import type { LeadStore } from "../core/lead";
import type { Place } from "../core/place/types";
import { createPlaceView } from "../core/place/view";
import { createRouting, THANKS } from "../core/routing";
import { bakedPlace, contactOf, type Site } from "../core/site";
import { clientKey, type ProxyTrust } from "../server/client-key";
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
  env: () => Pick<ServerEnv, "leadsDb" | "posthogKey" | "posthogHost" | "trustedProxy">;
  /** Built once (and at boot, by the brand) so a missing sender fails startup, not a lead. */
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

/** Outside production, with no `TRUSTED_PROXY`: the one hop a dev server has. */
const DEV_TRUST: ProxyTrust = { xffHops: 1 };

class TooLarge extends Error {}

/**
 * The form, read with a hard cut-off: `Content-Length` is only the client's
 * word, and a chunked body has none, so the bytes are counted as they arrive.
 */
async function readForm(request: Request): Promise<FormData> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) throw new TooLarge();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel();
        throw new TooLarge();
      }
      chunks.push(value);
    }
  }
  const body = new Uint8Array(new ArrayBuffer(size));
  let at = 0;
  for (const chunk of chunks) {
    body.set(chunk, at);
    at += chunk.byteLength;
  }
  return new Response(body, { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData();
}

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
  let notifier: LeadNotifier | undefined;
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
    let form: FormData;
    try {
      form = await readForm(request);
    } catch (error) {
      return new Response(null, { status: error instanceof TooLarge ? 413 : 400 });
    }
    let env: ReturnType<QuoteRouteDeps<L>["env"]>;
    try {
      env = deps.env();
    } catch (error) {
      // A broken setting must still answer with the phone, never a bare 500.
      log.error("quote: the server environment is unusable", error);
      const locale = form.get("locale");
      return unavailable(null, typeof locale === "string" && site.i18n.isLocale(locale) ? locale : site.i18n.defaultLocale);
    }
    const outcome = await accept(form, clientKey(request.headers, env.trustedProxy ?? DEV_TRUST), {
      insert: lead => leadStore().insert(lead),
      defer,
      notify: (lead, id) => {
        notifier ??= deps.notifier();
        return notifier.notify(lead, id);
      },
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
