import "server-only";
import { randomUUID } from "node:crypto";
import { suspectOf, type Lead, type LeadChannel, type LeadSuspect } from "../core/lead";
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

export interface LeadWebhook {
  /** Builds, serialises and queues the lead's body; returns the outbox row. */
  enqueue(lead: Lead, id: number, meta: { locale: string; formId: string }): number;
  tick(): Promise<TickReport>;
  start(intervalMs?: number): void;
  stop(): void;
  close(): void;
  /** Whether a suspect lead is queued, marked (`LeadWebhookOptions.panelSuspect`). */
  readonly panelSuspect: boolean;
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
  const { buildBody, signing, panelSuspect = false, ...outboxOptions } = options;
  if (!env.leadWebhook || !buildBody) return null;
  if (env.leadsDb.kind !== "sqlite") throw new Error("LEAD_WEBHOOK_URL: the webhook outbox needs the sqlite lead store");
  const outbox = openWebhookOutbox(env.leadsDb.path, { ...env.leadWebhook, signing }, outboxOptions);
  const now = options.now ?? Date.now;
  return {
    outbox,
    panelSuspect,
    enqueue(lead, id, meta) {
      const suspect = panelSuspect ? suspectOf(lead) : undefined;
      const ctx: LeadWebhookContext = { leadId: id, brandId: site.brand.id, ...meta, at: new Date(now()), idempotencyKey: randomUUID(), ...(suspect ? { suspect } : {}) };
      const body = JSON.stringify(buildBody(lead, ctx));
      if (typeof body !== "string") throw new Error("buildWebhookBody returned nothing JSON can carry");
      return outbox.enqueue(body, `lead:${id}`);
    },
    tick: () => outbox.tick(),
    start: intervalMs => outbox.start(intervalMs),
    stop: () => outbox.stop(),
    close: () => outbox.close(),
  };
}
