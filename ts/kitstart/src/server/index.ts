/**
 * `@evinvest/kitstart/server` — Node-only, and marked so: every module here
 * imports `server-only`, so reaching one from a client component fails the
 * build instead of shipping SMTP credentials to a browser.
 */
import "server-only";

export { createServerEnv, parseServerEnv, type EnvSource, type ServerEnv } from "./env";
export { createPlaceSource, PLACE_REVALIDATE_SECONDS, PlaceSourceError, type PlaceSource, type PlaceSourceOptions } from "./place-source";
export {
  createExperimentsSource,
  EXPERIMENTS_TTL_MS,
  parseExperimentOverrides,
  type ExperimentOverride,
  type ExperimentOverrides,
  type ExperimentsSource,
  type ExperimentsSourceOptions,
} from "./experiments-source";
export {
  declarationProblem,
  declareExperiments,
  experimentsDeclaredBody,
  type DeclarationContext,
  type DeclaredExperiment,
  type DeclareOptions,
  type DeclareOutcome,
  type ExperimentDeclarationV1,
  type ExperimentsDeclaration,
  type ExperimentsDeclaredEvent,
} from "./experiments-declared";
export { createPricingSource, type PricingSource, type PricingSourceOptions } from "./pricing-source";
export { describeLeadDb, openLeadStore, parseLeadDb, type LeadDb } from "./lead-store";
export { openSqliteLeadStore, type SqliteLeadStore } from "./lead-store-sqlite";
export { LeadStoreNotImplemented, openPostgresLeadStore } from "./lead-store-postgres";
export { parseSmtpUrl, sendMail, type Mail, type SendOptions } from "./smtp";
export { defaultLeadMail, leadNotifier, MAIL_PER_MINUTE, type LeadMail, type LeadMailShown, type LeadNotifier, type NeedLabel, type NotifyEnv } from "./notify";
export { clientKey, NO_CLIENT_ADDRESS, parseProxyTrust, type ProxyTrust } from "./client-key";
export { checkLeadStore } from "./boot";
export {
  leadWebhook,
  panelChannel,
  panelFlowOf,
  panelFlowProperties,
  type BookingQueued,
  type BookingWebhookContext,
  type BuildBookingBody,
  type BuildWebhookBody,
  type LeadWebhook,
  type LeadWebhookContext,
  type LeadWebhookOptions,
  type PanelChannel,
  type PanelFlow,
  type PanelFlowProperties,
} from "./lead-webhook";
export {
  checkWebhookUrl,
  openWebhookOutbox,
  WEBHOOK_HORIZON_MS,
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_MAX_DELAY_MS,
  WEBHOOK_TICK_MS,
  type DeadRow,
  type OutboxRow,
  type OutboxState,
  type TickReport,
  type WebhookOutbox,
  type WebhookOutboxOptions,
  type WebhookTarget,
} from "./webhook-outbox";
export { signatureHeaders, signWebhook, type WebhookSignatureHeaders, type WebhookSigning } from "./webhook-signature";
