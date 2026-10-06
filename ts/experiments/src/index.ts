/**
 * @module @evinvest/experiments
 *
 * Zero-dependency, server-safe core for A/B experiments. No React, no
 * Next.js, no DOM — just pure functions over a caller-supplied config. The
 * package never hard-codes experiment keys: every helper is generic over a
 * {@link ExperimentConfig} you pass in, ideally `as const` so the variant
 * unions narrow at the call site.
 *
 * This is the TypeScript mirror of the `experiments` Cargo feature of the
 * [`ev`](https://github.com/EV-invest/lib) Rust crate; it preserves the
 * _semantics_ (cookie shape, equal-share pick, control fallback) while reading
 * like idiomatic TS.
 *
 * The package emits exposure / interaction events through an **injected sink**
 * ({@link CaptureFn}), so it has no dependency on any analytics SDK — see
 * `./react`. It deliberately does **not** import `@evinvest/analytics`.
 */

import { DEFAULT_COOKIE_PREFIX } from './generated/contract';
import { hashRng } from './hash';

/** The default cookie-name prefix, `ab_` (the Rust `cookie_name` contract). */
export { DEFAULT_COOKIE_PREFIX } from './generated/contract';

export { fnv1a32, hashRng, hashToUnit } from './hash';
export {
  applyOverrides,
  type ExperimentOverride,
  type ExperimentOverrides,
  type OverriddenConfig,
} from './overrides';

/**
 * Shape of an experiments config: a map from experiment key to its declared
 * `variants`. Declare it `as const` so the variant strings narrow to literal
 * unions and the generic helpers can infer {@link ExperimentKey} /
 * {@link Variant} precisely.
 *
 * There are no weights to declare: every variant gets an equal share. A split
 * set by hand at the declaration point is a guess; re-weighting is an
 * operator's decision, made in the panel and laid over the config by
 * {@link applyOverrides}.
 *
 * @example
 * ```ts
 * const config = {
 *   hero: { variants: ["a", "b"] },
 *   team: { variants: ["a", "b", "c"] },
 * } as const satisfies ExperimentConfig;
 * ```
 */
export type ExperimentConfig = Record<string, ExperimentSpec>;

/**
 * One experiment of an {@link ExperimentConfig}. `variants[0]` is the control.
 *
 * - `enabled` — kill switch. `false` makes every helper return the control:
 *   {@link pickVariant} draws nothing, {@link resolveVariant} ignores a stored
 *   cookie, and a force ({@link forcedVariant}) is refused. Omitted = enabled.
 * - `holdout` — the share in `[0, 1]` of assignments pinned to the control
 *   before the split (values outside the range are clamped, `NaN` is
 *   0). Omitted = no holdout.
 */
export type ExperimentSpec = {
  readonly variants: readonly string[];
  readonly enabled?: boolean;
  readonly holdout?: number;
};

/**
 * The valid experiment keys of a config `C` — the union of its property names.
 *
 * @typeParam C - An {@link ExperimentConfig}, usually passed `as const`.
 *
 * @example
 * ```ts
 * type Key = ExperimentKey<typeof config>; // "hero" | "team"
 * ```
 */
export type ExperimentKey<C extends ExperimentConfig> = keyof C & string;

/**
 * The valid variant strings declared for key `K` of config `C`. Narrows to the
 * literal union when `C` is `as const`.
 *
 * @typeParam C - An {@link ExperimentConfig}, usually passed `as const`.
 * @typeParam K - One of {@link ExperimentKey}.
 *
 * @example
 * ```ts
 * type HeroVariant = Variant<typeof config, "hero">; // "a" | "b"
 * ```
 */
export type Variant<
  C extends ExperimentConfig,
  K extends ExperimentKey<C>,
> = C[K]["variants"][number];

/**
 * The cookie name carrying the assigned variant for an experiment: `ab_<key>`.
 *
 * @param key    - The experiment key.
 * @param prefix - Name prefix; defaults to `ab_`. Override it only together
 *                 with the matching `cookie.prefix` option of `./next`.
 * @returns The cookie name (e.g. `"ab_hero"`).
 *
 * @example
 * ```ts
 * cookieName("hero"); // "ab_hero"
 * ```
 */
export function cookieName(key: string, prefix: string = DEFAULT_COOKIE_PREFIX): string {
  return `${prefix}${key}`;
}

/**
 * Cookie parameters shared by `./next` (`abProxy`, `getVariant`) and `./react`
 * (`writeVariant`). Lives in the zero-dep core so the client bundle never
 * imports `next/server`. Every
 * field is optional; the defaults are the historical `ab_<key>` cookie, 30-day
 * `maxAge`, `path: "/"`, `sameSite: "lax"`, no `domain`.
 */
