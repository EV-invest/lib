import "server-only";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { signatureHeaders, type WebhookSigning } from "./webhook-signature";

/**
 * A durable queue of signed POSTs, kept in the leads file so a body is on disk
 * before the visitor is thanked and survives a restart of the pod. Delivery is
 * at-least-once: a row leaves `pending` only on the receiver's answer, and a
 * crash between the answer and the update sends it again — the receiver
 * deduplicates by whatever id the body carries.
 *
 * Bodies hold PII; they go out in the request and nowhere else. Logs name the
 * row, the attempt and the status — never the body, and never the receiver's
 * words, which may echo it: those stay in the row's `last_error`, beside the
 * body they describe.
 */
export interface WebhookTarget {
  url: string;
  keyId: string;
  secret: string;
  signing: WebhookSigning;
}

/** What `onDead` is told of a row given up on: its error as tagged (`HTTP 503`), never the receiver's words. */
export interface DeadRow {
  id: number;
  ref: string | null;
  attempts: number;
  error: string;
}

export interface WebhookOutboxOptions {
  /**
   * How long a row is retried, from when it was queued (or requeued); past it
   * a failure makes it `dead`. 48 hours by default: a receiver down over a
   * night and a day still gets its leads.
   */
  horizonMs?: number;
  /** A cap on tries per row besides the horizon, the first included; none by default. */
  maxAttempts?: number;
  /** The wait after the first failure; doubled after each next one. */
  baseDelayMs?: number;
  /** The longest wait between two tries: an hour by default. */
  maxDelayMs?: number;
  /** Told of every row given up on, after the error log — the alert hook. */
  onDead?: (row: DeadRow) => void;
  /** Per request, so a hung receiver does not hold the tick. */
  timeoutMs?: number;
  /** Rows sent per tick. */
  batch?: number;
  fetch?: typeof fetch;
  now?: () => number;
  /** In `[0, 1)`; spreads retries so a receiver back from an outage is not hit at once. */
  random?: () => number;
  log?: Pick<Console, "info" | "warn" | "error">;
}

export type OutboxState = "pending" | "delivered" | "dead";

export interface OutboxRow {
  id: number;
  ref: string | null;
  state: OutboxState;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
}

export interface TickReport {
  delivered: number;
  retried: number;
  dead: number;
}

export interface WebhookOutbox {
  /** Queues a body; synchronous and local, so it can sit before the response. */
  enqueue(body: string, ref?: string | null): number;
  /**
   * Queues a body unless a row with the same `ref` was ever queued, in one
   * statement — two pods racing on one ref queue it once. Answers the new
   * row, or `null` when the ref was there. With `after`, the row is not sent
   * until the row of that ref is delivered, and a `409` or `425` for it is
   * retried: the receiver has not seen what it depends on yet.
   */
  enqueueOnce?(body: string, ref: string, after?: string): number | null;
  /** Whether a row with this `ref` was ever queued, whatever its state. */
  hasRef?(ref: string): boolean;
  /** One pass over the rows that are due; concurrent calls share the running one. */
  tick(): Promise<TickReport>;
  /** Ticks every `intervalMs` until `stop`; a second call is a no-op. */
  start(intervalMs?: number): void;
  stop(): void;
  rows(): OutboxRow[];
  /**
   * Puts this target's `dead` rows back in the queue, due now, with their
   * tries and horizon fresh — after a key rotation or an outage longer than
   * the horizon. Answers how many. `kitstart-outbox requeue` does the same
   * from a shell.
   */
  requeueDead(): number;
  close(): void;
}

