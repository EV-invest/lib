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

// Country codes and their digit lengths (shared by e.g. US+Canada under 1,
// Russia+Kazakhstan under 7). Codes are stored as strings so "1" doesn't match
// "+1" prefix-interpreted-as-integer. The table is ordered longest-first so a
// prefix lookup finds the most specific match first (e.g. "1242" before "1").
//
// This is NOT an exhaustive dial-code table — it covers the 1–3 digit country
// codes defined by ITU-T. Exhaustive validation would require a full numbering
// plan database, which is out of scope for a zero-dep library.
const COUNTRY_CODES: ReadonlySet<string> = new Set([
  // Zone 1 — North American Numbering Plan
  '1',
  // Zone 2 — Africa (selected)
  '20', '211', '212', '213', '216', '218', '220', '221', '222', '223', '224', '225',
  '226', '227', '228', '229', '230', '231', '232', '233', '234', '235', '236', '237',
  '238', '239', '240', '241', '242', '243', '244', '245', '246', '247', '248', '249',
  '250', '251', '252', '253', '254', '255', '256', '257', '258', '260', '261', '262',
  '263', '264', '265', '266', '267', '268', '269',
  // Zone 3 — Europe
  '30', '31', '32', '33', '34', '350', '351', '352', '353', '354', '355', '356',
  '357', '358', '359',
  // Zone 4 — Europe (cont.)
  '36', '370', '371', '372', '373', '374', '375', '376', '377', '378', '379',
  '380', '381', '382', '383', '385', '386', '387', '389',
  '40', '41', '42', '43', '44', '45', '46', '47', '48', '49',
  // Zone 5 — South/Latin America
  '500', '501', '502', '503', '504', '505', '506', '507', '508', '509',
  '51', '52', '53', '54', '55', '56', '57', '58',
  '590', '591', '592', '593', '594', '595', '596', '597', '598', '599',
  // Zone 6 — Southeast Asia / Oceania
  '60', '61', '62', '63', '64', '65', '66',
  '670', '672', '673', '674', '675', '676', '677', '678', '679',
  '680', '681', '682', '683', '685', '686', '687', '688', '689',
  '690', '691', '692',
  // Zone 7 — Russia, Kazakhstan
  '7',
  // Zone 8 — East Asia / Special services
  '81', '82', '83', '84', '850', '852', '853', '855', '856',
  '86', '870', '872', '873', '874', '878', '879',
  '880', '881', '882', '883', '886', '888',
  // Zone 9 — West/South Asia
  '90', '91', '92', '93', '94', '95', '960', '961', '962', '963', '964', '965',
  '966', '967', '968', '969', '970', '971', '972', '973', '974', '975', '976',
  '977', '979',
  '98', '992', '993', '994', '995', '996', '998',
]);

// ── Constants ─────────────────────────────────────────────────────────────────

const E164_REGEX = /^\+(\d{1,3})(\d+)$/;
const MIN_DIGITS = 7; // shortest national number + country code
const MAX_DIGITS = 15; // ITU-T E.164 limit

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
  if (cc === undefined || !COUNTRY_CODES.has(cc)) {
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
    if (COUNTRY_CODES.has(three)) return three;
  }
  if (digits.length >= 2) {
    const two = digits.slice(0, 2);
    if (COUNTRY_CODES.has(two)) return two;
  }
  const one = digits.slice(0, 1);
  if (COUNTRY_CODES.has(one)) return one;
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
