import { describe, expect, it } from 'vitest';
import {
  applyOverrides,
  cookieName,
  nextVariant,
  pickVariant,
  resolveVariant,
  select,
  type ExperimentConfig,
  type Variant,
} from '../src/index';

const config = {
  hero: { variants: ['a', 'b'] },
  // Three equal shares: boundaries at 1/3, 2/3, 1.
  team: { variants: ['a', 'b', 'c'] },
} as const satisfies ExperimentConfig;

/**
 * A spec carrying weights `applyOverrides` would reject — the shape a caller
 * could still hand-build — to pin that `pickVariant` itself stays total on it.
 */
function unchecked(variants: readonly string[], weights: readonly number[]) {
  return { flag: { variants, weights } };
}

describe('cookieName', () => {
  it('is `ab_<key>`', () => {
    expect(cookieName('hero')).toBe('ab_hero');
    expect(cookieName('team')).toBe('ab_team');
    expect(cookieName('')).toBe('ab_');
  });
});

describe('pickVariant', () => {
  it('splits two variants in equal halves with a seeded rng', () => {
    // r = rng() * 2. Boundary at 0.5: below → "a", from it on → "b".
    expect(pickVariant(config, 'hero', () => 0)).toBe('a');
    expect(pickVariant(config, 'hero', () => 0.4999)).toBe('a');
    expect(pickVariant(config, 'hero', () => 0.5)).toBe('b');
    expect(pickVariant(config, 'hero', () => 0.999)).toBe('b');
  });

  it('maps each third to its variant without declared weights', () => {
    const points: Array<[number, 'a' | 'b' | 'c']> = [
      [0, 'a'],
      [0.33, 'a'],
      [0.34, 'b'],
      [0.66, 'b'],
      [0.67, 'c'],
      [0.99, 'c'],
    ];
    for (const [r, expected] of points) {
      expect(pickVariant(config, 'team', () => r)).toBe(expected);
    }
  });

  it('walks operator weights laid over by applyOverrides, normalized by their total', () => {
    // Override 2:1:1 → total 4: a [0,.5), b [.5,.75), c [.75,1).
    const live = applyOverrides(config, { team: { weights: [2, 1, 1] } });
    const points: Array<[number, 'a' | 'b' | 'c']> = [
      [0, 'a'],
      [0.4999, 'a'],
      [0.5, 'b'],
      [0.7499, 'b'],
      [0.75, 'c'],
      [0.99, 'c'],
    ];
    for (const [r, expected] of points) {
      expect(pickVariant(live, 'team', () => r)).toBe(expected);
    }
  });

  it('keeps equal shares for an experiment the override does not touch', () => {
    const live = applyOverrides(config, { team: { weights: [2, 1, 1] } });
    expect(live.hero).not.toHaveProperty('weights');
    expect(pickVariant(live, 'hero', () => 0.5)).toBe('b');
  });

  it('falls through to the last variant at the top of the range (fp drift safety)', () => {
    // rng() returning 1 would make r === total; the loop never trips r < 0, so
    // it must fall through to the last variant rather than returning undefined.
    expect(pickVariant(config, 'hero', () => 1)).toBe('b');
    expect(pickVariant(config, 'team', () => 1)).toBe('c');
  });

  it('always picks the only variant of a single-variant experiment', () => {
    const single = {
      solo: { variants: ['only'] },
    } as const satisfies ExperimentConfig;
    expect(pickVariant(single, 'solo', () => 0)).toBe('only');
    expect(pickVariant(single, 'solo', () => 0.5)).toBe('only');
    expect(pickVariant(single, 'solo', () => 1)).toBe('only');
  });

  it('falls back to the control (variants[0]) when hand-built weights total zero', () => {
    const zero = unchecked(['control', 'b'], [0, 0]);
    expect(pickVariant(zero, 'flag', () => 0)).toBe('control');
    expect(pickVariant(zero, 'flag', () => 0.99)).toBe('control');
  });

  it('ignores negative hand-built weights in the total', () => {
    expect(pickVariant(unchecked(['a', 'b'], [-1, 1]), 'flag', () => 0.5)).toBe('b');
  });

  it('stays valid when hand-built weights are fewer than the variants', () => {
    // Missing weights count as 0, so only "a" carries weight.
    const short = unchecked(['a', 'b', 'c'], [1]);
    expect(pickVariant(short, 'flag', () => 0)).toBe('a');
    expect(pickVariant(short, 'flag', () => 0.99)).toBe('a');
  });

  it('stays valid when hand-built weights outnumber the variants', () => {
    // total 3 → a [0,1/3) b [1/3,2/3); the surplus weight maps to no variant and
    // falls through to the last real variant.
    const long = unchecked(['a', 'b'], [1, 1, 1]);
    expect(pickVariant(long, 'flag', () => 0.1)).toBe('a');
    expect(pickVariant(long, 'flag', () => 0.5)).toBe('b');
    expect(pickVariant(long, 'flag', () => 0.9)).toBe('b');
  });

  it('defaults rng to Math.random and always returns a declared variant', () => {
    for (let i = 0; i < 200; i++) {
      expect(config.hero.variants).toContain(pickVariant(config, 'hero'));
      expect(config.team.variants).toContain(pickVariant(config, 'team'));
    }
  });
});

