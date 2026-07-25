import { describe, expect, it } from 'vitest';
import { PhoneNumber, validatePhoneNumber } from '../src/index';
import type { PhoneNumberError } from '../src/index';

// ── validatePhoneNumber ───────────────────────────────────────────────────────

describe('validatePhoneNumber', () => {
  describe('valid numbers', () => {
    const valid = [
      '+12345678901', // US
      '+442012345678', // UK
      '+8613812345678', // China
      '+79161234567', // Russia
      '+818012345678', // Japan
      '+33123456789', // France
      '+61412345678', // Australia
      '+971501234567', // UAE
      '+85212345678', // Hong Kong (3-digit cc)
      '+12421234567', // Bahamas (1242, 4-digit cc that starts with 1)
      '+12011234567', // US (201 area code)
    ];

    for (const raw of valid) {
      it(`accepts ${raw}`, () => {
        expect(validatePhoneNumber(raw)).toEqual({ ok: true });
      });
    }
  });

  describe('rejected numbers', () => {
    it('rejects empty string', () => {
      const result = validatePhoneNumber('') as PhoneNumberError;
      expect(result.ok).toBe(false);
      expect(result.code).toBe('empty');
    });

    it('rejects missing + prefix', () => {
      const result = validatePhoneNumber('12345678901') as PhoneNumberError;
      expect(result.ok).toBe(false);
      expect(result.code).toBe('no_plus_prefix');
    });

    it('rejects + alone', () => {
      const result = validatePhoneNumber('+') as PhoneNumberError;
      expect(result.ok).toBe(false);
      expect(result.code).toBe('non_digit_chars');
    });

    it('rejects spaces in canonical form', () => {
      const result = validatePhoneNumber('+1 234 567 8901') as PhoneNumberError;
      expect(result.ok).toBe(false);
      expect(result.code).toBe('non_digit_chars');
    });

    it('rejects hyphens', () => {
      const result = validatePhoneNumber('+1-234-567-8901') as PhoneNumberError;
      expect(result.ok).toBe(false);
      expect(result.code).toBe('non_digit_chars');
    });

    it('rejects parentheses', () => {
      const result = validatePhoneNumber('+1(234)5678901') as PhoneNumberError;
      expect(result.ok).toBe(false);
      expect(result.code).toBe('non_digit_chars');
    });

    it('rejects letters', () => {
      const result = validatePhoneNumber('+1800CALLNOW') as PhoneNumberError;
      expect(result.ok).toBe(false);
      expect(result.code).toBe('non_digit_chars');
    });

    it('rejects too short (< 7 digits)', () => {
      const result = validatePhoneNumber('+123456') as PhoneNumberError;
      expect(result.ok).toBe(false);
      expect(result.code).toBe('too_short');
    });

    it('rejects too long (> 15 digits)', () => {
      const result = validatePhoneNumber('+1234567890123456') as PhoneNumberError;
      expect(result.ok).toBe(false);
      expect(result.code).toBe('too_long');
    });

    it('rejects unknown country code', () => {
      const result = validatePhoneNumber('+9991234567') as PhoneNumberError;
      expect(result.ok).toBe(false);
      expect(result.code).toBe('invalid_country_code');
    });

    it('rejects 0 country code', () => {
      const result = validatePhoneNumber('+0123456789') as PhoneNumberError;
      expect(result.ok).toBe(false);
      expect(result.code).toBe('invalid_country_code');
    });
  });

  describe('boundary values', () => {
    it('accepts exactly 7 digits after + (minimum)', () => {
      // 1-digit country code + 6 national digits = 7 total after +.
      expect(validatePhoneNumber('+7123456')).toEqual({ ok: true });
    });

    it('accepts exactly 15 digits', () => {
      // Country code 1 + 14 digits = 15 total after +
      expect(validatePhoneNumber('+123456789012345')).toEqual({ ok: true });
    });

    it('rejects exactly 16 digits', () => {
      const result = validatePhoneNumber('+12345678901234567') as PhoneNumberError;
      expect(result.ok).toBe(false);
      expect(result.code).toBe('too_long');
    });
  });
});

// ── PhoneNumber.from ──────────────────────────────────────────────────────────

describe('PhoneNumber.from', () => {
  it('constructs a valid PhoneNumber', () => {
    const pn = PhoneNumber.from('+12345678901');
    expect(PhoneNumber.raw(pn)).toBe('+12345678901');
  });

  it('throws PhoneNumberError on invalid input', () => {
    let thrown: PhoneNumberError | undefined;
    try {
      PhoneNumber.from('not-a-number');
    } catch (error) {
      thrown = error as PhoneNumberError;
    }
    expect(thrown!.ok).toBe(false);
    expect(thrown!.code).toBeDefined();
    expect(thrown!.message).toBeTruthy();
  });
});

