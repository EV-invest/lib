import "server-only";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { channelOf, LEAD_CHANNELS, LEAD_SCHEMA_VERSION, type Lead, type LeadPrice, type LeadStore, type SpamVerdict } from "../core/lead";
import { LEAD_FLOWS, type LeadFlow } from "../core/pricing/flow";

/**
 * The SQLite adapter of the `LeadStore` port: one file on the pod's volume.
 *
 * The table began as the Rust server's (`job`, `zip`, `mobile`, `at`); the
 * file on a prod volume is opened as it is and brought forward in place. The
 * columns keep their first names — renaming a column on a live volume buys
 * nothing — and map to the lead's `subject`, `locality` and `mobile`.
 */
export interface SqliteLeadStore extends LeadStore {
  findSubmission(submissionId: string): Promise<{ id: number; lead: Lead } | null>;
  /** The schema version the file is at after opening. */
  version(): number;
}

// `node:sqlite` is reached through `getBuiltinModule` rather than an import so
// the bundler never has to resolve a builtin it may not know yet; the type is
// the module's own.
function sqlite(): typeof import("node:sqlite") {
  const mod = process.getBuiltinModule("node:sqlite");
  if (!mod) throw new Error("node:sqlite is unavailable — Node ≥ 22.13 is required");
  return mod;
}

/** A column of a row SQLite handed back, checked rather than cast. */
function column(row: unknown, key: string): unknown {
  return typeof row === "object" && row !== null ? Reflect.get(row, key) : undefined;
}

function integer(row: unknown, key: string): number {
  const value = column(row, key);
  if (typeof value === "number" || typeof value === "bigint") return Number(value);
  throw new Error(`leads: expected an integer \`${key}\`, got ${typeof value}`);
}

/**
 * Each step takes the file from version `i` to `i + 1`. Append only: a step
 * that shipped is history, and a file anywhere may be at any of them.
 */
