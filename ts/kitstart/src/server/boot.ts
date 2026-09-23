import "server-only";
import type { ServerEnv } from "./env";
import { describeLeadDb, openLeadStore } from "./lead-store";

/**
 * Opens the store once at boot — the brand's `instrumentation.ts` calls this —
 * and closes it again. A missing volume, a `leads` table the migrations refuse
 * or an adapter that does not exist then fails startup, and the pod never
 * turns ready, instead of the first customer's submission failing. Says which
 * store and where, because `LEADS_DB_URL` outranks `LEADS_DB_PATH` and the
 * log is the one place that shows which won.
 */
export async function checkLeadStore(
  env: Pick<ServerEnv, "leadsDb" | "leadsDbFrom">,
  log: Pick<Console, "info"> = console,
): Promise<void> {
  const store = openLeadStore(env.leadsDb);
  try {
    await store.health();
    log.info(`leads: ${describeLeadDb(env.leadsDb)}, schema v${await store.schemaVersion()} (from ${env.leadsDbFrom})`);
  } finally {
    await store.close();
  }
}
