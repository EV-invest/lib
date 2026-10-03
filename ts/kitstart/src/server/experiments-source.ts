import "server-only";

/**
 * An operator's override of one experiment, as the panel serves it — the
 * shape `applyOverrides` of `@evinvest/experiments` takes. Only the types are
 * checked here; whether a field fits the experiment in code (weights of the
 * right length, a holdout in `[0, 1)`) is `applyOverrides`' call, because only
 * it knows the code's variants.
 */
export interface ExperimentOverride {
  readonly enabled?: boolean;
  readonly weights?: readonly number[];
  readonly holdout?: number;
}

export type ExperimentOverrides = Readonly<Record<string, ExperimentOverride>>;

/**
 * The operator's overrides of the brand's experiments: `GET
 * <base>/experiments`, the panel's `{ "experiments": { "<key>": {…} } }`.
 *
 * Read by the proxy on every request, so the answer comes from memory: the
 * first call waits for the panel (bounded by `timeoutMs`), every later one is
 * served from the cache — past the TTL too, while one refresh runs behind it
 * (stale-while-revalidate). The source never throws and never makes a page
 * wait on the panel twice. A failed refresh — an unreachable panel, a
 * non-200, a body that is not the panel's shape — keeps the last good answer:
 * a kill switch must not turn itself back on because the panel blinked. With
 * no good answer yet (or no base URL) it is `{}`, the config in code.
 */
export interface ExperimentsSourceOptions {
  /** The brand's base on the panel (`LOCATIONS_API_URL`), read when asked; `null` → no overrides. */
  baseUrl: () => string | null;
  /** How long an answer is fresh; 30 s. */
  ttlMs?: number;
  /** How long the panel is given; 1.5 s. The proxy is waiting on the first call. */
  timeoutMs?: number;
  now?: () => number;
  log?: Pick<Console, "error">;
}

export interface ExperimentsSource {
  /** The overrides to apply now; `{}` when there are none or the panel cannot say. Never throws. */
  overrides(): Promise<ExperimentOverrides>;
}

export const EXPERIMENTS_TTL_MS = 30_000;
const TIMEOUT_MS = 1_500;
const NONE: ExperimentOverrides = Object.freeze({});

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * The panel's answer as overrides, or `null` when it is not the panel's shape.
 * A field of the wrong type is dropped, an entry that is not an object is
 * skipped; the rest stands.
 */
export function parseExperimentOverrides(body: unknown): ExperimentOverrides | null {
  if (!isRecord(body) || !isRecord(body["experiments"])) return null;
  const out: Record<string, ExperimentOverride> = {};
  for (const [key, entry] of Object.entries(body["experiments"])) {
    if (!isRecord(entry)) continue;
    const { enabled, weights, holdout } = entry;
    out[key] = {
      ...(typeof enabled === "boolean" ? { enabled } : {}),
      ...(Array.isArray(weights) && weights.every((w): w is number => typeof w === "number") ? { weights } : {}),
      ...(typeof holdout === "number" ? { holdout } : {}),
    };
  }
  return out;
}

export function createExperimentsSource(options: ExperimentsSourceOptions): ExperimentsSource {
  const ttl = options.ttlMs ?? EXPERIMENTS_TTL_MS;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const now = options.now ?? Date.now;
  const log = options.log ?? console;
  let cached: { base: string; at: number; value: ExperimentOverrides } | null = null;
  let inflight: Promise<ExperimentOverrides> | null = null;

  /** The panel's overrides, or `null` when it could not say. */
  async function load(base: string): Promise<ExperimentOverrides | null> {
    let response: Response;
    try {
      // `no-store`: the cache is this module's; Next's data cache would add a second TTL.
      response = await fetch(`${base}/experiments`, { cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
    } catch (cause) {
      log.error("experiments: the panel is unreachable, keeping the last good overrides", cause);
      return null;
    }
    if (response.status !== 200) {
      log.error(`experiments: the panel answered ${response.status}, keeping the last good overrides`);
      return null;
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch (cause) {
      log.error("experiments: the panel's body is not JSON, keeping the last good overrides", cause);
      return null;
    }
    const parsed = parseExperimentOverrides(body);
    if (parsed === null) log.error("experiments: the panel's body is not { experiments: {…} }, keeping the last good overrides");
    return parsed;
  }

  // One request at a time, however many visitors arrive while it runs.
  function refresh(base: string): Promise<ExperimentOverrides> {
    inflight ??= load(base)
      .then(loaded => {
        // A failure still restarts the clock, so a down panel is asked once per TTL.
        const value = loaded ?? (cached?.base === base ? cached.value : NONE);
        cached = { base, at: now(), value };
        return value;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  }

  return {
    async overrides() {
      const base = options.baseUrl();
      if (!base) return NONE;
      if (cached?.base !== base) return refresh(base);
      if (now() - cached.at >= ttl) void refresh(base);
      return cached.value;
    },
  };
}
