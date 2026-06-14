import { describe, expect, it } from 'vitest';

import { and, not, or, spec, type Spec, type Specification } from '../src/specification';

const positive: Spec<number> = (n) => n > 0;
const even: Spec<number> = (n) => n % 2 === 0;

describe('Specification', () => {
  it('and requires both', () => {
    const s = spec(positive).and(even);
    expect(s.holds(4)).toBe(true);
    expect(s.holds(3)).toBe(false); // odd
    expect(s.holds(-2)).toBe(false); // negative
  });

  it('or requires either', () => {
    const s = spec(positive).or(even);
    expect(s.holds(3)).toBe(true); // positive
    expect(s.holds(-2)).toBe(true); // even
    expect(s.holds(-3)).toBe(false); // neither
  });

  it('not inverts', () => {
    expect(spec(even).not().holds(3)).toBe(true);
    expect(spec(even).not().holds(4)).toBe(false);
  });

  it('nests arbitrarily', () => {
    // positive AND (even OR NOT >100)
    const s = spec(positive).and(spec(even).or(not((n: number) => n > 100)));
    expect(s.holds(4)).toBe(true); // positive, even
    expect(s.holds(7)).toBe(true); // positive, odd but <= 100
    expect(s.holds(101)).toBe(false); // positive, odd, > 100
  });

  it('accepts a bare predicate anywhere a spec is wanted (Rust blanket Fn impl)', () => {
    const isEven = (n: number) => n % 2 === 0;
    expect(spec(isEven).holds(4)).toBe(true);
    expect(spec(isEven).not().holds(3)).toBe(true);
  });

  it('composes object specs and predicates interchangeably', () => {
    const published: Specification<{ published: boolean }> = {
      holds: (b) => b.published,
    };
    const featured = spec(published).and((b) => 'published' in b);
    expect(featured.holds({ published: true })).toBe(true);
    expect(featured.holds({ published: false })).toBe(false);
  });

  it('erases to a plain interface for heterogeneous rule sets', () => {
    const rules: Array<Specification<number>> = [spec((n: number) => n > 0), spec((n: number) => n % 2 === 0)];
    expect(rules.every((r) => r.holds(4))).toBe(true);
    expect(rules.every((r) => r.holds(3))).toBe(false);
  });

  it('free-function combinators mirror the fluent ones', () => {
    expect(and(positive, even).holds(4)).toBe(true);
    expect(or(positive, even).holds(-2)).toBe(true);
    expect(not(even).holds(3)).toBe(true);
  });
});
