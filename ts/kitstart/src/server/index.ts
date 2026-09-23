/**
 * `@evinvest/kitstart/server` — Node-only, and marked so: every module here
 * imports `server-only`, so reaching one from a client component fails the
 * build instead of shipping SMTP credentials to a browser.
 */
import "server-only";

export { createServerEnv, parseServerEnv, type EnvSource, type ServerEnv } from "./env";
export { createPlaceSource, PLACE_REVALIDATE_SECONDS, PlaceSourceError, type PlaceSource, type PlaceSourceOptions } from "./place-source";
export { describeLeadDb, openLeadStore, parseLeadDb, type LeadDb } from "./lead-store";
export { openSqliteLeadStore, type SqliteLeadStore } from "./lead-store-sqlite";
export { LeadStoreNotImplemented, openPostgresLeadStore } from "./lead-store-postgres";
export { parseSmtpUrl, sendMail, type Mail, type SendOptions } from "./smtp";
export { defaultLeadMail, leadNotifier, MAIL_PER_MINUTE, type LeadMail, type LeadNotifier, type NotifyEnv } from "./notify";
export { clientKey, NO_CLIENT_ADDRESS, parseProxyTrust, type ProxyTrust } from "./client-key";
export { checkLeadStore } from "./boot";