/** The old default cap on tries; kept for a brand that passes it as `maxAttempts`. The horizon decides now. */
export const WEBHOOK_MAX_ATTEMPTS = 12;
export const WEBHOOK_HORIZON_MS = 48 * 60 * 60_000;
export const WEBHOOK_MAX_DELAY_MS = 60 * 60_000;
export const WEBHOOK_TICK_MS = 10_000;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS webhook_outbox (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  target          TEXT    NOT NULL,
  ref             TEXT,
  body            TEXT    NOT NULL,
  created_at      INTEGER NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  state           TEXT    NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'delivered', 'dead')),
  last_error      TEXT,
  done_at         INTEGER
);
CREATE INDEX IF NOT EXISTS webhook_outbox_due ON webhook_outbox (state, target, next_attempt_at);
CREATE INDEX IF NOT EXISTS webhook_outbox_ref ON webhook_outbox (ref);
`;

/**
 * Added after the table shipped: a file from before gets it on open. A row's
 * `after_ref` holds it until the row of that ref is delivered.
 */
function addAfterRef(db: DatabaseSync): void {
  const columns = db.prepare("PRAGMA table_info(webhook_outbox)").all();
  if (!columns.some(c => column(c, "name") === "after_ref")) db.exec("ALTER TABLE webhook_outbox ADD COLUMN after_ref TEXT");
}

/** How much of a receiver's answer a row keeps. */
const ERROR_CAP = 500;

const IN_CLUSTER = /(^|\.)svc(\.cluster\.local)?$/;
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * `https:` anywhere; `http:` only where nothing but the cluster sees the
 * bytes — a Service's DNS name or loopback — since the body carries PII.
 * Throws without the value: a URL setting may carry credentials.
 */
export function checkWebhookUrl(value: string, name = "LEAD_WEBHOOK_URL"): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} is not a URL`);
  }
  if (url.protocol === "https:") return url.toString();
  if (url.protocol === "http:" && (IN_CLUSTER.test(url.hostname) || LOOPBACK.has(url.hostname))) return url.toString();
  throw new Error(`${name}: https, or http to a *.svc / *.svc.cluster.local host or localhost`);
}

function sqlite(): typeof import("node:sqlite") {
  const mod = process.getBuiltinModule("node:sqlite");
  if (!mod) throw new Error("node:sqlite is unavailable — Node ≥ 22.13 is required");
  return mod;
}

function column(row: unknown, key: string): unknown {
  return typeof row === "object" && row !== null ? Reflect.get(row, key) : undefined;
}

function int(row: unknown, key: string): number {
  const value = column(row, key);
  if (typeof value === "number" || typeof value === "bigint") return Number(value);
  throw new Error(`webhook_outbox: expected an integer \`${key}\`, got ${typeof value}`);
}

function text(row: unknown, key: string): string | null {
  const value = column(row, key);
  return typeof value === "string" ? value : null;
}

function state(row: unknown): OutboxState {
  const value = column(row, "state");
  if (value === "pending" || value === "delivered" || value === "dead") return value;
  throw new Error(`webhook_outbox: unknown state ${String(value)}`);
}

type Verdict =
  | { kind: "delivered"; note: string | null }
  /** `alarm`: retried, but a person should look — the key or the URL is likely wrong. */
  | { kind: "retry"; tag: string; why: string; afterMs: number | null; alarm?: string }
  | { kind: "dead"; tag: string; why: string };

/** `Retry-After` in seconds; the HTTP-date form is rare enough to ignore. */
function retryAfter(response: Response): number | null {
  const value = Number(response.headers.get("retry-after"));
  return Number.isFinite(value) && value > 0 ? value * 1000 : null;
}

/**
 * A `207` names a verdict per item of the batch. `rejected` is final — the
 * receiver refused the item for what it is, and sending it again changes
 * nothing — so the row is delivered, with the refusals noted; the other
 * statuses (`accepted`, `duplicate`) need no word.
 */
async function multiStatus(response: Response, rowId: number, log: Pick<Console, "warn">): Promise<Verdict> {
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    log.warn(`webhook: outbox #${rowId}: a 207 with an unreadable body; taken as delivered`);
    return { kind: "delivered", note: "207 with an unreadable body" };
  }
  const results = column(parsed, "results");
  if (!Array.isArray(results)) return { kind: "delivered", note: null };
  const rejected = results.filter(r => column(r, "status") === "rejected");
  if (rejected.length === 0) return { kind: "delivered", note: null };
  for (const r of rejected) {
    const index = column(r, "index");
    log.warn(`webhook: outbox #${rowId}: item ${typeof index === "number" ? index : "?"} rejected by the receiver; not retried (reason in the row)`);
  }
  const reasons = rejected.map(r => `#${String(column(r, "index"))}: ${String(column(r, "reason") ?? "rejected")}`);
  return { kind: "delivered", note: `rejected ${reasons.join("; ")}` };
}

