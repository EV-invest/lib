import type { ExperimentConfig } from './index';

/**
 * An operator's override of one experiment, as the panel's
 * `GET /api/internal/brands/{brand}/experiments` answers it. Every field is
 * optional: an absent one keeps the value declared in code.
 */
export type ExperimentOverride = {
  readonly enabled?: boolean;
  readonly weights?: readonly number[];
  readonly holdout?: number;
};

/** Overrides by experiment key — the `experiments` object of the panel's answer. */
export type ExperimentOverrides = Readonly<Record<string, ExperimentOverride>>;

/**
 * The config {@link applyOverrides} returns: the variants keep their declared
 * (literal) types, while `weights`, `enabled` and `holdout` are whatever the
 * operator set, so they widen to plain values.
 */
export type OverriddenConfig<C extends ExperimentConfig> = {
  readonly [K in keyof C]: Omit<C[K], 'weights' | 'enabled' | 'holdout'> & {
    readonly weights: readonly number[];
    readonly enabled?: boolean;
    readonly holdout?: number;
  };
};

function validWeights(raw: unknown, length: number): readonly number[] | undefined {
  if (!Array.isArray(raw) || raw.length !== length) return undefined;
  const weights: number[] = [];
  for (const w of raw as readonly unknown[]) {
    if (typeof w !== 'number' || !Number.isFinite(w) || w < 0) return undefined;
    weights.push(w);
  }
  return weights.reduce((sum, w) => sum + w, 0) > 0 ? weights : undefined;
}

function validHoldout(raw: unknown): number | undefined {
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw < 1 ? raw : undefined;
}

/**
 * Lays an operator's overrides over the config declared in code. Pure, total
 * and zero-dep, so it runs in a Next proxy on every request.
 *
 * Each field of an override is taken only when it is valid on its own, and an
 * invalid one is dropped without touching the others:
 *
 * - `weights` — the same length as the variants **in code**, every weight a
 *   finite number `>= 0`, and the sum `> 0`;
 * - `holdout` — a finite number in `[0, 1)`;
 * - `enabled` — a boolean.
 *
 * A key the code does not declare is ignored, and the variants always come
 * from code: an override can re-weight or switch off an experiment, never
 * invent an arm the page cannot render. `overrides` is typed, but it came off
 * the network, so its shape is checked again here rather than trusted — a
 * `null`, an array or any other non-object is no overrides at all.
 *
 * Weights move only *new* assignments: a visitor who already carries the
 * `ab_<key>` cookie keeps their arm. `enabled: false` reaches everyone at once
 * (`resolveVariant` ignores the cookie).
 *
 * @param config    - The config declared in code.
 * @param overrides - The panel's `experiments` object; `null`/`undefined` → none.
 * @returns A new config; `config` itself is not modified.
 *
 * @example
 * ```ts
 * const live = applyOverrides(config, await source.overrides());
 * pickVariant(live, "hero");
 * ```
 */
export function applyOverrides<C extends ExperimentConfig>(
  config: C,
  overrides: ExperimentOverrides | null | undefined,
): OverriddenConfig<C> {
  const raw: unknown = overrides;
  const table = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(config)) {
    // Own properties only: a key like `constructor` must not reach the prototype.
    const entry: unknown = Object.hasOwn(table, key) ? table[key] : undefined;
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      out[key] = spec;
      continue;
    }
    const o = entry as Record<string, unknown>;
    const weights = validWeights(o['weights'], spec.variants.length);
    const holdout = validHoldout(o['holdout']);
    const enabled = typeof o['enabled'] === 'boolean' ? o['enabled'] : undefined;
    out[key] = {
      ...spec,
      ...(weights !== undefined ? { weights } : {}),
      ...(holdout !== undefined ? { holdout } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
    };
  }
  return out as OverriddenConfig<C>;
}
