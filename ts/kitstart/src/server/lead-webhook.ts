import "server-only";
import { randomUUID } from "node:crypto";
import type { BookingRequest } from "../core/booking/model";
import { channelOf, suspectOf, type Lead, type LeadChannel, type LeadSuspect } from "../core/lead";
import type { LeadFlow } from "../core/pricing/flow";
import type { ServerEnv } from "./env";
import { experimentsDeclaredBody, type DeclareOutcome, type ExperimentsDeclaration } from "./experiments-declared";
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
  /**
   * The visitor's analytics id as the page posted it (`ANALYTICS_ID_FIELD`),
   * for `lead.created`'s `analytics_id` — so PostHog joins the lead to the
   * visit. Absent from a page without the script, an older page, or one
   * without analytics. Write it only once the panel's contract has the
   * property: it refuses an unknown one, and the outbox would park the lead.
   */
  analyticsId?: string;
  /**
   * The lead's channel as the panel's `properties.channel` takes it
   * (`panelChannel`): `whatsapp` and `telegram` only under `panelMessenger`,
   * `form` otherwise. Absent only on a context built by hand.
   */
  channel?: PanelChannel;
  /**
   * The reference the visitor's chat carries (`Lead.messageRef`), for the
   * panel's `properties.message_ref` — only under `panelMessenger`, and only
   * on a lead that has one; otherwise absent, and the body must not carry it.
   */
  messageRef?: string;
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

/** A channel a site sends the panel; `phone_inbound` is the panel's own, for the calls it records. */
export type PanelChannel = "form" | "callback" | "whatsapp" | "telegram";

/**
 * A lead's channel as the Service-Arb panel's `lead.created` carries it in
 * `properties.channel` — a closed set that refuses the whole event outside
 * it, so the outbox would park the lead. `messenger`: whether the panel takes
 * `whatsapp` and `telegram` (`LeadWebhookOptions.panelMessenger`); until it
 * does, a messenger lead is a `form` there — the leads table keeps the truth.
 * `ctx.channel` is this, already decided.
 */
export function panelChannel(channel: LeadChannel, messenger = false): PanelChannel {
  if (channel === "whatsapp" || channel === "telegram") return messenger ? channel : "form";
  return channel;
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
export type BookingQueued = { kind: "queued"; row: number } | { kind: "off" } | { kind: "duplicate" } | { kind: "unqueued" };

export interface LeadWebhook {
  /** Builds, serialises and queues the lead's body; returns the outbox row. */
  enqueue(lead: Lead, id: number, meta: { locale: string; formId: string; leadRef?: string; analyticsId?: string }): number;
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
  /** Whether `ctx.channel` says `whatsapp` / `telegram` and `ctx.messageRef` is filled in (`LeadWebhookOptions.panelMessenger`). */
  readonly panelMessenger?: boolean;
  /**
   * Queues `booking.requested@1` behind the lead's `lead.created`, through
   * the same outbox: not sent until that row is delivered, and a `409` / `425`
   * for it retried. Once per lead: a second request is a `duplicate`,
   * whatever it asks. `unqueued` when the lead's own row was never queued (a
   * suspect held back); `off` without `panelBooking` or a `buildBookingBody`.
   */
  requestBooking?(request: BookingRequest): BookingQueued;
  /**
   * Queues `experiments.declared@1` — the experiments this build runs — in
   * the same outbox, signed as a lead is. Experiments the panel would refuse
   * are left out and listed in `skipped`. `declareExperiments` is the safe
   * wrapper for a start.
   */
  declareExperiments?(experiments: ExperimentsDeclaration, summaries?: Readonly<Record<string, string>>): DeclareOutcome;
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
  /**
   * The switch for the messenger channels: `ctx.channel` says `whatsapp` or
   * `telegram`, and `ctx.messageRef` carries the lead's reference. Off (the
   * default) until the panel's `lead.created` accepts them — it refuses an
   * unknown channel or property, and the outbox would park the lead: a
   * messenger lead goes as a `form`, without its reference.
   */
  panelMessenger?: boolean;
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
  const { buildBody, buildBookingBody, signing, panelSuspect = false, panelFlow = false, panelBooking = false, panelMessenger = false, ...outboxOptions } = options;
  if (!env.leadWebhook || !buildBody) return null;
  if (env.leadsDb.kind !== "sqlite") throw new Error("LEAD_WEBHOOK_URL: the webhook outbox needs the sqlite lead store");
  const outbox = openWebhookOutbox(env.leadsDb.path, { ...env.leadWebhook, signing }, outboxOptions);
  const now = options.now ?? Date.now;
  const sourceId = env.leadWebhook.keyId;
  return {
    outbox,
    panelSuspect,
    panelFlow,
    panelBooking,
    panelMessenger,
    requestBooking(request) {
      if (!panelBooking || !buildBookingBody) return { kind: "off" };
      // The lead's own row, as `enqueue` refs it: the booking follows it, and
      // a lead never queued (held back as suspect) is never booked to the panel.
      const lead = `lead:${/^lead-(\d+)-/.exec(request.leadRef)?.[1] ?? ""}`;
      if (!outbox.hasRef(lead)) return { kind: "unqueued" };
      const ctx: BookingWebhookContext = { brandId: site.brand.id, at: new Date(now()), idempotencyKey: randomUUID() };
      const body = JSON.stringify(buildBookingBody(request, ctx));
      if (typeof body !== "string") throw new Error("buildBookingBody returned nothing JSON can carry");
      const row = outbox.enqueueOnce(body, `booking:${request.leadRef}`, lead);
      return row === null ? { kind: "duplicate" } : { kind: "queued", row };
    },
    declareExperiments(experiments, summaries) {
      const { body, skipped } = experimentsDeclaredBody(experiments, { brandId: site.brand.id, sourceId, at: new Date(now()), ...(summaries ? { summaries } : {}) });
      const row = outbox.enqueue(JSON.stringify(body), `experiments:${body.events[0].id}`);
      return { kind: "queued", row, skipped };
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
        channel: panelChannel(channelOf(lead), panelMessenger),
        ...(panelMessenger && lead.messageRef ? { messageRef: lead.messageRef } : {}),
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
