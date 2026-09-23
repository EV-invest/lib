import type { SpamVerdict } from "./lead";

/**
 * Three cheap barriers, none of which needs the visitor to run a script — the
 * form has to work before any JavaScript arrives, so a challenge widget is not
 * an option. A rejected submission is answered exactly like an accepted one,
 * so a bot learns nothing from the response.
 */

/** The field a human never sees and a form-filling bot fills. */
export const HONEYPOT_FIELD = "website";
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

/**
 * A fixed-window counter per client address, in memory. Per process by design:
 * it is a speed bump for one bot hammering one pod, not an accounting system,
 * and a restart forgetting it costs nothing.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** `true` if this hit is allowed. */
  hit(key: string, now: number): boolean {
    this.prune(now);
    const entry = this.hits.get(key);
    if (!entry || now - entry.start >= this.windowMs) {
      this.hits.set(key, { start: now, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }

  private prune(now: number): void {
    // Linear in the live keys, which is fine at a landing page's volume, and it
    // keeps the map from outgrowing one window of distinct addresses.
    for (const [key, entry] of this.hits) {
      if (now - entry.start >= this.windowMs) this.hits.delete(key);
    }
  }
}

export function screen(input: {
  honeypot: string | null;
  renderedAt: string | null;
  clientKey: string;
  now: number;
  limiter: RateLimiter;
}): Screening {
  if (input.honeypot !== null && input.honeypot.trim() !== "") return "honeypot";
  const timing = checkTiming(input.renderedAt, input.now);
  if (timing !== "ok") return timing;
  return input.limiter.hit(input.clientKey, input.now) ? "ok" : "rate-limited";
}
