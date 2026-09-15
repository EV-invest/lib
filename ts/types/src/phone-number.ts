/**
 * `PhoneNumber` — an E.164 phone number as a branded string (TypeObject).
 *
 * The canonical form is `+<country code><subscriber number>`, e.g. `+12345678901`.
 * No spaces, hyphens, or other separators — just `+` and digits. Validation
 * follows ITU-T E.164: 7–15 digits after the `+`, with a valid country code
 * prefix (1–3 digits, checked against a known range).
 *
 * This module is I/O-free and works identically on the server and in the browser.
 */

import { Brand, type Branded } from './brand';
import { COUNTRY_CODES, MAX_DIGITS, MIN_DIGITS } from './generated/e164';

// ── Error ─────────────────────────────────────────────────────────────────────

/** Structured validation error returned by {@link PhoneNumber.validate}. */
export interface PhoneNumberError {
  readonly ok: false;
  /** Machine-readable code — stable across versions. */
  readonly code:
    | 'empty'
    | 'no_plus_prefix'
    | 'non_digit_chars'
    | 'too_short'
    | 'too_long'
    | 'invalid_country_code';
  /** Human-readable description (safe for user display). */
  readonly message: string;
}

/** Successful validation result. */
export interface PhoneNumberOk {
  readonly ok: true;
}

/** Result of {@link PhoneNumber.validate}. */
export type PhoneNumberValidation = PhoneNumberOk | PhoneNumberError;

// ── Branded type ───────────────────────────────────────────────────────────────

/** An E.164 phone number string, validated at construction time. */
export type PhoneNumber = Branded<string, 'PhoneNumber'>;

// ── Country-code table ────────────────────────────────────────────────────────

// Codes are strings so "1" doesn't match "+1" prefix-interpreted-as-integer; the
// prefix lookup below tries longest-first so the most specific match wins (e.g.
// "1242" before "1").
//
// This is NOT an exhaustive dial-code table — it covers the 1–3 digit country
// codes defined by ITU-T. Exhaustive validation would require a full numbering
// plan database, which is out of scope for a zero-dep library.
const COUNTRY_CODE_SET: ReadonlySet<string> = new Set(COUNTRY_CODES);

// ── Constants ─────────────────────────────────────────────────────────────────

// Non-digit characters that are commonly used in user input and are safe to
// strip during `parseInput`.
const NON_DIGIT_STRIP = /[\s.\-()]/g;

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate a raw string as an E.164 phone number. Returns a structured result —
 * use this when you want to surface errors to the user rather than throwing.
 *
 * Rules:
 * 1. Non-empty
 * 2. Must start with `+`
 * 3. Must contain only digits after the `+` (no spaces, hyphens, etc.)
 * 4. 7–15 digits total after the `+`
 * 5. Country code must be in the known range (1–3 digits)
 */
export function validatePhoneNumber(value: string): PhoneNumberValidation {
  if (value.length === 0) {
    return { ok: false, code: 'empty', message: 'Phone number must not be empty' };
  }
  if (value[0] !== '+') {
    return { ok: false, code: 'no_plus_prefix', message: 'Phone number must start with +' };
  }

  const afterPlus = value.slice(1);

  if (afterPlus.length === 0) {
    return { ok: false, code: 'non_digit_chars', message: 'Phone number must have digits after the +' };
  }

  if (!/^\d+$/.test(afterPlus)) {
    return { ok: false, code: 'non_digit_chars', message: 'Phone number must contain only digits after the +' };
  }

  if (afterPlus.length < MIN_DIGITS) {
    return {
      ok: false,
      code: 'too_short',
      message: `Phone number must have at least ${MIN_DIGITS} digits (has ${afterPlus.length})`,
    };
  }

  if (afterPlus.length > MAX_DIGITS) {
    return {
      ok: false,
      code: 'too_long',
      message: `Phone number must have at most ${MAX_DIGITS} digits (has ${afterPlus.length})`,
    };
  }

  const cc = extractCountryCode(afterPlus);
  if (cc === undefined || !COUNTRY_CODE_SET.has(cc)) {
    return {
      ok: false,
      code: 'invalid_country_code',
      message: `Unknown country code: +${cc ?? afterPlus.slice(0, 3)}`,
    };
  }

  return { ok: true };
}

/** Extract the country code (1–3 digits) from a digit-only string. */
function extractCountryCode(digits: string): string | undefined {
  // Try 3-digit, then 2, then 1 — longest match wins.
  if (digits.length >= 3) {
    const three = digits.slice(0, 3);
    if (COUNTRY_CODE_SET.has(three)) return three;
  }
  if (digits.length >= 2) {
    const two = digits.slice(0, 2);
    if (COUNTRY_CODE_SET.has(two)) return two;
  }
  const one = digits.slice(0, 1);
  if (COUNTRY_CODE_SET.has(one)) return one;
  return undefined;
}

// ── TypeObject companion ──────────────────────────────────────────────────────