// ── PhoneNumber.fromUnsafe / raw ──────────────────────────────────────────────

describe('PhoneNumber.fromUnsafe and raw', () => {
  it('round-trips a value', () => {
    const pn = PhoneNumber.fromUnsafe('+9990000000');
    expect(PhoneNumber.raw(pn)).toBe('+9990000000');
  });

  it('does not validate — accepts anything', () => {
    const pn = PhoneNumber.fromUnsafe('');
    expect(PhoneNumber.raw(pn)).toBe('');
  });
});

// ── PhoneNumber.isPhoneNumber ─────────────────────────────────────────────────

describe('PhoneNumber.isPhoneNumber', () => {
  it('returns true for a constructed PhoneNumber', () => {
    const pn = PhoneNumber.from('+12345678901');
    expect(PhoneNumber.isPhoneNumber(pn)).toBe(true);
  });

  it('returns true for a string that passes E.164 validation', () => {
    expect(PhoneNumber.isPhoneNumber('+12345678901')).toBe(true);
  });

  it('returns false for an invalid string', () => {
    expect(PhoneNumber.isPhoneNumber('+')).toBe(false);
    expect(PhoneNumber.isPhoneNumber('')).toBe(false);
  });

  it('returns false for non-strings', () => {
    expect(PhoneNumber.isPhoneNumber(123)).toBe(false);
    expect(PhoneNumber.isPhoneNumber(null)).toBe(false);
    expect(PhoneNumber.isPhoneNumber(undefined)).toBe(false);
    expect(PhoneNumber.isPhoneNumber({})).toBe(false);
  });
});

// ── PhoneNumber.format ───────────────────────────────────────────────────────

describe('PhoneNumber.format', () => {
  it('formats a US number', () => {
    const pn = PhoneNumber.from('+12345678901');
    expect(PhoneNumber.format(pn)).toBe('+1 234 567 8901');
  });

  it('formats a UK number', () => {
    const pn = PhoneNumber.from('+442012345678');
    // Left-to-right grouping: 201 | 234 | 5678
    expect(PhoneNumber.format(pn)).toBe('+44 201 234 5678');
  });

  it('formats a Russian number', () => {
    const pn = PhoneNumber.from('+79161234567');
    expect(PhoneNumber.format(pn)).toBe('+7 916 123 4567');
  });

  it('uses custom separator', () => {
    const pn = PhoneNumber.from('+12345678901');
    expect(PhoneNumber.format(pn, '-')).toBe('+1-234-567-8901');
  });
});

// ── PhoneNumber.formatLocal ──────────────────────────────────────────────────

describe('PhoneNumber.formatLocal', () => {
  it('replaces + with 00', () => {
    const pn = PhoneNumber.from('+12345678901');
    expect(PhoneNumber.formatLocal(pn)).toBe('00 1 234 567 8901');
  });

  it('uses custom prefix', () => {
    const pn = PhoneNumber.from('+12345678901');
    expect(PhoneNumber.formatLocal(pn, '011')).toBe('011 1 234 567 8901');
  });
});

// ── PhoneNumber.parseInput ───────────────────────────────────────────────────

describe('PhoneNumber.parseInput', () => {
  it('parses with spaces', () => {
    const pn = PhoneNumber.parseInput('+1 234 567 8901');
    expect(pn).toBeDefined();
    expect(PhoneNumber.raw(pn!)).toBe('+12345678901');
  });

  it('parses with hyphens', () => {
    const pn = PhoneNumber.parseInput('1-234-567-8901');
    expect(pn).toBeDefined();
    expect(PhoneNumber.raw(pn!)).toBe('+12345678901');
  });

  it('parses with parentheses', () => {
    const pn = PhoneNumber.parseInput('+1 (234) 567-8901');
    expect(pn).toBeDefined();
    expect(PhoneNumber.raw(pn!)).toBe('+12345678901');
  });

  it('parses with dots', () => {
    const pn = PhoneNumber.parseInput('+1.234.567.8901');
    expect(pn).toBeDefined();
    expect(PhoneNumber.raw(pn!)).toBe('+12345678901');
  });

  it('adds missing +', () => {
    const pn = PhoneNumber.parseInput('12345678901');
    expect(pn).toBeDefined();
  });

  it('returns undefined for invalid input', () => {
    expect(PhoneNumber.parseInput('short')).toBeUndefined();
    expect(PhoneNumber.parseInput('')).toBeUndefined();
  });
});

// ── Brand (generic branded primitive) ─────────────────────────────────────────

import { Brand, type Branded } from '../src/index';

describe('Brand', () => {
  it('round-trips a branded value', () => {
    type Email = Branded<string, 'Email'>;
    const email = Brand.fromRaw<string, 'Email'>('a@b.com');
    expect(Brand.raw(email)).toBe('a@b.com');
  });
});