describe('resolveVariant', () => {
  it('returns a recognised value untouched', () => {
    expect(resolveVariant(config, 'hero', 'b')).toBe('b');
    expect(resolveVariant(config, 'team', 'c')).toBe('c');
  });

  it('falls back to variants[0] on missing or garbage', () => {
    expect(resolveVariant(config, 'hero', undefined)).toBe('a');
    expect(resolveVariant(config, 'hero', '')).toBe('a');
    expect(resolveVariant(config, 'hero', 'zzz')).toBe('a');
    expect(resolveVariant(config, 'team', 'nope')).toBe('a');
  });
});

describe('nextVariant', () => {
  it('wraps forward by +1', () => {
    expect(nextVariant(config, 'hero', 'a', 1)).toBe('b');
    expect(nextVariant(config, 'hero', 'b', 1)).toBe('a');
    expect(nextVariant(config, 'team', 'c', 1)).toBe('a');
  });

  it('wraps backward by -1', () => {
    expect(nextVariant(config, 'hero', 'b', -1)).toBe('a');
    expect(nextVariant(config, 'hero', 'a', -1)).toBe('b');
    expect(nextVariant(config, 'team', 'a', -1)).toBe('c');
  });

  it('treats an unknown current as index 0', () => {
    expect(nextVariant(config, 'hero', 'unknown', 1)).toBe('b');
    expect(nextVariant(config, 'hero', 'unknown', -1)).toBe('b');
  });

  it('is the identity for step 0', () => {
    expect(nextVariant(config, 'hero', 'a', 0)).toBe('a');
    expect(nextVariant(config, 'team', 'c', 0)).toBe('c');
    // Unknown current with step 0 falls to index 0.
    expect(nextVariant(config, 'team', 'unknown', 0)).toBe('a');
  });

  it('wraps for steps larger than the list (positive and negative)', () => {
    // len 3: +5 ≡ +2, so from "a" → "c"; -5 ≡ +1, so from "a" → "b".
    expect(nextVariant(config, 'team', 'a', 5)).toBe('c');
    expect(nextVariant(config, 'team', 'a', -5)).toBe('b');
    // Full multiples of len are the identity.
    expect(nextVariant(config, 'team', 'b', 6)).toBe('b');
    expect(nextVariant(config, 'team', 'b', -6)).toBe('b');
  });

  it('always lands on the only variant of a single-variant experiment', () => {
    const single = {
      solo: { variants: ['only'] },
    } as const satisfies ExperimentConfig;
    expect(nextVariant(single, 'solo', 'only', 1)).toBe('only');
    expect(nextVariant(single, 'solo', 'only', -1)).toBe('only');
    expect(nextVariant(single, 'solo', 'unknown', 3)).toBe('only');
  });
});

describe('select', () => {
  it('returns the branch for the active variant (exhaustive mapping)', () => {
    const branches = { a: 1, b: 2 };
    expect(select<'a' | 'b', number>('a', branches)).toBe(1);
    expect(select<'a' | 'b', number>('b', branches)).toBe(2);
  });

  it('maps every variant of a three-way union', () => {
    const branches = { a: 'A', b: 'B', c: 'C' } as const;
    expect(select<'a' | 'b' | 'c', string>('a', branches)).toBe('A');
    expect(select<'a' | 'b' | 'c', string>('b', branches)).toBe('B');
    expect(select<'a' | 'b' | 'c', string>('c', branches)).toBe('C');
  });

  it('rejects a branch map that misses a variant (compile-time exhaustiveness)', () => {
    // @ts-expect-error — "b" is missing from the branch map for the "a" | "b" union.
    select<'a' | 'b', number>('a', { a: 1 });
  });
});

describe('Variant<C, K> narrowing', () => {
  it('rejects declared weights (type-level)', () => {
    const declared = {
      // @ts-expect-error — weights are not declared in code; the panel overrides them.
      hero: { variants: ['a', 'b'], weights: [1, 1] },
    } as const satisfies ExperimentConfig;
    void declared;
  });

  it('narrows variants to the declared literal union (type-level)', () => {
    // Assigning a valid literal is fine.
    const ok: Variant<typeof config, 'hero'> = 'a';
    expect(ok).toBe('a');
    // @ts-expect-error — "c" is not a declared hero variant.
    const bad: Variant<typeof config, 'hero'> = 'c';
    void bad;
    // @ts-expect-error — "nope" is not a key of the config.
    type _Bad = Variant<typeof config, 'nope'>;
  });
});
