import { after } from "next/server.js";
import { createAcceptLead } from "../core/accept";
import { analyticsSink, EVENTS } from "../core/analytics";
import { RateLimiter } from "../core/antispam";
import { CARD_FIELD, CARD_ID, channelOf, LEAD_ERROR_PARAM, type LeadChannel, type LeadStore } from "../core/lead";
import type { Place } from "../core/place/types";
import { createPlaceView } from "../core/place/view";
import { createRouting } from "../core/routing";
import { bakedPlace, contactOf, type Site } from "../core/site";
import { thanksSuffix } from "../core/status";
import { clientKey, type ProxyTrust } from "../server/client-key";
import type { ServerEnv } from "../server/env";
import { openLeadStore } from "../server/lead-store";
import type { LeadWebhook } from "../server/lead-webhook";
import type { LeadNotifier } from "../server/notify";

/**
 * `app/quote/route.ts` — the no-JS path, and the one that has to keep working:
 * a plain form POST answered with a 303, so a refresh does not resubmit.
 * A refused lead goes back to its card with the field to fix
 * (`/fr?lead_error=phone#devis`); a script asking for JSON (`Accept:
 * application/json`) is answered `422 { ok: false, field }` instead, and
 * `200 { ok: true, location }` for a lead taken.
 *
 * ```ts
 * export const dynamic = "force-dynamic";
 * export const POST = quoteRoute(site, { env: serverEnv, notifier, webhook, unavailable, anchor: "devis" });
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
  /**
   * The signed lead webhook, or `null` when it is off (`leadWebhook`). A lead
   * is queued before the 303 and sent after it; the brand's
   * `instrumentation.ts` should `start()` it so a restart resumes the queue
   * without waiting for the next lead.
   */
  webhook?: () => LeadWebhook | null;
  /** The self-contained 500's words, when the store refused the lead. */
  unavailable: (locale: L, place: Place<L> | null) => UnavailableCopy;
  /** Opened on first use (`next build` imports the route); defaults to `LEADS_DB_URL`'s. */
  store?: () => LeadStore;
  limiter?: RateLimiter;
  /**
   * The card's id a refused lead is sent back to, when the form did not post
   * its own (`card`, which `LeadCapture` does): `quote` by default, the
   * `LeadCapture` default. A slug, `[a-z0-9-]`; a callback lands on
   * `<anchor>-callback`.
   */
  anchor?: string;
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

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

/** `LeadCapture`'s own post asks for JSON; a plain form post never does. */
const wantsJson = (request: Request): boolean => (request.headers.get("accept") ?? "").includes("application/json");

export function quoteRoute<L extends string, P extends string>(
  site: Site<L, P>,
  deps: QuoteRouteDeps<L>,
): (request: Request) => Promise<Response> {
  const anchor = deps.anchor ?? "quote";
  if (!CARD_ID.test(anchor)) throw new Error(`quoteRoute: the anchor must be a slug ([a-z0-9-]), got ${JSON.stringify(anchor)}`);
  const accept = createAcceptLead(site);
  const routing = createRouting(site);
  const limiter = deps.limiter ?? new RateLimiter(5, 10 * 60_000);
  const defer = deps.defer ?? after;
  const log = deps.log ?? console;
  let store: LeadStore | undefined;
  let notifier: LeadNotifier | undefined;
  let webhook: LeadWebhook | null | undefined;
  const leadWebhook = (): LeadWebhook | null => {
    if (webhook === undefined) {
      webhook = deps.webhook?.() ?? null;
      // Idempotent: a brand that started it at boot keeps its timer.
      webhook?.start();
    }
    return webhook;
  };
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

  /**
   * Back to the card, with the field to fix and the need already chosen —
   * slugs only: a phone or a name in a URL ends up in logs and analytics. The
   * card is the one the form posted, if its id is a slug.
   */
  function refused(form: FormData, field: string, channel: LeadChannel): string {
    const query = new URLSearchParams({ [LEAD_ERROR_PARAM]: field });
    const subject = form.get(site.lead.wire.subject);
    if (channel === "form" && typeof subject === "string" && site.lead.subjects.includes(subject as P)) query.set("need", subject);
    const posted = form.get(CARD_FIELD);
    const card = typeof posted === "string" && CARD_ID.test(posted) ? posted : anchor;
    return `?${query}#${card}${channel === "callback" ? "-callback" : ""}`;
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
      findSubmission: async submissionId => (await leadStore().findSubmission?.(submissionId)) ?? null,
      defer,
      notify: (lead, id) => {
        notifier ??= deps.notifier();
        return notifier.notify(lead, id);
      },
      enqueue: (lead, id, meta) => {
        const hook = leadWebhook();
        if (!hook) return;
        hook.enqueue(lead, id, meta);
        defer(() =>
          hook.tick().then(
            () => undefined,
            error => log.error("quote: the webhook delivery after a lead failed", error),
          ),
        );
      },
      capture: (lead, formId, tags) =>
        analyticsSink({ key: env.posthogKey, host: env.posthogHost, brandId: site.brand.id }, lead.placeSlug).capture(EVENTS.leadSubmit, {
          form_id: formId,
          channel: channelOf(lead),
          ...tags,
        }),
      limiter,
      now: deps.now?.() ?? Date.now(),
      log,
    });
    const scripted = wantsJson(request);
    switch (outcome.kind) {
      // A suspected bot is answered exactly as a person is.
      case "stored": {
        const location = href(request, outcome.lead.placeSlug, outcome.locale, thanksSuffix(channelOf(outcome.lead)));
        return scripted ? json(200, { ok: true, location }) : seeOther(location);
      }
      case "invalid":
        if (scripted) return json(422, { ok: false, field: outcome.field });
        return seeOther(href(request, outcome.slug, outcome.locale, refused(form, outcome.field, outcome.channel)));
      case "failed":
        return unavailable(outcome.slug, outcome.locale);
    }
  };
}
