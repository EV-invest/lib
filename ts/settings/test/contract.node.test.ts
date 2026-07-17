import { describe, expect, it } from 'vitest';
import { bool, int, list, num, str } from '../src/index';

// Shared Rust↔TS parsing-contract vectors — mirrored byte-for-byte in
// `rust/src/settings/tests.rs` (`mod contract`). Change both sides or neither.
describe('parsing contract', () => {
  it('bool vectors', () => {
    for (const raw of ['true', 'TRUE', 'True', '1']) {
      expect(bool().parse(raw), `raw=${JSON.stringify(raw)}`).toBe(true);
    }
    for (const raw of ['false', 'FALSE', 'False', '0']) {
      expect(bool().parse(raw), `raw=${JSON.stringify(raw)}`).toBe(false);
    }
    for (const raw of ['yes', 'no', '2', ' true', 'true ', '']) {
      expect(() => bool().parse(raw), `raw=${JSON.stringify(raw)} must be invalid`).toThrowError();
    }
  });

  it('list vectors', () => {
    expect(list().parse('a, b ,c')).toEqual(['a', 'b', 'c']);
    expect(list().parse('a,,b')).toEqual(['a', 'b']);
    expect(list().parse(',,')).toEqual([]);
    expect(list(num()).parse('1, 2,3')).toEqual([1, 2, 3]);
    // U+FEFF (BOM) trims like whitespace — JS `trim()` semantics.
    expect(list().parse('a,\uFEFFb')).toEqual(['a', 'b']);
    // Item numbering counts kept items and never leaks the item value.
    let message = '';
    try {
      list(num()).parse(',zzz9,2');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/^item 1: /);
    expect(message).not.toContain('zzz9');
  });

  it('scalars are not trimmed', () => {
    expect(() => num().parse(' 8080')).toThrowError();
    expect(() => num().parse('8080 ')).toThrowError();
    expect(num().parse('8080')).toBe(8080);
    expect(str().parse(' keep me ')).toBe(' keep me ');
  });

  it('number vectors', () => {
    // Integers: plain decimal only, optional sign.
    expect(int().parse('8080')).toBe(8080);
    expect(int().parse('+5')).toBe(5);
    for (const raw of ['1e3', '0x10', '0b101', '0o17', '5.', '5.0']) {
      expect(() => int().parse(raw), `raw=${JSON.stringify(raw)} must be invalid for an integer`).toThrowError();
    }
    // Floats: decimal, point, and exponent forms.
    expect(num().parse('1e3')).toBe(1000);
    expect(num().parse('5.')).toBe(5);
    expect(num().parse('.5')).toBe(0.5);
    expect(() => num().parse('0x10')).toThrowError();
    // Documented divergences (deliberately NOT mirrored): Rust `f64` also
    // accepts `inf`/`NaN` where `num()` requires finite; Rust 64-bit integers
    // parse exactly where `int()` stops at the safe range.
    expect(() => num().parse('NaN')).toThrowError();
    expect(() => num().parse('Infinity')).toThrowError();
    expect(() => int().parse('9007199254740993')).toThrowError(/safe integer/);
  });
});
