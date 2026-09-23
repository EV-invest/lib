import type { SpamVerdict } from "./lead";

/**
 * Three cheap barriers, none of which needs the visitor to run a script — the
 * form has to work before any JavaScript arrives, so a challenge widget is not
 * an option. A rejected submission is answered exactly like an accepted one,
 * so a bot learns nothing from the response.
 */

/**
 * The field a human never sees and a form-filling bot fills. A neutral name:
 * a browser's autofill knows `website`, `url` or `company` and would fill the
 * trap for a real person.
 */
export const HONEYPOT_FIELD = "hp_ref";
/** The trap's name on pages cached before it was renamed; still read. */
export const LEGACY_HONEYPOT_FIELDS: readonly string[] = ["website"];
/** When the form was rendered, in ms since the epoch. */
export const RENDERED_AT_FIELD = "t";

/** Faster than this from render to submit is a script, not a person. */
export const MIN_FILL_MS = 3_000;
/** A render time this far ahead of the clock was forged. */
const MAX_SKEW_MS = 60_000;

export type Screening = "ok" | SpamVerdict;

export function checkTiming(renderedAt: string | null, now: number): Screening {
  const t = renderedAt === null || renderedAt.trim() === "" ? Number.NaN : Number(renderedAt);
  if (!Number.isFinite(t) || t - now > MAX_SKEW_MS) return "too-fast";
  return now - t < MIN_FILL_MS ? "too-fast" : "ok";
}

/** How many distinct keys a limiter tracks before new ones share one bucket. */
export const RATE_LIMIT_MAX_KEYS = 10_000;
/** The shared bucket keys past the cap count against. */
export const RATE_LIMIT_OVERFLOW_KEY = "\u0000overflow";
const PRUNE_EVERY_MS = 1_000;

/**
 * A fixed-window counter per client address, in memory. Per process by design:
 * it is a speed bump for one bot hammering one pod, not an accounting system,
 * and a restart forgetting it costs nothing.
 *
 * Bounded: past `maxKeys` distinct addresses in one window, new ones count
 * against one shared bucket — a flood of forged addresses throttles itself
 * instead of growing the map. Expired windows are swept at most once a second.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { start: number; count: number }>();
  private lastPrune = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys: number = RATE_LIMIT_MAX_KEYS,
  ) {}

  /** `true` if this hit is allowed. */
  hit(key: string, now: number): boolean {
    this.prune(now);
    const bucket = this.hits.has(key) || this.hits.size < this.maxKeys ? key : RATE_LIMIT_OVERFLOW_KEY;
    const entry = this.hits.get(bucket);
    if (!entry || now - entry.start >= this.windowMs) {
      this.hits.set(bucket, { start: now, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }

  /** Distinct buckets held now, for tests and diagnostics. */
  get size(): number {
    return this.hits.size;
  }

  private prune(now: number): void {
    if (now - this.lastPrune < PRUNE_EVERY_MS) return;
    this.lastPrune = now;
    for (const [key, entry] of this.hits) {
      if (now - entry.start >= this.windowMs) this.hits.delete(key);
    }
  }
}

/**
 * The barriers in their order. Every submission past the honeypot spends the
 * limiter — a script that omits the render stamp must not get unlimited
 * `too-fast` rows — and the verdict ranks the server's own evidence first:
 * honeypot, then rate-limited, then the client's stamp (too-fast).
 */
export function screen(input: {
  honeypot: string | null;
  renderedAt: string | null;
  clientKey: string;
  now: number;
  limiter: RateLimiter;
}): Screening {
  if (input.honeypot !== null && input.honeypot.trim() !== "") return "honeypot";
  if (!input.limiter.hit(input.clientKey, input.now)) return "rate-limited";
  return checkTiming(input.renderedAt, input.now);
}
