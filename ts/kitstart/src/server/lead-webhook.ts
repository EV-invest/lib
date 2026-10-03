import "server-only";
import { randomUUID } from "node:crypto";
import type { BookingRequest } from "../core/booking/model";
import { suspectOf, type Lead, type LeadChannel, type LeadSuspect } from "../core/lead";
import type { LeadFlow } from "../core/pricing/flow";
import type { ServerEnv } from "./env";
import { openWebhookOutbox, type TickReport, type WebhookOutbox, type WebhookOutboxOptions } from "./webhook-outbox";
import type { WebhookSigning } from "./webhook-signature";

/** What the brand's body builder is told besides the lead. */
export interface LeadWebhookContext {
  /** The row id in the leads table. */
  leadId: number;
  brandId: string;
  locale: string;
  formId: string;
  /** When the lead was accepted. */
  at: Date;
  /** Fresh per lead and stored with the body, so every retry carries the same one. */
  idempotencyKey: string;
  /**
   * Why the lead is suspect (`suspectOf`), for the panel's `suspect`
   * property — only under `panelSuspect`; otherwise always absent, and the
   * body must not carry the property at all.
   */
  suspect?: LeadSuspect;
  /**
   * The lead's public reference (`leadRef`, `lead-<row>-<8 hex>`): the one
   * the page was answered with (`LeadSent.lead`), so a later step on the page
   * can name the lead the panel knows. Absent only on a context built by hand.
   */
  leadRef?: string;
  /**
   * How the need was sold and at what price — only under `panelFlow`, and
   * only on a lead with a flow; otherwise absent, and the body must not carry
   * the properties. `panelFlowProperties` writes them as the panel reads them.
   */
  flow?: PanelFlow;
}

/** A lead's sale as the panel's `lead.created` may carry it. */
export interface PanelFlow {
  flow: LeadFlow;
  /** With `estimate` and `fixed` only, always with `pricingValidFrom`. */
  quotedCents?: number;
  /** The price list's date, `YYYY-MM-DD`. */
  pricingValidFrom?: string;
  /** With `estimate` only, and only when it asked anything: input id → option id, slugs. */
  estimateInputs?: Readonly<Record<string, string>>;
}

/** The sale `ctx.flow` describes, or nothing for a lead without a flow. */
export function panelFlowOf(lead: Pick<Lead, "flow" | "price">): PanelFlow | undefined {
  if (!lead.flow) return undefined;
  if (lead.flow === "quote" || !lead.price) return { flow: "quote" };
  const inputs = lead.flow === "estimate" && lead.price.inputs && Object.keys(lead.price.inputs).length > 0 ? { estimateInputs: lead.price.inputs } : {};
  return { flow: lead.flow, quotedCents: lead.price.cents, pricingValidFrom: lead.price.validFrom, ...inputs };
}

/**
 * `ctx.flow` as `lead.created`'s properties: `flow`, then `quoted_cents` and
 * `pricing_valid_from` together (estimate and fixed), then `estimate_inputs`
 * (estimate) — the panel's closed vocabulary. Spread into the body's
 * `properties`; `{}` without a flow.
 */
export interface PanelFlowProperties {
  flow: LeadFlow;
  quoted_cents?: number;
  pricing_valid_from?: string;
  estimate_inputs?: Readonly<Record<string, string>>;
}

export function panelFlowProperties(flow: PanelFlow | undefined): PanelFlowProperties | Record<string, never> {
  if (!flow) return {};
  return {
    flow: flow.flow,
    ...(flow.quotedCents !== undefined && flow.pricingValidFrom !== undefined ? { quoted_cents: flow.quotedCents, pricing_valid_from: flow.pricingValidFrom } : {}),
    ...(flow.estimateInputs ? { estimate_inputs: flow.estimateInputs } : {}),
  };
}

/**
 * What the Service-Arb panel's `lead.created` calls a callback request. Its
 * `properties.channel` is a closed set (`form` | `phone_inbound`) and an event
 * outside it is refused whole — the outbox would park the lead — so until the
 * panel's `sa.funnel.v1` accepts `callback`, a callback travels as `form`.
 * TODO(panel): set to "callback" once the panel accepts it; nothing else changes.
 */
const PANEL_CALLBACK = "form";

/** A lead's channel as the panel's `properties.channel` may carry it: `panelChannel(channelOf(lead))`. */
export function panelChannel(channel: LeadChannel): "form" | typeof PANEL_CALLBACK {
  return channel === "callback" ? PANEL_CALLBACK : "form";
}

/**
 * The receiver's body, built by the brand: the kit serialises and signs
 * whatever this returns and knows nothing of its shape. Called once, when the
 * lead is queued — the stored body is what every attempt sends.
 */
export type BuildWebhookBody = (lead: Lead, ctx: LeadWebhookContext) => unknown;

/** What the brand's booking body builder is told besides the request. */
export interface BookingWebhookContext {
  brandId: string;
  /** When the site took the request. */
  at: Date;
  /** Fresh per request and stored with the body, like a lead's. */
  idempotencyKey: string;
}

/**
 * `booking.requested@1`'s body, built by the brand like `BuildWebhookBody`:
 * `bookingRequestedProperties(request)` writes the properties as the panel
 * reads them, and `request.leadRef` is the lead id the brand's
 * `lead.created` must have carried for the two to join.
 */
export type BuildBookingBody = (request: BookingRequest, ctx: BookingWebhookContext) => unknown;

