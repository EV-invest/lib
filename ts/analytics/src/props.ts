import type { AnalyticsSink } from "./sink";

// Scoped to this module on purpose: the global `ProcessEnv` is an index
// signature, so `process.env.NODE_ENV` does not type-check under
// `noPropertyAccessFromIndexSignature`, and the bracket form is not what
// bundlers statically replace. A `declare global` augmentation would instead
// leak into consumers' types and clash with Next's own `NODE_ENV` declaration.
declare const process: { env: { NODE_ENV?: string } };

/** A property value PostHog (and `ev_lib::analytics::PropValue`) accepts. */
export type PropValue = string | number | boolean;

/**
 * Which properties may leave the page, and what every event carries.
 */
export interface PropPolicy {
  /**
   * Every property name a sink may send. A key outside the list is a
   * programming error: in development it throws, in production it is dropped
   * silently so a stray key never takes the page down. Omit to allow any key
   * (the behavior before this option existed).
   *
   * The point is mechanical: a phone number or a street address reaching
   * PostHog can only be undone by deleting the project's history, so the list
   * is checked on every event rather than trusted to review.
   */
  allowedProps?: readonly string[];
  /**
   * Properties merged into every event (e.g. `brand_id`, `location_id`). An
   * event's own property of the same name wins. Checked against
   * `allowedProps` once, when the sink is built.
   */
  globalProps?: Readonly<Record<string, PropValue>>;
  /**
   * Throw on a key outside `allowedProps` instead of dropping it. Defaults to
   * `process.env.NODE_ENV !== "production"`.
   */
  strict?: boolean;
}

/**
 * `true` unless the bundle was built for production. Treats an environment
 * without `process` as production: an unknown environment must not throw at a
 * visitor.
 */
export function isDevelopment(): boolean {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
}

function disallowed(
  keys: Iterable<string>,
  allowed: ReadonlySet<string>,
): string[] {
  return [...keys].filter((key) => !allowed.has(key));
}

function violation(where: string, keys: readonly string[]): Error {
  const list = keys.map((key) => JSON.stringify(key)).join(", ");
  return new Error(
    `@evinvest/analytics: ${where} carries ${list}, which is not in allowedProps. ` +
      "Add the name to allowedProps if it is safe to send, or drop the property.",
  );
}

function omit<V>(
  record: Readonly<Record<string, V>>,
  keys: readonly string[],
): Record<string, V> {
  const out: Record<string, V> = { ...record };
  for (const key of keys) delete out[key];
  return out;
}

/**
 * Wraps a sink so every event is merged with `globalProps` and checked against
 * `allowedProps` before it reaches `sink`.
 *
 * @throws When `strict` and `globalProps` itself names a key outside
 *   `allowedProps` — a misconfiguration, surfaced at construction.
 *
 * @example
 * ```ts
 * const sink = withPropPolicy(createBeaconSink({ key, region: "eu" }), {
 *   allowedProps: ["brand_id", "location_id", "channel"],
 *   globalProps: { brand_id: "aquafix", location_id: "warsaw" },
 * });
 * sink.capture("contact_intent_click", { channel: "phone" });
 * sink.capture("contact_intent_click", { phone: "+48…" }); // throws in dev
 * ```
 */
export function withPropPolicy(
  sink: AnalyticsSink,
  policy: PropPolicy,
): AnalyticsSink {
  const strict = policy.strict ?? isDevelopment();
  const allowed =
    policy.allowedProps === undefined ? undefined : new Set(policy.allowedProps);

  let globals: Readonly<Record<string, PropValue>> = policy.globalProps ?? {};
  if (allowed) {
    const bad = disallowed(Object.keys(globals), allowed);
    if (bad.length > 0) {
      if (strict) throw violation("globalProps", bad);
      globals = omit(globals, bad);
    }
  }
  const hasGlobals = Object.keys(globals).length > 0;

  return {
    capture(event, props, options) {
      let merged: Record<string, unknown> | undefined =
        hasGlobals || props !== undefined ? { ...globals, ...props } : undefined;
      if (allowed && merged) {
        const bad = disallowed(Object.keys(merged), allowed);
        if (bad.length > 0) {
          if (strict) throw violation(`event "${event}"`, bad);
          merged = omit(merged, bad);
        }
      }
      sink.capture(event, merged, options);
    },
  };
}
