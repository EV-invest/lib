import { leadRef } from "../core/accept";
import { bookingRequestProblems, parseBookingRequest } from "../core/booking/validate";
import type { LeadStore } from "../core/lead";
import type { ServerEnv } from "../server/env";
import { openLeadStore } from "../server/lead-store";
import type { LeadWebhook } from "../server/lead-webhook";

/**
 * `app/quote/booking/route.ts` — the page's word that a priced lead asked for
 * a slot: `booking.requested@1` to the panel, after the lead's `lead.created`,
 * through the same outbox. `LeadCapture` posts it when the visitor opens a
 * booking page (`link`, `cal_com`) or sends a `manual` preference.
 *
 * ```ts
 * export const dynamic = "force-dynamic";
 * export const POST = bookingRoute({ env: serverEnv, webhook });
 * ```
 *
 * The body is JSON: `booking.requested@1`'s properties (`lead_ref`,
 * `provider`, `preferred_date?`, `preferred_part?`) plus `submission`, the
 * form's submission id. The id is what proves the post comes from the page
 * that sent the lead: it is a random UUID only that page knew, and the lead's
 * reference is derived from it — a guessed `lead_ref` alone books nothing.
 * Answers `200 { ok: true, queued }`; `queued` is `false` when the switch is
 * off (`panelBooking`) or the lead already asked.
 */
export interface BookingRouteDeps {
  env: () => Pick<ServerEnv, "leadsDb">;
  /** The same webhook the quote route queues `lead.created` on. */
  webhook?: () => LeadWebhook | null;
  store?: () => LeadStore;
  now?: () => number;
  log?: Pick<Console, "warn" | "error">;
}

const MAX_BODY = 4 * 1024;
const DAY_MS = 86_400_000;
/** How far ahead a preferred day may be; a day already past (a day's slack for time zones) is refused. */
const MAX_AHEAD_DAYS = 366;
const SUBMISSION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

function inWindow(day: string, now: number): boolean {
  const at = Date.parse(`${day}T00:00:00Z`);
  return at >= now - 2 * DAY_MS && at <= now + MAX_AHEAD_DAYS * DAY_MS;
}

/** The body as text, or `null` past `MAX_BODY` — counted as it arrives, since a chunked body has no length. */
async function readCapped(request: Request): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const decoder = new TextDecoder();
  return chunks.map(c => decoder.decode(c, { stream: true })).join("") + decoder.decode();
}

export function bookingRoute(deps: BookingRouteDeps): (request: Request) => Promise<Response> {
  const log = deps.log ?? console;
  const now = deps.now ?? Date.now;
  let store: LeadStore | undefined;
  let webhook: LeadWebhook | null | undefined;

  return async request => {
    // A cross-origin page cannot send this type without a preflight, which
    // this route never answers: the JSON type is the CSRF check.
    if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) return json(415, { ok: false });
    const text = await readCapped(request);
    if (text === null) return json(413, { ok: false });
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json(400, { ok: false });
    }
    if (!isObject(body)) return json(400, { ok: false });
    const { submission, ...properties } = body;
    if (typeof submission !== "string" || !SUBMISSION.test(submission)) return json(422, { ok: false });
    if (bookingRequestProblems(properties).length > 0) return json(422, { ok: false });
    const booking = parseBookingRequest(properties);
    if (booking.preferredDate !== undefined && !inWindow(booking.preferredDate, now())) return json(422, { ok: false });

    let found;
    try {
      store ??= deps.store ? deps.store() : openLeadStore(deps.env().leadsDb);
      if (!store.findSubmission) return json(501, { ok: false });
      found = await store.findSubmission(submission);
    } catch (error) {
      log.error("booking: the lead store could not be read", error);
      return json(503, { ok: false });
    }
    if (!found || leadRef(found.id, submission) !== booking.leadRef) return json(404, { ok: false });
    // Booking follows a priced lead; a quote's slot is set on the call.
    if (found.lead.flow !== "estimate" && found.lead.flow !== "fixed") return json(409, { ok: false });

    if (webhook === undefined) {
      webhook = deps.webhook?.() ?? null;
      webhook?.start();
    }
    // Sent by the outbox's own timer, like a lead's retry: the visitor waits for nothing.
    const queued = webhook?.requestBooking?.(booking) ?? { kind: "off" };
    // The lead stays in the leads file for a person; the panel never heard of it.
    if (queued.kind === "unqueued") log.warn(`booking: lead ${found.id} asked for a ${booking.provider} slot but was never sent to the panel; not queued`);
    return json(200, { ok: true, queued: queued.kind === "queued" });
  };
}
