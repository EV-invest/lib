import { describe, expect, it } from 'vitest';
import {
  cookieName,
  nextVariant,
  pickVariant,
  resolveVariant,
  select,
  type ExperimentConfig,
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

  it('falls through to the last variant at the top of the range (fp drift safety)', () => {
    // rng() returning 1 would make r === total; the loop never trips r < 0, so
    // it must fall through to the last variant rather than returning undefined.
    expect(pickVariant(config, 'hero', () => 1)).toBe('b');
    expect(pickVariant(config, 'team', () => 1)).toBe('c');
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
});

describe('select', () => {
  it('returns the branch for the active variant', () => {
    const branches = { a: 1, b: 2 };
    expect(select<'a' | 'b', number>('a', branches)).toBe(1);
    expect(select<'a' | 'b', number>('b', branches)).toBe(2);
  });
});
