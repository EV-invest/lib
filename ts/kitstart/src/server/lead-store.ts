import "server-only";
import type { LeadStore } from "../core/lead";
import { openPostgresLeadStore } from "./lead-store-postgres";
import { openSqliteLeadStore } from "./lead-store-sqlite";

/**
 * Where leads are kept, chosen by the scheme of `LEADS_DB_URL`:
 *
 * - `sqlite:///data/leads.db` — a file on the pod's volume;
 * - `postgres://…` / `postgresql://…` — the Postgres adapter (a stub today,
 *   which refuses at boot).
 */
export type LeadDb = { kind: "sqlite"; path: string } | { kind: "postgres"; url: string };

const POSTGRES = new Set(["postgres:", "postgresql:"]);

export function parseLeadDb(value: string): LeadDb {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`LEADS_DB_URL is not a URL: ${JSON.stringify(value)}`);
  }
  if (url.protocol === "sqlite:") {
    // `sqlite://data/leads.db` parses `data` as a host and would put the file
    // at `/leads.db`; a query or fragment would be dropped just as quietly.
    if (url.host !== "" || url.search !== "" || url.hash !== "") {
      throw new Error(
        `LEADS_DB_URL: a sqlite URL is sqlite:///<absolute path> with no host, query or fragment, got ${JSON.stringify(value)}`,
      );
    }
    const path = decodeURIComponent(url.pathname);
    if (!path.startsWith("/")) throw new Error(`LEADS_DB_URL: a sqlite path must be absolute, got ${JSON.stringify(value)}`);
    return { kind: "sqlite", path };
  }
  if (POSTGRES.has(url.protocol)) return { kind: "postgres", url: value };
  throw new Error(`LEADS_DB_URL: unsupported scheme ${url.protocol}`);
}

/** Where a `LeadDb` points, for a log line: never a password. */
export function describeLeadDb(db: LeadDb): string {
  if (db.kind === "sqlite") return `sqlite at ${db.path}`;
  const url = new URL(db.url);
  return `postgres at ${url.host}${url.pathname}`;
}

export function openLeadStore(db: LeadDb): LeadStore {
  switch (db.kind) {
    case "sqlite":
      return openSqliteLeadStore(db.path);
    case "postgres":
      return openPostgresLeadStore(db.url);
  }
}