/** Why `requestBooking` queued nothing. */
export type BookingQueued = { kind: "queued"; row: number } | { kind: "off" } | { kind: "duplicate" };

export interface LeadWebhook {
  /** Builds, serialises and queues the lead's body; returns the outbox row. */
  enqueue(lead: Lead, id: number, meta: { locale: string; formId: string; leadRef?: string }): number;
  tick(): Promise<TickReport>;
  start(intervalMs?: number): void;
  stop(): void;
  close(): void;
  /** The outbox's `requeueDead`: this target's dead rows back in the queue. */
  requeueDead(): number;
  /** Whether a suspect lead is queued, marked (`LeadWebhookOptions.panelSuspect`). */
  readonly panelSuspect: boolean;
  /** Whether `ctx.flow` is filled in (`LeadWebhookOptions.panelFlow`). */
  readonly panelFlow: boolean;
  /** Whether `requestBooking` queues anything (`LeadWebhookOptions.panelBooking`). */
  readonly panelBooking?: boolean;
  /**
   * Queues `booking.requested@1` after the lead's `lead.created`, through the
   * same outbox — once per lead: a second request for the lead is a
   * `duplicate`, whatever it asks. `off` without `panelBooking` or a
   * `buildBookingBody`.
   */
  requestBooking?(request: BookingRequest): BookingQueued;
  readonly outbox: WebhookOutbox;
}

export interface LeadWebhookOptions extends WebhookOutboxOptions {
  /** Absent → the webhook is off, whatever the environment says. */
  buildBody?: BuildWebhookBody | undefined;
  signing: WebhookSigning;
  /**
   * The one switch for the panel's `suspect` marker. Off (the default) until
   * the panel's `lead.created` accepts the property — it refuses an unknown
   * one, and the outbox would park the lead: a rate-limited lead stays in the
   * table and `ctx.suspect` stays absent, as before. On: a rate-limited lead
   * is queued too, and every queued lead's `ctx.suspect` says why it is
   * suspect, for the brand's body to carry.
   */
  panelSuspect?: boolean;
  /**
   * The switch for the sale's properties (`ctx.flow`: `flow`, `quoted_cents`,
   * `pricing_valid_from`, `estimate_inputs`). Off (the default) until the
   * panel's `lead.created` accepts them — it refuses an unknown property, and
   * the outbox would park the lead. The leads table keeps them either way.
   */
  panelFlow?: boolean;
  /**
   * The switch for `booking.requested@1` (`requestBooking`). Off (the
   * default) until the panel accepts the event type — it refuses an unknown
   * one, and the outbox would park it. Off, a booking request is answered
   * and dropped; the lead is untouched either way.
   */
  panelBooking?: boolean;
  /** The body of `booking.requested@1`; absent → booking requests are dropped whatever `panelBooking` says. */
  buildBookingBody?: BuildBookingBody | undefined;
}

/**
 * The lead webhook, or `null` when it is off: no `LEAD_WEBHOOK_URL`, or no
 * body builder from the brand. Built at boot by the brand, like the notifier,
 * so a broken setting fails startup rather than a lead.
 */
export function leadWebhook(
  site: { brand: { id: string } },
  env: Pick<ServerEnv, "leadsDb" | "leadWebhook">,
  options: LeadWebhookOptions,
): LeadWebhook | null {
  const { buildBody, buildBookingBody, signing, panelSuspect = false, panelFlow = false, panelBooking = false, ...outboxOptions } = options;
  if (!env.leadWebhook || !buildBody) return null;
  if (env.leadsDb.kind !== "sqlite") throw new Error("LEAD_WEBHOOK_URL: the webhook outbox needs the sqlite lead store");
  const outbox = openWebhookOutbox(env.leadsDb.path, { ...env.leadWebhook, signing }, outboxOptions);
  const now = options.now ?? Date.now;
  return {
    outbox,
    panelSuspect,
    panelFlow,
    panelBooking,
    requestBooking(request) {
      if (!panelBooking || !buildBookingBody) return { kind: "off" };
      const ctx: BookingWebhookContext = { brandId: site.brand.id, at: new Date(now()), idempotencyKey: randomUUID() };
      const body = JSON.stringify(buildBookingBody(request, ctx));
      if (typeof body !== "string") throw new Error("buildBookingBody returned nothing JSON can carry");
      const row = outbox.enqueueOnce(body, `booking:${request.leadRef}`);
      return row === null ? { kind: "duplicate" } : { kind: "queued", row };
    },
    enqueue(lead, id, meta) {
      const suspect = panelSuspect ? suspectOf(lead) : undefined;
      const flow = panelFlow ? panelFlowOf(lead) : undefined;
      const ctx: LeadWebhookContext = {
        leadId: id,
        brandId: site.brand.id,
        ...meta,
        at: new Date(now()),
        idempotencyKey: randomUUID(),
        ...(suspect ? { suspect } : {}),
        ...(flow ? { flow } : {}),
      };
      const body = JSON.stringify(buildBody(lead, ctx));
      if (typeof body !== "string") throw new Error("buildWebhookBody returned nothing JSON can carry");
      return outbox.enqueue(body, `lead:${id}`);
    },
    tick: () => outbox.tick(),
    start: intervalMs => outbox.start(intervalMs),
    stop: () => outbox.stop(),
    close: () => outbox.close(),
    requeueDead: () => outbox.requeueDead(),
  };
}
