import { describe, expect, it } from 'vitest';
import { Email, validateEmail } from '../src/index';
import type { EmailError } from '../src/index';

// ── validateEmail ──────────────────────────────────────────────────────────────

describe('validateEmail', () => {
  describe('valid addresses', () => {
    const valid = [
      'user@example.com',
      'a@b.cd',
      'first.last@sub.example.co.uk',
      'user+tag@example.com',
      '123@numbers.org',
      'User@Example.COM',
    ];

    for (const raw of valid) {
      it(`accepts ${raw}`, () => {
        expect(validateEmail(raw)).toEqual({ ok: true });
      });
    }
  });

  describe('rejected addresses', () => {
    it('rejects empty string', () => {
      const result = validateEmail('') as EmailError;
      expect(result.ok).toBe(false);
      expect(result.code).toBe('empty');
    });

    it('rejects missing @', () => {
      const result = validateEmail('userexample.com') as EmailError;
      expect(result.ok).toBe(false);
      expect(result.code).toBe('no_at');
    });

    it('rejects multiple @', () => {
      const result = validateEmail('a@b@c.com') as EmailError;
      expect(result.ok).toBe(false);
    });

    it('rejects empty local part', () => {
      const result = validateEmail('@example.com') as EmailError;
      expect(result.ok).toBe(false);
      expect(result.code).toBe('empty_local');
    });

    it('rejects empty domain', () => {
      const result = validateEmail('user@') as EmailError;
      expect(result.ok).toBe(false);
      expect(result.code).toBe('empty_domain');
    });

    it('rejects no TLD', () => {
      const result = validateEmail('user@localhost') as EmailError;
      expect(result.ok).toBe(false);
      expect(result.code).toBe('no_tld');
    });

    it('rejects whitespace', () => {
      expect(validateEmail('user @example.com').ok).toBe(false);
      expect(validateEmail('user@example.com\n').ok).toBe(false);
    });

    it('rejects local part too long', () => {
      const longLocal = 'a'.repeat(65) + '@example.com';
      const result = validateEmail(longLocal) as EmailError;
      expect(result.ok).toBe(false);
      expect(result.code).toBe('local_too_long');
    });

    it('rejects domain too long', () => {
      const longDomain = 'a'.repeat(256);
      const result = validateEmail(`user@${longDomain}`) as EmailError;
      expect(result.ok).toBe(false);
      expect(result.code).toBe('domain_too_long');
    });

    it('rejects total too long', () => {
      const long = 'a'.repeat(255);
      const result = validateEmail(long) as EmailError;
      expect(result.ok).toBe(false);
      // Should fail with either too_long or no_at
      expect(['too_long', 'no_at']).toContain(result.code);
    });
  });
});

// ── Email.from ─────────────────────────────────────────────────────────────────

describe('Email.from', () => {
  it('constructs and normalises to lowercase', () => {
    const e = Email.from('User@Example.COM');
    expect(Email.raw(e)).toBe('user@example.com');
  });

  it('throws on invalid input', () => {
    expect(() => Email.from('notanemail')).toThrow();
    expect(() => Email.from('')).toThrow();
  });
});

// ── Email.fromUnsafe / raw ─────────────────────────────────────────────────────

describe('Email.fromUnsafe and raw', () => {
  it('round-trips without validation', () => {
    const e = Email.fromUnsafe('User@Example.COM');
    expect(Email.raw(e)).toBe('User@Example.COM');
  });

  it('accepts any string (no-validation contract)', () => {
    const e = Email.fromUnsafe('');
    expect(Email.raw(e)).toBe('');
  });
});

// ── Email.isEmail ──────────────────────────────────────────────────────────────

describe('Email.isEmail', () => {
  it('returns true for a valid address', () => {
    expect(Email.isEmail('user@example.com')).toBe(true);
  });

  it('returns false for an invalid address', () => {
    expect(Email.isEmail('notanemail')).toBe(false);
    expect(Email.isEmail('')).toBe(false);
  });

  it('works as a type guard with a constructed Email', () => {
    const e = Email.from('user@example.com');
    expect(Email.isEmail(e)).toBe(true);
  });

  it('returns false for non-strings', () => {
    expect(Email.isEmail(42)).toBe(false);
    expect(Email.isEmail(null)).toBe(false);
    expect(Email.isEmail({})).toBe(false);
  });
});

// ── Email.localPart / domain ───────────────────────────────────────────────────

describe('Email.localPart and domain', () => {
  it('extracts local part and domain', () => {
    const e = Email.from('user@example.com');
    expect(Email.localPart(e)).toBe('user');
    expect(Email.domain(e)).toBe('example.com');
  });

  it('returns lowercase even when constructed from mixed case', () => {
    const e = Email.from('User.Name@Sub.Example.COM');
    expect(Email.localPart(e)).toBe('user.name');
    expect(Email.domain(e)).toBe('sub.example.com');
  });
});

// ── Email.parseInput ───────────────────────────────────────────────────────────

describe('Email.parseInput', () => {
  it('trims surrounding whitespace', () => {
    const e = Email.parseInput('  user@example.com  ');
    expect(e).toBeDefined();
    expect(Email.raw(e!)).toBe('user@example.com');
  });

  it('normalises to lowercase', () => {
    const e = Email.parseInput('  User@Example.COM  ');
    expect(e).toBeDefined();
    expect(Email.raw(e!)).toBe('user@example.com');
  });

  it('returns undefined for empty after trim', () => {
    expect(Email.parseInput('')).toBeUndefined();
    expect(Email.parseInput('   ')).toBeUndefined();
  });

  it('returns undefined for invalid input', () => {
    expect(Email.parseInput('notanemail')).toBeUndefined();
  });
});