export type AbCookieOptions = {
  /** Cookie-name prefix; the cookie is `${prefix}${key}`. Default `ab_`. */
  readonly prefix?: string;
  /** Lifetime in seconds. Default 30 days. */
  readonly maxAge?: number;
  /** Cookie path. Default `/`. */
  readonly path?: string;
  /** Cookie domain, e.g. `.brand.com` to share across location subdomains. */
  readonly domain?: string;
  /** SameSite policy. Default `lax`. */
  readonly sameSite?: 'lax' | 'strict' | 'none';
};

/**
 * Per-device variant pick. Every variant gets an equal share unless the spec
 * carries operator `weights` laid over it by {@link applyOverrides}; those are
 * relative (normalized by their total). The loop falls through to the last
 * variant, so floating-point drift can never return `undefined`.
 *
 * The randomness source is injectable: pass a deterministic `rng` (a function
 * returning a number in `[0, 1)`) in tests to make picks reproducible, or
 * {@link hashRng} to bucket by a stable subject (see {@link pickVariantFor}).
 * The default is `Math.random` — bucketing is per device.
 *
 * A disabled experiment (`enabled: false`) returns the control without calling
 * `rng`. Otherwise `rng` is called exactly once: with a `holdout` of `h`, a draw
 * below `h` returns the control and the rest is rescaled to `(u - h) / (1 - h)`
 * before the walk.
 *
 * @typeParam C - The {@link ExperimentConfig}.
 * @typeParam K - The experiment key.
 * @param config - The experiments config, or its {@link applyOverrides} result.
 * @param key    - The experiment key to pick a variant for.
 * @param rng    - Source of randomness in `[0, 1)`. Defaults to `Math.random`.
 * @returns The picked variant string, narrowed to {@link Variant}.
 *
 * @example
 * ```ts
 * pickVariant(config, "hero");               // equal shares by Math.random
 * pickVariant(config, "hero", () => 0.99);   // deterministic in tests
 * ```
 */
export function pickVariant<C extends ExperimentConfig, K extends ExperimentKey<C>>(
  config: C,
  key: K,
  rng: () => number = Math.random,
): Variant<C, K> {
  const spec = config[key] as C[K] & { readonly weights?: readonly number[] };
  const { variants, enabled, holdout } = spec;
  if (enabled === false) return variants[0] as Variant<C, K>;
  // Weights exist only as an operator override; without one every variant
  // weighs 1, which is exactly the Rust core's equal-share walk.
  const weights = spec.weights ?? variants.map(() => 1);
  // Only positive weights contribute. A non-positive total (no variants, or an
  // override that `applyOverrides` would have rejected) falls back to the
  // control instead of the last variant.
  const total = weights.reduce((sum, w) => (w > 0 ? sum + w : sum), 0);
  if (total <= 0) return variants[0] as Variant<C, K>;
  let u = rng();
  // Holdout reuses the single draw instead of taking a second one: the bottom
  // `h` of [0, 1) is the holdout, the rest is rescaled back onto [0, 1). With no
  // holdout the draw is untouched, so existing seeded picks keep their result.
  const h = clampUnit(holdout);
  if (h > 0) {
    if (u < h) return variants[0] as Variant<C, K>;
    u = (u - h) / (1 - h);
  }
  let r = u * total;
  for (let i = 0; i < variants.length; i++) {
    r -= weights[i] ?? 0;
    if (r < 0) return variants[i] as Variant<C, K>;
  }
  return variants[variants.length - 1] as Variant<C, K>;
}

/**
 * Deterministic pick for a stable `subject` — e.g. a location id, so
 * the split is per location rather than per visitor. Equivalent to
 * `pickVariant(config, key, hashRng(`${key}:${subject}`))`: the same subject
 * always gets the same variant, no cookie is read, and pages can stay static.
 * `enabled` and `holdout` apply exactly as in {@link pickVariant}.
 *
 * @typeParam C - The {@link ExperimentConfig}.
 * @typeParam K - The experiment key.
 * @param config  - The experiments config.
 * @param key     - The experiment key.
 * @param subject - The stable identity to bucket (never PII in clear).
 * @returns The picked variant, narrowed to {@link Variant}.
 *
 * @example
 * ```ts
 * pickVariantFor(config, "hero", "loc-42"); // same answer on every call
 * ```
 */
export function pickVariantFor<C extends ExperimentConfig, K extends ExperimentKey<C>>(
  config: C,
  key: K,
  subject: string,
): Variant<C, K> {
  return pickVariant(config, key, hashRng(`${key}:${subject}`));
}

/**
 * Validates a forced variant (e.g. from a `?ab_hero=b` query parameter). Returns
 * the variant when it is declared for `key` and the experiment is enabled,
 * otherwise `undefined` — an unknown value is ignored, never trusted.
 *
 * @typeParam C - The {@link ExperimentConfig}.
 * @typeParam K - The experiment key.
 * @param config - The experiments config.
 * @param key    - The experiment key.
 * @param raw    - The requested variant, or `undefined`/`null` when absent.
 * @returns The validated variant, or `undefined`.
 *
 * @example
 * ```ts
 * forcedVariant(config, "hero", "b");       // "b"
 * forcedVariant(config, "hero", "garbage"); // undefined
 * ```
 */