async function judge(response: Response, rowId: number, log: Pick<Console, "warn">, dependent: boolean): Promise<Verdict> {
  const status = response.status;
  if (status === 207) return multiStatus(response, rowId, log);
  if (status >= 200 && status < 300) {
    await response.body?.cancel();
    return { kind: "delivered", note: null };
  }
  const said = (await response.text().catch(() => "")).slice(0, ERROR_CAP);
  const tag = `HTTP ${status}`;
  const why = said ? `${tag}: ${said}` : tag;
  if (status === 408 || status === 429 || status >= 500) return { kind: "retry", tag, why, afterMs: retryAfter(response) };
  // A row that follows another: the receiver may not have taken that one yet.
  if (dependent && (status === 409 || status === 425)) return { kind: "retry", tag, why, afterMs: retryAfter(response) };
  // A rotated key (401, 403) or a receiver moved or not yet deployed (404):
  // fixed by a person, after which the lead must still arrive.
  if (status === 401 || status === 403) return { kind: "retry", tag, why, afterMs: null, alarm: "check LEAD_WEBHOOK_KEY_ID / LEAD_WEBHOOK_SECRET against the receiver's key" };
  if (status === 404) return { kind: "retry", tag, why, afterMs: null, alarm: "check LEAD_WEBHOOK_URL" };
  // 3xx included: redirects are not followed, since the target was vetted and its Location was not.
  return { kind: "dead", tag, why };
}

/**
 * Opens (and creates) the outbox table in the SQLite file at `path` — the
 * leads file, through a connection of its own. Every row is bound to the
 * target URL it was queued for: after a change of `LEAD_WEBHOOK_URL` the old
 * rows stay, are counted at open, and are not sent to a receiver that never
 * agreed to take them.
 */
