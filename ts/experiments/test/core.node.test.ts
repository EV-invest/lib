import { describe, expect, it } from 'vitest';
import {
  cookieName,
  nextVariant,
  pickVariant,
  resolveVariant,
  select,
  type ExperimentConfig,
  type Variant,
} from '../src/index';

const config = {
  hero: { variants: ['a', 'b'], weights: [0.5, 0.5] },
  // Unnormalized, three-way weights: total 4, boundaries at 0.5, 0.75, 1.0.
  team: { variants: ['a', 'b', 'c'], weights: [2, 1, 1] },
} as const satisfies ExperimentConfig;

describe('cookieName', () => {
  it('is `ab_<key>`', () => {
    expect(cookieName('hero')).toBe('ab_hero');
    expect(cookieName('team')).toBe('ab_team');
    expect(cookieName('')).toBe('ab_');
  });
});

describe('pickVariant', () => {
  it('is deterministic given a seeded rng and respects weight boundaries (50/50)', () => {
    // r = rng() * total(1). Boundary at 0.5: r < 0.5 → "a", else "b".
    expect(pickVariant(config, 'hero', () => 0)).toBe('a');
    expect(pickVariant(config, 'hero', () => 0.4999)).toBe('a');
    expect(pickVariant(config, 'hero', () => 0.5)).toBe('b');
    expect(pickVariant(config, 'hero', () => 0.999)).toBe('b');
  });

  it('normalizes unnormalized weights and straddles every boundary', () => {
    // total 4 → r = rng()*4. Cumulative: a [0,2), b [2,3), c [3,4).
    // rng maps via *4: a for rng<0.5, b for [0.5,0.75), c for [0.75,1).
    expect(pickVariant(config, 'team', () => 0)).toBe('a');
    expect(pickVariant(config, 'team', () => 0.49)).toBe('a');
    expect(pickVariant(config, 'team', () => 0.5)).toBe('b');
    expect(pickVariant(config, 'team', () => 0.74)).toBe('b');
    expect(pickVariant(config, 'team', () => 0.75)).toBe('c');
    expect(pickVariant(config, 'team', () => 0.99)).toBe('c');
  });

  it('maps each rng sub-interval to the correct variant (property-style)', () => {
    // Walk a handful of rng points; each must land in its cumulative sub-interval.
    const points: Array<[number, 'a' | 'b' | 'c']> = [
      [0, 'a'],
      [0.25, 'a'],
      [0.4999, 'a'],
      [0.5, 'b'],
      [0.6, 'b'],
      [0.7499, 'b'],
      [0.75, 'c'],
      [0.9, 'c'],
    ];
    for (const [r, expected] of points) {
      expect(pickVariant(config, 'team', () => r)).toBe(expected);
    }
  });

  it('falls through to the last variant at the top of the range (fp drift safety)', () => {
    // rng() returning 1 would make r === total; the loop never trips r < 0, so
    // it must fall through to the last variant rather than returning undefined.
    expect(pickVariant(config, 'hero', () => 1)).toBe('b');
    expect(pickVariant(config, 'team', () => 1)).toBe('c');
  });

  it('always picks the only variant of a single-variant experiment', () => {
    const single = {
      solo: { variants: ['only'], weights: [1] },
    } as const satisfies ExperimentConfig;
    expect(pickVariant(single, 'solo', () => 0)).toBe('only');
    expect(pickVariant(single, 'solo', () => 0.5)).toBe('only');
    expect(pickVariant(single, 'solo', () => 1)).toBe('only');
  });

  it('falls back to the control (variants[0]) when the total weight is zero', () => {
    // Mirrors the Rust core: a non-positive total is deterministically the control.
    const zero = {
      flag: { variants: ['control', 'b'], weights: [0, 0] },
    } as const satisfies ExperimentConfig;
    expect(pickVariant(zero, 'flag', () => 0)).toBe('control');
    expect(pickVariant(zero, 'flag', () => 0.99)).toBe('control');
  });

  it('ignores negative weights in the total', () => {
    const neg = {
      flag: { variants: ['a', 'b'], weights: [-1, 1] },
    } as const satisfies ExperimentConfig;
    expect(pickVariant(neg, 'flag', () => 0.5)).toBe('b');
  });

  it('stays valid when there are fewer weights than variants', () => {
    // Missing weights default to 0, so only "a" carries weight.
    const short = {
      flag: { variants: ['a', 'b', 'c'], weights: [1] },
    } as const satisfies ExperimentConfig;
    expect(pickVariant(short, 'flag', () => 0)).toBe('a');
    expect(pickVariant(short, 'flag', () => 0.99)).toBe('a');
  });

  it('stays valid when there are more weights than variants', () => {
    // total 3 → a [0,1/3) b [1/3,2/3); the surplus weight maps to no variant and
    // falls through to the last real variant.
    const long = {
      flag: { variants: ['a', 'b'], weights: [1, 1, 1] },
    } as const satisfies ExperimentConfig;
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
      solo: { variants: ['only'], weights: [1] },
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