export function forcedVariant<C extends ExperimentConfig, K extends ExperimentKey<C>>(
  config: C,
  key: K,
  raw: string | null | undefined,
): Variant<C, K> | undefined {
  const { variants, enabled } = config[key] as C[K];
  if (enabled === false || raw === undefined || raw === null) return undefined;
  return (variants as readonly string[]).includes(raw) ? (raw as Variant<C, K>) : undefined;
}

function clampUnit(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Coerce a raw cookie value to a valid variant, falling back to the first
 * (control) variant when the cookie is missing or holds an unrecognised value.
 * A disabled experiment always resolves to the control, so flipping `enabled`
 * off takes effect for visitors who already carry a cookie.
 *
 * @typeParam C - The {@link ExperimentConfig}.
 * @typeParam K - The experiment key.
 * @param config - The experiments config.
 * @param key    - The experiment key.
 * @param raw    - The raw cookie value, or `undefined` when no cookie is set.
 * @returns A valid variant string — `raw` if recognised, else `variants[0]`.
 *
 * @example
 * ```ts
 * resolveVariant(config, "hero", "b");        // "b"
 * resolveVariant(config, "hero", undefined);  // "a" (control)
 * resolveVariant(config, "hero", "garbage");  // "a" (control)
 * ```
 */
export function resolveVariant<C extends ExperimentConfig, K extends ExperimentKey<C>>(
  config: C,
  key: K,
  raw: string | undefined,
): Variant<C, K> {
  const { variants, enabled } = config[key] as C[K];
  if (enabled === false) return variants[0] as Variant<C, K>;
  return (variants as readonly string[]).includes(raw ?? '')
    ? (raw as Variant<C, K>)
    : (variants[0] as Variant<C, K>);
}

/**
 * The variant `step` positions away from `current` for an experiment, wrapping
 * around the declared variant list. Always lands on a real variant, so cyclic
 * stepping (e.g. vim-style `l`/`h`) can never select something that doesn't
 * exist. An unrecognised `current` is treated as index 0.
 *
 * @typeParam C - The {@link ExperimentConfig}.
 * @typeParam K - The experiment key.
 * @param config  - The experiments config.
 * @param key     - The experiment key.
 * @param current - The current variant value.
 * @param step    - Signed step (e.g. `+1` / `-1`); wraps modulo the list length.
 * @returns The next variant after wrapping.
 *
 * @example
 * ```ts
 * nextVariant(config, "hero", "a", 1);   // "b"
 * nextVariant(config, "hero", "b", 1);   // "a" (wraps)
 * nextVariant(config, "hero", "a", -1);  // "b" (wraps backwards)
 * ```
 */
export function nextVariant<C extends ExperimentConfig, K extends ExperimentKey<C>>(
  config: C,
  key: K,
  current: string,
  step: number,
): Variant<C, K> {
  const { variants } = config[key] as C[K];
  const len = variants.length;
  const idx = Math.max(0, variants.indexOf(current));
  return variants[(((idx + step) % len) + len) % len] as Variant<C, K>;
}

/**
 * Exhaustive map from variant to a value. TypeScript requires every variant of
 * the union to appear as a branch, so adding a variant to the config without
 * updating a `select` call is a compile-time error.
 *
 * The core stays renderer-agnostic: `T` is any value. The `./react` subpath's
 * `match` is `select` specialised to `ReactNode`.
 *
 * @typeParam V - The variant union (e.g. `"a" | "b"`).
 * @typeParam T - The branch value type.
 * @param variant  - The active variant.
 * @param branches - A map from every valid variant to a `T`.
 * @returns The branch value for the active variant.
 *
 * @example
 * ```ts
 * const label = select(variant, { a: "Control", b: "Treatment" });
 * ```
 */
export function select<V extends string, T>(
  variant: V,
  branches: { [K in V]: T },
): T {
  return branches[variant];
}

/**
 * The signature of an injected event sink: `(event, props?) => void`. The
 * package emits exposure and interaction events through this function instead
 * of importing an analytics SDK, so consumers wire their own capture (e.g.
 * `@evinvest/analytics`'s `capture`, PostHog, a console logger) without this
 * package taking a dependency on it.
 *
 * Defined structurally here on purpose: it is shape-compatible with
 * `@evinvest/analytics`'s `CaptureFn`, but is **not** imported from it.
 *
 * @param event - The event name (e.g. `"hero_exposed"`, `"hero_cta_clicked"`).
 * @param props - Optional non-PII props merged into the payload.
 *
 * @example
 * ```ts
 * const onEvent: CaptureFn = (event, props) => console.log(event, props);
 * ```
 */
export type CaptureFn = (event: string, props?: Record<string, unknown>) => void;
