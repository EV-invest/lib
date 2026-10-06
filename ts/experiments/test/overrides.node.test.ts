import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  applyOverrides,
  pickVariant,
  resolveVariant,
  type ExperimentConfig,
  type ExperimentOverrides,
  type Variant,
} from '../src/index';
import { OVERRIDE_WEIGHTS, overrideWeights } from '../src/overrides';

const config = {
  hero: { variants: ['a', 'b'] },
  team: { variants: ['a', 'b', 'c'], holdout: 0.1 },
} as const satisfies ExperimentConfig;

/** Network data in a test: the shape the panel must not send, passed through the typed door. */
const raw = (value: unknown): ExperimentOverrides => value as ExperimentOverrides;

describe('applyOverrides', () => {
  it('returns the code config unchanged with no overrides', () => {
    expect(applyOverrides(config, undefined)).toEqual(config);
    expect(applyOverrides(config, null)).toEqual(config);
    expect(applyOverrides(config, {})).toEqual(config);
  });

  it('applies every valid field', () => {
    const live = applyOverrides(config, { hero: { weights: [0, 3], enabled: false, holdout: 0.25 } });
    // `toEqual` compares symbol keys too: the weights sit under the private key only.
    expect(live.hero).toEqual({ variants: ['a', 'b'], enabled: false, holdout: 0.25, [OVERRIDE_WEIGHTS]: [0, 3] });
    expect(overrideWeights(live.hero)).toEqual([0, 3]);
    // The panel's weights are not a public field.
    expect(live.hero).not.toHaveProperty('weights');
    expect(live.team).toEqual(config.team);
  });

  it('applies fields one by one, keeping the rest from code', () => {
    expect(applyOverrides(config, { team: { enabled: false } }).team).toEqual({ ...config.team, enabled: false });
    expect(applyOverrides(config, { team: { holdout: 0 } }).team.holdout).toBe(0);
  });

  it('does not modify the config it was given', () => {
    applyOverrides(config, { hero: { weights: [0, 1] } });
    expect(config.hero).toEqual({ variants: ['a', 'b'] });
  });

  it('adds no weights without a valid weights override', () => {
    const live = applyOverrides(config, { hero: { enabled: true }, team: { holdout: 0.2 } });
    expect(overrideWeights(live.hero)).toBeUndefined();
    expect(overrideWeights(live.team)).toBeUndefined();
  });

  describe('drops an invalid field and keeps the valid ones', () => {
    const cases: [string, unknown][] = [
      ['weights shorter than the variants', [1]],
      ['weights longer than the variants', [1, 1, 1]],
      ['a negative weight', [-1, 2]],
      ['weights summing to zero', [0, 0]],
      ['a NaN weight', [Number.NaN, 1]],
      ['an infinite weight', [Number.POSITIVE_INFINITY, 1]],
      ['a string weight', ['1', 1]],
      ['weights that are not an array', { 0: 1, 1: 1 }],
      ['null weights', null],
    ];
    it.each(cases)('weights: %s', (_, weights) => {
      const live = applyOverrides(config, raw({ hero: { weights, enabled: false } }));
      expect(overrideWeights(live.hero)).toBeUndefined();
      expect(live.hero.enabled).toBe(false);
    });

    const holdouts: [string, unknown][] = [
      ['one', 1],
      ['above one', 1.5],
      ['negative', -0.1],
      ['NaN', Number.NaN],
      ['a string', '0.5'],
      ['null', null],
    ];
    it.each(holdouts)('holdout: %s', (_, holdout) => {
      const live = applyOverrides(config, raw({ team: { holdout, weights: [1, 1, 1] } }));
      expect(live.team.holdout).toBe(0.1);
      expect(overrideWeights(live.team)).toEqual([1, 1, 1]);
    });

    const flags: [string, unknown][] = [
      ['a string', 'false'],
      ['a number', 0],
      ['null', null],
    ];
    it.each(flags)('enabled: %s', (_, enabled) => {
      const live = applyOverrides(config, raw({ hero: { enabled, holdout: 0.5 } }));
      expect(live.hero.enabled).toBeUndefined();
      expect(live.hero.holdout).toBe(0.5);
    });
  });

  it('ignores a key the code does not declare', () => {
    const live = applyOverrides(config, { ghost: { enabled: false, weights: [1, 1] } });
    expect(Object.keys(live)).toEqual(['hero', 'team']);
  });

  it('never takes variants from the overrides', () => {
    const live = applyOverrides(config, raw({ hero: { variants: ['x', 'y'], weights: [1, 2] } }));
    expect(live.hero.variants).toEqual(['a', 'b']);
    expect(overrideWeights(live.hero)).toEqual([1, 2]);
  });

  it('ignores an override that is not an object', () => {
    for (const entry of [null, false, 3, 'off', [1, 2]]) {
      expect(applyOverrides(config, raw({ hero: entry })).hero).toEqual(config.hero);
    }
  });

  it('treats overrides that are not a map as none', () => {
    for (const value of [[], 'x', 42, true]) expect(applyOverrides(config, raw(value))).toEqual(config);
  });

  it('reads own keys only', () => {
    const proto = { hero: { enabled: false } };
    expect(applyOverrides(config, raw(Object.create(proto))).hero.enabled).toBeUndefined();
  });

  it('feeds the pickers: a kill switch and re-weighting take effect', () => {
    // Without an override the split is equal: u = 0 is the control.
    expect(pickVariant(applyOverrides(config, {}), 'hero', () => 0)).toBe('a');
    const off = applyOverrides(config, { hero: { enabled: false } });
    expect(pickVariant(off, 'hero', () => 0.99)).toBe('a');
    expect(resolveVariant(off, 'hero', 'b')).toBe('a');
    const allB = applyOverrides(config, { hero: { weights: [0, 1] } });
    expect(pickVariant(allB, 'hero', () => 0)).toBe('b');
  });

  it('keeps the variant unions narrow', () => {
    const live = applyOverrides(config, {});
    expectTypeOf(pickVariant(live, 'team')).toEqualTypeOf<'a' | 'b' | 'c'>();
    expectTypeOf<Variant<typeof live, 'hero'>>().toEqualTypeOf<'a' | 'b'>();
  });
});