export function openWebhookOutbox(path: string, target: WebhookTarget, options: WebhookOutboxOptions = {}): WebhookOutbox & Required<Pick<WebhookOutbox, "enqueueOnce" | "hasRef">> {
  const horizon = options.horizonMs ?? WEBHOOK_HORIZON_MS;
  const maxAttempts = options.maxAttempts ?? Number.POSITIVE_INFINITY;
  const baseDelay = options.baseDelayMs ?? 5_000;
  const maxDelay = options.maxDelayMs ?? WEBHOOK_MAX_DELAY_MS;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const batch = options.batch ?? 20;
  const send = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const log = options.log ?? console;

  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db: DatabaseSync = new (sqlite().DatabaseSync)(path);
  try {
    db.exec("PRAGMA busy_timeout = 5000");
    db.exec("PRAGMA journal_mode = WAL");
    db.exec(SCHEMA);
    addAfterRef(db);
  } catch (error) {
    db.close();
    throw error;
  }

  const insert = db.prepare("INSERT INTO webhook_outbox (target, ref, body, created_at, next_attempt_at) VALUES (?, ?, ?, ?, ?) RETURNING id");
  const insertOnce = db.prepare(
    "INSERT INTO webhook_outbox (target, ref, body, created_at, next_attempt_at, after_ref) SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM webhook_outbox WHERE ref = ?) RETURNING id",
  );
  const byRef = db.prepare("SELECT 1 FROM webhook_outbox WHERE ref = ? LIMIT 1");
  // A row waits for the row it follows to be delivered; held, it is not due.
  const due = db.prepare(
    `SELECT id, ref, body, attempts, created_at, after_ref FROM webhook_outbox AS o WHERE state = 'pending' AND target = ? AND next_attempt_at <= ?
       AND (after_ref IS NULL OR EXISTS (SELECT 1 FROM webhook_outbox AS d WHERE d.ref = o.after_ref AND d.state = 'delivered'))
     ORDER BY next_attempt_at, id LIMIT ?`,
  );
  // A lease: another process ticking the same file skips a row while it is in flight.
  const claim = db.prepare("UPDATE webhook_outbox SET next_attempt_at = ? WHERE id = ? AND state = 'pending' AND next_attempt_at <= ?");
  const finish = db.prepare("UPDATE webhook_outbox SET state = ?, attempts = ?, last_error = ?, done_at = ? WHERE id = ?");
  const reschedule = db.prepare("UPDATE webhook_outbox SET attempts = ?, next_attempt_at = ?, last_error = ? WHERE id = ?");
  const list = db.prepare("SELECT id, ref, state, attempts, next_attempt_at, last_error FROM webhook_outbox ORDER BY id");
  const stranded = db.prepare("SELECT COUNT(*) AS n FROM webhook_outbox WHERE state = 'pending' AND target <> ?");
  // `created_at` restarts the horizon: a requeued row is queued anew.
  const requeue = db.prepare(
    "UPDATE webhook_outbox SET state = 'pending', attempts = 0, created_at = ?, next_attempt_at = ?, done_at = NULL WHERE state = 'dead' AND target = ?",
  );

  const left = int(stranded.get(target.url), "n");
  if (left > 0) log.warn(`webhook: ${left} pending row(s) queued for another target; left in place, not sent`);

  /** Doubling from `baseDelay`, capped, plus up to a fifth more at random. */
  function backoff(attempts: number, hinted: number | null): number {
    const plain = Math.min(maxDelay, baseDelay * 2 ** Math.max(0, attempts - 1));
    return Math.min(maxDelay, Math.max(plain + Math.floor(plain * 0.2 * random()), hinted ?? 0));
  }

  async function deliver(id: number, body: string, dependent: boolean): Promise<Verdict> {
    try {
      const response = await send(target.url, {
        method: "POST",
        headers: { "content-type": "application/json", ...signatureHeaders(target.signing, target, body, now()) },
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
      return await judge(response, id, log, dependent);
    } catch (error) {
      // The name and code only: a fetch error's message is safe, but its cause chain is the runtime's to word.
      const name = error instanceof Error ? error.name : "error";
      const code = column(error instanceof Error ? error.cause : undefined, "code");
      const tag = `network ${name}${typeof code === "string" ? ` ${code}` : ""}`;
      return { kind: "retry", tag, why: tag, afterMs: null };
    }
  }

  async function pass(): Promise<TickReport> {
    const report: TickReport = { delivered: 0, retried: 0, dead: 0 };
    const t = now();
    for (const row of due.all(target.url, t, batch)) {
      const id = int(row, "id");
      const body = text(row, "body") ?? "";
      const attempts = int(row, "attempts") + 1;
      const queuedAt = int(row, "created_at");
      if (Number(claim.run(t + timeoutMs + 5_000, id, t).changes) === 0) continue;
      const verdict = await deliver(id, body, text(row, "after_ref") !== null);
      if (verdict.kind === "delivered") {
        finish.run("delivered", attempts, verdict.note?.slice(0, ERROR_CAP) ?? null, now(), id);
        report.delivered += 1;
      } else if (verdict.kind === "dead" || attempts >= maxAttempts || now() - queuedAt >= horizon) {
        finish.run("dead", attempts, verdict.why, now(), id);
        log.error(`webhook: outbox #${id} dead after ${attempts} attempt(s): ${verdict.tag}; requeue with requeueDead() or \`kitstart-outbox requeue\``);
        report.dead += 1;
        try {
          options.onDead?.({ id, ref: text(row, "ref"), attempts, error: verdict.tag });
        } catch (error) {
          log.error("webhook: the onDead hook failed", error);
        }
      } else {
        const wait = backoff(attempts, verdict.afterMs);
        reschedule.run(attempts, now() + wait, verdict.why, id);
        const line = `webhook: outbox #${id} attempt ${attempts} failed (${verdict.tag}); next in ${Math.round(wait / 1000)} s`;
        if (verdict.alarm) log.error(`${line} — ${verdict.alarm}`);
        else log.warn(line);
        report.retried += 1;
      }
    }
    return report;
  }

  let running: Promise<TickReport> | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  const tick = (): Promise<TickReport> => {
    running ??= pass().finally(() => {
      running = null;
    });
    return running;
  };
  const stop = (): void => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  return {
    enqueue(body, ref = null) {
      const t = now();
      return int(insert.get(target.url, ref, body, t, t), "id");
    },
    enqueueOnce(body, ref, after) {
      const t = now();
      const row = insertOnce.get(target.url, ref, body, t, t, after ?? null, ref);
      return row === undefined ? null : int(row, "id");
    },
    hasRef(ref) {
      return byRef.get(ref) !== undefined;
    },
    tick,
    start(intervalMs = WEBHOOK_TICK_MS) {
      if (timer) return;
      const run = (): void => {
        tick().catch(error => log.error("webhook: an outbox tick failed", error));
      };
      timer = setInterval(run, intervalMs);
      // The queue must not keep a process alive that is otherwise done.
      timer.unref();
      run();
    },
    stop,
    rows() {
      return list.all().map(row => ({
        id: int(row, "id"),
        ref: text(row, "ref"),
        state: state(row),
        attempts: int(row, "attempts"),
        nextAttemptAt: int(row, "next_attempt_at"),
        lastError: text(row, "last_error"),
      }));
    },
    requeueDead() {
      const t = now();
      return Number(requeue.run(t, t, target.url).changes);
    },
    close() {
      stop();
      db.close();
    },
  };
}