/**
 * {@link PhoneNumber} companion — factory, type guard, and formatting helpers.
 *
 * @example
 * ```ts
 * const pn = PhoneNumber.from('+12345678901');
 * PhoneNumber.raw(pn);            // '+12345678901'
 * PhoneNumber.format(pn);         // '+1 234 567 8901'
 * PhoneNumber.isPhoneNumber(pn);  // true
 * ```
 */
export const PhoneNumber = {
  // -- Construction ---------------------------------------------------------------

  /**
   * Validate and construct a `PhoneNumber`. Throws {@link PhoneNumberError} on
   * invalid input — use {@link PhoneNumber.validate} for the non-throwing variant.
   */
  from(value: string): PhoneNumber {
    const result = validatePhoneNumber(value);
    if (!result.ok) throw result;
    return Brand.fromRaw<string, 'PhoneNumber'>(value);
  },

  /**
   * Construct a `PhoneNumber` from a trusted source without validation.
   * The caller guarantees the value is a valid E.164 string.
   *
   * Use this when deserialising from a database or an already-validated API
   * response — never on user input.
   */
  fromUnsafe(value: string): PhoneNumber {
    return Brand.fromRaw<string, 'PhoneNumber'>(value);
  },

  /** Recover the underlying E.164 string. */
  raw(pn: PhoneNumber): string {
    return Brand.raw(pn);
  },

  // -- Validation ----------------------------------------------------------------

  /**
   * Validate without throwing. Returns `{ ok: true }` or a structured error.
   * Use this in form handlers where you want to display the error inline.
   */
  validate: validatePhoneNumber,

  // -- Type guard ----------------------------------------------------------------

  /**
   * Runtime type guard — returns `true` when `value` is a `PhoneNumber`
   * constructed by {@link PhoneNumber.from} (or {@link PhoneNumber.fromUnsafe}).
   *
   * Because the brand is type-level only, this checks that the value is a
   * string whose shape matches E.164. It does **not** prove the value went
   * through `from` — but a match is safe to treat as a `PhoneNumber`.
   */
  isPhoneNumber(value: unknown): value is PhoneNumber {
    return typeof value === 'string' && validatePhoneNumber(value).ok;
  },

  // -- Formatting ----------------------------------------------------------------

  /**
   * Format for human display: `+1 234 567 8901`.
   *
   * Groups national digits left-to-right in chunks of 3, with the
   * rightmost group getting the remainder. The separator defaults to
   * a space (U+0020).
   *
   * This is a generic heuristic — phone number grouping conventions
   * vary by country (US 3-3-4, UK 2-4-4, etc.), and a correct
   * per-country formatter would require a full numbering-plan database.
   * The output is always a readable, dialable string.
   */
  format(pn: PhoneNumber, separator = ' '): string {
    const raw = Brand.raw(pn);
    const afterPlus = raw.startsWith('+') ? raw.slice(1) : raw;
    // Extract country code using the same logic as validation.
    const cc = extractCountryCode(afterPlus);
    if (!cc) return raw; // unreachable for validated numbers
    const national = afterPlus.slice(cc.length);
    // Group national digits left-to-right: all groups are 3 digits
    // except the rightmost, which gets the remainder (so 10 digits →
    // 3-3-4, 7 digits → 3-4, 8 digits → 3-5).
    const n = national.length;
    const groups: string[] = [];
    const numFull = Math.floor(n / 3);
    const remainder = n % 3;
    if (numFull <= 1) {
      groups.push(national);
    } else if (remainder === 0) {
      for (let i = 0; i < n; i += 3) groups.push(national.slice(i, i + 3));
    } else {
      let pos = 0;
      for (let i = 0; i < numFull - 1; i++, pos += 3) {
        groups.push(national.slice(pos, pos + 3));
      }
      groups.push(national.slice(pos)); // remainder goes here
    }
    return `+${cc}${separator}${groups.join(separator)}`;
  },

  /**
   * Format for dialing from a local line — the `+` is replaced with the local
   * international prefix (default `00`). `00 1 234 567 8901`
   */
  formatLocal(pn: PhoneNumber, prefix = '00', separator = ' '): string {
    const international = PhoneNumber.format(pn, separator);
    // Strip the `+` and prepend the local prefix with a separator.
    return prefix + separator + international.slice(1);
  },

  // -- User-input parsing --------------------------------------------------------

  /**
   * Parse loosely-formatted user input into a `PhoneNumber`.
   *
   * Strips common formatting characters (spaces, hyphens, dots, parentheses),
   * ensures a leading `+`, and validates. Returns a valid `PhoneNumber` or
   * `undefined` — use this when you want a forgiving input that accepts
   * `1-234-567-8901`, `+1 (234) 567-8901`, etc.
   */
  parseInput(raw: string): PhoneNumber | undefined {
    // Strip formatting noise, preserving digits and an optional leading +.
    const stripped = raw.replace(NON_DIGIT_STRIP, '');
    // Ensure + prefix.
    const normalised = stripped.startsWith('+') ? stripped : `+${stripped}`;
    const result = validatePhoneNumber(normalised);
    if (!result.ok) return undefined;
    return Brand.fromRaw<string, 'PhoneNumber'>(normalised);
  },
} as const;
