import "server-only";
import type { LeadStore } from "../core/lead";

/**
 * The Postgres adapter of the `LeadStore` port — not written yet. It is
 * recognised so that `LEADS_DB_URL=postgres://…` fails at boot, loudly, instead
 * of a deployment that asked for Postgres writing leads somewhere nobody
 * looks. When it lands: the driver is an optional peer, the table mirrors the
 * SQLite columns, the schema version follows `LEAD_SCHEMA_VERSION`, and it
 * must pass `describeLeadStoreContract` before `openLeadStore` may return it.
 */
export class LeadStoreNotImplemented extends Error {
  override readonly name = "LeadStoreNotImplemented";
}

export function openPostgresLeadStore(url: string): LeadStore {
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "?";
    }
  })();
  throw new LeadStoreNotImplemented(
    `LEADS_DB_URL names postgres (${host}), whose lead store adapter is not implemented yet; use sqlite:///<path>`,
  );
}
