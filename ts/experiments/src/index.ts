/**
 * @module @evinvest/experiments
 *
 * Zero-dependency, server-safe core for weighted A/B experiments. No React, no
 * Next.js, no DOM — just pure functions over a caller-supplied config. The
 * package never hard-codes experiment keys: every helper is generic over a
 * {@link ExperimentConfig} you pass in, ideally `as const` so the variant
 * unions narrow at the call site.
 *
 * This is the TypeScript mirror of the `experiments` Cargo feature of the
 * [`ev`](https://github.com/EV-invest/lib) Rust crate; it preserves the
 * _semantics_ (cookie shape, weighted pick, control fallback) while reading
 * like idiomatic TS.
 *
 * The package emits exposure / interaction events through an **injected sink**
 * ({@link CaptureFn}), so it has no dependency on any analytics SDK — see
 * `./react`. It deliberately does **not** import `@evinvest/analytics`.
 */

/**
 * Shape of an experiments config: a map from experiment key to its declared
 * `variants` and their relative `weights`. Declare it `as const` so the variant
 * strings narrow to literal unions and the generic helpers can infer
 * {@link ExperimentKey} / {@link Variant} precisely.
 *
 * `variants` and `weights` are positional: `weights[i]` is the relative weight
 * of `variants[i]`. Weights need not sum to 1 — {@link pickVariant} normalizes
 * them by their total.
 *
 * @example
 * ```ts
 * const config = {
 *   hero: { variants: ["a", "b"], weights: [0.5, 0.5] },
 *   team: { variants: ["a", "b", "c"], weights: [2, 1, 1] },
 * } as const satisfies ExperimentConfig;
 * ```
 */
export type ExperimentConfig = Record<
  string,
  { variants: readonly string[]; weights: readonly number[] }
>;

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
 * @param key - The experiment key.
 * @returns The cookie name (e.g. `"ab_hero"`).
 *
 * @example
 * ```ts
 * cookieName("hero"); // "ab_hero"
 * ```
 */
export function cookieName(key: string): string {
  return `ab_${key}`;
}

/**
 * Weighted per-device variant pick. Weights need not sum to 1 — they are
 * normalized by their total — and the loop falls through to the last variant,
 * so floating-point drift can never return `undefined`.
 *
 * The randomness source is injectable: pass a deterministic `rng` (a function
 * returning a number in `[0, 1)`) in tests to make picks reproducible. The
 * default is `Math.random`, i.e. no user-id hashing — bucketing is per device.
 *
 * @typeParam C - The {@link ExperimentConfig}.
 * @typeParam K - The experiment key.
 * @param config - The experiments config.
 * @param key    - The experiment key to pick a variant for.
 * @param rng    - Source of randomness in `[0, 1)`. Defaults to `Math.random`.
 * @returns The picked variant string, narrowed to {@link Variant}.
 *
 * @example
 * ```ts
 * pickVariant(config, "hero");               // weighted by Math.random
 * pickVariant(config, "hero", () => 0.99);   // deterministic in tests
 * ```
 */
export function pickVariant<C extends ExperimentConfig, K extends ExperimentKey<C>>(
  config: C,
  key: K,
  rng: () => number = Math.random,
): Variant<C, K> {
  const { variants, weights } = config[key] as C[K];
  // Only positive weights contribute, mirroring the Rust core. A non-positive
  // total (no weight at all) falls back to the control (variants[0]) instead of
  // the last variant, so a zero-weight experiment is deterministically control.
  const total = weights.reduce((sum, w) => (w > 0 ? sum + w : sum), 0);
  if (total <= 0) return variants[0] as Variant<C, K>;
  let r = rng() * total;
  for (let i = 0; i < variants.length; i++) {
    r -= weights[i] ?? 0;
    if (r < 0) return variants[i] as Variant<C, K>;
  }
  return variants[variants.length - 1] as Variant<C, K>;
}

/**
 * Coerce a raw cookie value to a valid variant, falling back to the first
 * (control) variant when the cookie is missing or holds an unrecognised value.
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
  const { variants } = config[key] as C[K];
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
