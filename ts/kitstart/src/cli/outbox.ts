// kitstart-outbox — the webhook outbox from a shell, on the leads file itself.
// Plain node and its builtins only, like every bin here: the server layer
// imports `server-only`, which throws outside Next, so the two statements
// below repeat what `requeueDead()` and `rows()` do in
// `server/webhook-outbox.ts`; a test runs both on one file.
import { existsSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";

export const USAGE = `kitstart-outbox <status | requeue> [--db <leads.db>]

  status    rows of webhook_outbox by state and target
  requeue   every dead row back to pending, due now, its tries and horizon fresh

The file is --db, else LEADS_DB_URL (sqlite:///<path>), else LEADS_DB_PATH.`;

type Env = Readonly<Record<string, string | undefined>>;

function leadsFile(args: readonly string[], env: Env): string | null {
  const at = args.indexOf("--db");
  if (at !== -1) return args[at + 1] ?? null;
  const url = env["LEADS_DB_URL"]?.trim();
  if (url) {
    const parsed = new URL(url);
    if (parsed.protocol !== "sqlite:" || parsed.host !== "") throw new Error("LEADS_DB_URL is not sqlite:///<absolute path>");
    return decodeURIComponent(parsed.pathname);
  }
  return env["LEADS_DB_PATH"]?.trim() || null;
}

function open(path: string): DatabaseSync {
  const sqlite = process.getBuiltinModule("node:sqlite");
  if (!sqlite) throw new Error("node:sqlite is unavailable — Node ≥ 22.13 is required");
  const db = new sqlite.DatabaseSync(path);
  db.exec("PRAGMA busy_timeout = 5000");
  return db;
}

/** Runs the command; answers the exit code. `print` takes each line of output. */
export function runOutboxCli(args: readonly string[], env: Env, print: (line: string) => void, now = Date.now()): number {
  const [command] = args;
  if (command !== "status" && command !== "requeue") {
    print(USAGE);
    return 2;
  }
  const path = leadsFile(args, env);
  if (!path) {
    print(`no leads file: pass --db, or set LEADS_DB_URL or LEADS_DB_PATH\n\n${USAGE}`);
    return 2;
  }
  // Opening a path that is not there would create an empty file there.
  if (!existsSync(path)) {
    print(`no leads file at ${path}`);
    return 2;
  }
  const db = open(path);
  try {
    if (command === "requeue") {
      const done = db
        .prepare("UPDATE webhook_outbox SET state = 'pending', attempts = 0, created_at = ?, next_attempt_at = ?, done_at = NULL WHERE state = 'dead'")
        .run(now, now);
      print(`requeued ${Number(done.changes)} dead row(s); the running site sends them on its next tick`);
      return 0;
    }
    const rows = db.prepare("SELECT state, target, COUNT(*) AS n FROM webhook_outbox GROUP BY state, target ORDER BY state, target").all();
    if (rows.length === 0) print("the outbox is empty");
    for (const row of rows) print(`${String(Reflect.get(row, "state")).padEnd(10)}${String(Reflect.get(row, "n")).padStart(6)}  ${String(Reflect.get(row, "target"))}`);
    return 0;
  } finally {
    db.close();
  }
}
