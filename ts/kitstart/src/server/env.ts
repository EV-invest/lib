import "server-only";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseProxyTrust, type ProxyTrust } from "./client-key";
import { parseLeadDb, type LeadDb } from "./lead-store";

/**
 * The server's runtime configuration, parsed once. Secrets (`SMTP_URL`,
 * `SMS_TOKEN`, `POSTHOG_KEY`) arrive from the container environment, never
 * from the image.
 *
 * Production has no default for where state lives: a missing lead store
 * (`LEADS_DB_URL` or `LEADS_DB_PATH`) throws, and a brand that parses this in
 * `instrumentation.ts` gets a server that answers 500 everywhere — its
 * readiness probe included — rather than one that loses the first lead.
 */
export interface ServerEnv {
  production: boolean;
  /** Where leads are kept; see `LeadDb`. */
  leadsDb: LeadDb;
  /** Which setting chose it, for the boot log. */
  leadsDbFrom: "LEADS_DB_URL" | "LEADS_DB_PATH" | "default";
  /** Where the live place data comes from; absent → the baked config. */
  locationsApiUrl: string | null;
  smtpUrl: string | null;
  /** A bare address (`leads@brand.fr`), not `Name <…>`. */
  notifyTo: string | null;
  /** A bare address (`leads@brand.fr`), not `Name <…>`. */
  notifyFrom: string | null;
  /** Whose word the rate limit takes for the client's address; see `ProxyTrust`. */
  trustedProxy: ProxyTrust | null;
  smsToken: string | null;
  posthogKey: string | null;
  posthogHost: string;
}

export type EnvSource = Readonly<Record<string, string | undefined>>;

function opt(source: EnvSource, name: string): string | null {
  const value = source[name]?.trim();
  return value ? value : null;
}

function url(source: EnvSource, name: string): string | null {
  const value = opt(source, name);
  if (value === null) return null;
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    // Never the value: a URL setting may carry credentials.
    throw new Error(`${name} is not a URL`);
  }
}

/**
 * `LEADS_DB_URL` picks the adapter by scheme; `LEADS_DB_PATH`, the setting a
 * deployed image may already carry, is the SQLite file and stays valid. Both
 * set is the migration path (the image bakes the path, a Secret adds the URL):
 * the URL wins, and the boot log says so.
 */
function leadsDb(source: EnvSource, production: boolean, brandId: string): Pick<ServerEnv, "leadsDb" | "leadsDbFrom"> {
  const dbUrl = opt(source, "LEADS_DB_URL");
  if (dbUrl !== null) {
    const db = parseLeadDb(dbUrl);
    // Refused here, at boot, until the adapter exists — not on the first lead.
    if (db.kind === "postgres") throw new Error("LEADS_DB_URL: the postgres lead store is not implemented yet; use sqlite:///<path>");
    return { leadsDb: db, leadsDbFrom: "LEADS_DB_URL" };
  }
  const path = opt(source, "LEADS_DB_PATH");
  if (path !== null) return { leadsDb: { kind: "sqlite", path }, leadsDbFrom: "LEADS_DB_PATH" };
  if (production) {
    throw new Error("LEADS_DB_URL or LEADS_DB_PATH is required in production — the leads volume, e.g. /data/leads.db");
  }
  return { leadsDb: { kind: "sqlite", path: join(homedir(), ".local/share", brandId, "leads.db") }, leadsDbFrom: "default" };
}

export function parseServerEnv(site: { brand: { id: string } }, source: EnvSource): ServerEnv {
  const production = source["NODE_ENV"] === "production";
  const trust = opt(source, "TRUSTED_PROXY");
  if (trust === null && production) {
    throw new Error("TRUSTED_PROXY is required in production: cloudflare, or xff:<n> for n proxies of ours");
  }
  return {
    production,
    trustedProxy: trust === null ? null : parseProxyTrust(trust),
    ...leadsDb(source, production, site.brand.id),
    locationsApiUrl: url(source, "LOCATIONS_API_URL"),
    smtpUrl: opt(source, "SMTP_URL"),
    notifyTo: opt(source, "LEAD_NOTIFY_TO"),
    notifyFrom: opt(source, "LEAD_NOTIFY_FROM"),
    smsToken: opt(source, "SMS_TOKEN"),
    posthogKey: opt(source, "POSTHOG_KEY"),
    // Explicit because PostHog rejects a project's events at the other
    // region's host; the audience is European, so EU unless told otherwise.
    posthogHost: url(source, "POSTHOG_HOST") ?? "https://eu.i.posthog.com",
  };
}

/** Lazy and cached: `next build` imports the brand's env module and must not need prod secrets. */
export function createServerEnv(site: { brand: { id: string } }, source: EnvSource = process.env): () => ServerEnv {
  let cached: ServerEnv | undefined;
  return () => {
    cached ??= parseServerEnv(site, source);
    return cached;
  };
}