const STEPS: readonly ((db: DatabaseSync) => void)[] = [
  // 1 — the Rust server's table.
  db =>
    db.exec(`CREATE TABLE leads (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      job     TEXT NOT NULL,
      zip     TEXT NOT NULL,
      mobile  TEXT NOT NULL,
      at      TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
  // 2 — the point a lead came from. Nullable: every row written before points
  // existed has none, and inventing one would be a lie in the one table that matters.
  db => db.exec("ALTER TABLE leads ADD COLUMN location_id TEXT"),
  // 3 — suspected spam is kept, flagged, and never notified: a false positive
  // is a customer, and a reviewer can still find it here.
  db => db.exec("ALTER TABLE leads ADD COLUMN spam_verdict TEXT"),
  // 4 — the brand's extra fields, as a JSON object; `NULL` when there are none.
  db => db.exec("ALTER TABLE leads ADD COLUMN extras TEXT"),
  // 5 — how the lead was asked for (`form`, `callback`), and a callback's
  // consent: when the server accepted it and the sentence shown. Nullable: a
  // row from before is a form lead, and a form lead has no consent to keep.
  db => {
    db.exec("ALTER TABLE leads ADD COLUMN channel TEXT");
    db.exec("ALTER TABLE leads ADD COLUMN consent_at TEXT");
    db.exec("ALTER TABLE leads ADD COLUMN consent_text TEXT");
  },
  // 6 — the script's id for a submission, so a resend after a lost answer is
  // the same row. Unique where present; a plain post has none, and NULLs
  // never collide.
  db => {
    db.exec("ALTER TABLE leads ADD COLUMN submission_id TEXT");
    db.exec("CREATE UNIQUE INDEX leads_submission_id ON leads (submission_id) WHERE submission_id IS NOT NULL");
  },
  // 7 — how the need was sold (`quote`, `estimate`, `fixed`), and for the two
  // priced flows the server's price, the model's date and an estimate's
  // answers (JSON). Nullable: a row from before, a callback, a quote.
  db => {
    db.exec("ALTER TABLE leads ADD COLUMN flow TEXT");
    db.exec("ALTER TABLE leads ADD COLUMN quoted_cents INTEGER");
    db.exec("ALTER TABLE leads ADD COLUMN pricing_valid_from TEXT");
    db.exec("ALTER TABLE leads ADD COLUMN estimate_inputs TEXT");
  },
  // 8 — the reference a messenger lead's chat carries (`AQ-7K3F`), so the
  // operator finds the lead from the message. Nullable: a row from before, a
  // lead from a card without a reference.
  db => db.exec("ALTER TABLE leads ADD COLUMN message_ref TEXT"),
];

if (STEPS.length !== LEAD_SCHEMA_VERSION) {
  // The version belongs to the port, shared by every adapter; this table of
  // steps must end exactly there.
  throw new Error(`leads: ${STEPS.length} sqlite steps for schema version ${LEAD_SCHEMA_VERSION}`);
}

const RUST_COLUMNS = ["id", "job", "zip", "mobile", "at"];

function str(row: unknown, key: string): string | null {
  const value = column(row, key);
  return typeof value === "string" ? value : null;
}

const VERDICTS: readonly string[] = ["honeypot", "too-fast", "rate-limited"] satisfies SpamVerdict[];

/** A JSON object of strings, or `{}`: what `extras` and `estimate_inputs` hold. */
function strings(text: string | null): Record<string, string> {
  const value: unknown = JSON.parse(text ?? "{}");
  return Object.fromEntries(Object.entries(typeof value === "object" && value !== null ? value : {}).filter((e): e is [string, string] => typeof e[1] === "string"));
}

function priceOf(row: unknown): LeadPrice | null {
  const cents = column(row, "quoted_cents");
  const validFrom = str(row, "pricing_valid_from");
  if ((typeof cents !== "number" && typeof cents !== "bigint") || validFrom === null) return null;
  const inputs = str(row, "estimate_inputs");
  return { cents: Number(cents), validFrom, ...(inputs !== null ? { inputs: strings(inputs) } : {}) };
}

/** A stored row read back as the lead it was written from. */
function leadOf(row: unknown): Lead {
  const verdict = str(row, "spam_verdict");
  const consentAt = str(row, "consent_at");
  const submissionId = str(row, "submission_id");
  const flow = LEAD_FLOWS.find(f => f === str(row, "flow")) satisfies LeadFlow | undefined;
  const price = priceOf(row);
  const messageRef = str(row, "message_ref");
  return {
    subject: str(row, "job") ?? "",
    locality: str(row, "zip") ?? "",
    mobile: str(row, "mobile") ?? "",
    extras: strings(str(row, "extras")),
    placeSlug: str(row, "location_id"),
    spamVerdict: verdict !== null && VERDICTS.includes(verdict) ? (verdict as SpamVerdict) : null,
    channel: LEAD_CHANNELS.find(c => c === str(row, "channel")) ?? "form",
    ...(consentAt !== null ? { consent: { at: consentAt, text: str(row, "consent_text") ?? "" } } : {}),
    ...(submissionId !== null ? { submissionId } : {}),
    ...(flow !== undefined ? { flow } : {}),
    ...(price !== null ? { price } : {}),
    ...(messageRef !== null ? { messageRef } : {}),
  };
}

function userVersion(db: DatabaseSync): number {
  return integer(db.prepare("PRAGMA user_version").get(), "user_version");
}

/**
 * Step 0, for a file no versioned store has opened (`user_version` 0): which
 * step it already stands at, read off the columns. The Rust server and the
 * first Node port both left an unversioned table; the port added its columns
 * one at a time, so a file may stop at any of them.
 */
function recognise(db: DatabaseSync): number {
  const columns = db.prepare("PRAGMA table_info(leads)").all().map(row => column(row, "name"));
  if (columns.length === 0) return 0;
  if (!RUST_COLUMNS.every(c => columns.includes(c))) {
    throw new Error(`leads: an unrecognised table (${columns.join(", ")}); refusing to migrate it`);
  }
  let at = 1;
  for (const [step, added] of [[2, "location_id"], [3, "spam_verdict"], [4, "extras"], [5, "consent_text"]] as const) {
    if (!columns.includes(added)) break;
    at = step;
  }
  return at;
}

/** Runs `fn` under a write lock; two pods opening one file take turns. */
function immediate(db: DatabaseSync, fn: () => void): void {
  db.exec("BEGIN IMMEDIATE");
  try {
    fn();
    db.exec("COMMIT");
  } catch (error) {
    // SQLite may already have rolled back (a failed COMMIT, an I/O error), and
    // then ROLLBACK throws too. The first error says what went wrong; this one
    // would only hide it. `db.isTransaction` is not in every Node ≥ 22.13.
    try {
      db.exec("ROLLBACK");
    } catch {
      // Nothing left to roll back.
    }
    throw error;
  }
}

function migrate(db: DatabaseSync): void {
  immediate(db, () => {
    if (userVersion(db) === 0) db.exec(`PRAGMA user_version = ${recognise(db)}`);
  });
  for (let target = 1; target <= STEPS.length; target++) {
    immediate(db, () => {
      // Read again under the lock: another process may have run this step.
      if (userVersion(db) >= target) return;
      STEPS[target - 1]?.(db);
      db.exec(`PRAGMA user_version = ${target}`);
    });
  }
}

/**
 * Opens (and migrates) the file synchronously, so a broken volume fails boot
 * (see `checkLeadStore`); the port's methods are async only by contract —
 * `node:sqlite` answers in-process, and an `async` body turns its throw into
 * the rejection the funnel expects.
 */
export function openSqliteLeadStore(path: string): SqliteLeadStore {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new (sqlite().DatabaseSync)(path);
  try {
    // The wait first: switching to WAL takes a lock another pod may hold.
    db.exec("PRAGMA busy_timeout = 5000");
    db.exec("PRAGMA journal_mode = WAL");
    migrate(db);
  } catch (error) {
    // A refused file must not stay open behind the error: the handle would
    // hold its WAL and leak on every retry.
    db.close();
    throw error;
  }
  const insert = db.prepare(
    "INSERT INTO leads (job, zip, mobile, location_id, spam_verdict, extras, channel, consent_at, consent_text, submission_id, flow, quoted_cents, pricing_valid_from, estimate_inputs, message_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
  );
  const bySubmission = db.prepare(
    "SELECT id, job, zip, mobile, location_id, spam_verdict, extras, channel, consent_at, consent_text, submission_id, flow, quoted_cents, pricing_valid_from, estimate_inputs, message_ref FROM leads WHERE submission_id = ?",
  );
  const count = db.prepare("SELECT COUNT(*) AS n FROM leads");
  return {
    async insert(lead) {
      const extras = Object.keys(lead.extras).length > 0 ? JSON.stringify(lead.extras) : null;
      return integer(
        insert.get(
          lead.subject,
          lead.locality,
          lead.mobile,
          lead.placeSlug,
          lead.spamVerdict,
          extras,
          channelOf(lead),
          lead.consent?.at ?? null,
          lead.consent?.text ?? null,
          lead.submissionId ?? null,
          lead.flow ?? null,
          lead.price?.cents ?? null,
          lead.price?.validFrom ?? null,
          lead.price?.inputs ? JSON.stringify(lead.price.inputs) : null,
          lead.messageRef ?? null,
        ),
        "id",
      );
    },
    async findSubmission(submissionId) {
      const row = bySubmission.get(submissionId);
      return row === undefined ? null : { id: integer(row, "id"), lead: leadOf(row) };
    },
    async count() {
      return integer(count.get(), "n");
    },
    version() {
      return userVersion(db);
    },
    async schemaVersion() {
      return userVersion(db);
    },
    async health() {
      // A read through the handle the funnel writes with: a volume that
      // vanished or a file locked for good answers here, not on a lead.
      integer(count.get(), "n");
    },
    async close() {
      db.close();
    },
  };
}
