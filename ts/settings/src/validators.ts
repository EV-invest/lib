/**
 * Validators — how a raw env string becomes a typed value, and the three
 * wrappers that mirror the Rust field grammar: {@link optional} ↔ `Option<T>`,
 * {@link withDefault} ↔ `= "literal"`, {@link secret} ↔ `#[secret]`.
 *
 * The shared Rust↔TS parsing contract lives here: `bool` accepts
 * `true`/`false`/`1`/`0` case-insensitively, {@link list} is comma-separated
 * with trimmed items and empty items dropped, and scalars are **not** trimmed —
 * `" 8080"` is invalid for a number on both sides.
 */

/**
 * Parses one env value into a typed setting. Build one with {@link str},
 * {@link num}, {@link int}, {@link port}, {@link bool}, {@link url},
 * {@link list}, or {@link oneOf}, then refine it with {@link optional},
 * {@link withDefault}, and {@link secret}.
 *
 * The named validators are idiomatic TS and deliberately *not* a 1:1 copy of
 * the Rust side, where types parse themselves through the `FromEnvValue` trait
 * (`port: u16`, `bind: SocketAddr`); what both sides share is the semantics
 * listed in the module docs.
 */
export interface Validator<T> {
  /** Human name used in error messages (e.g. `number`). */
  readonly kind: string;
  /** Unset is fine and yields `undefined` — the mirror of `Option<T>`. */
  readonly optional: boolean;
  /** Redact the raw value in error output — the mirror of `#[secret]`. */
  readonly secret: boolean;
  /** Used when the variable is unset; parsed by the same rules as an env value. */
  readonly defaultLiteral: string | undefined;
  /** Parse a raw (non-empty) env string; throws `Error(message)` when invalid. */
  readonly parse: (raw: string) => T;
}

function base<T>(kind: string, parse: (raw: string) => T): Validator<T> {
  return { kind, optional: false, secret: false, defaultLiteral: undefined, parse };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Any string, taken verbatim (no trimming). */
export function str(): Validator<string> {
  return base('string', (raw) => raw);
}

/** Contract: `true`/`1` and `false`/`0`, case-insensitive, no trimming. */
export function bool(): Validator<boolean> {
  return base('boolean', (raw) => {
    const lower = raw.toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
    throw new Error('expected one of `true`, `false`, `1`, `0` (case-insensitive)');
  });
}

// Rust `f64::from_str` grammar minus `inf`/`NaN`: sign, digits with an
// optional point (`5.`/`.5` are valid), optional exponent. Rejects the extra
// JS `Number()` literals (`0x10`, `0b101`, `0o17`) so both sides agree.
const FLOAT_GRAMMAR = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const INT_GRAMMAR = /^[+-]?\d+$/;

/**
 * A finite decimal number (point/exponent forms included). Not trimmed:
 * `" 3"` is invalid, like Rust's `FromStr`. Divergence from the Rust mirror:
 * Rust `f64` also accepts `inf`/`NaN` — this validator requires finite.
 */
export function num(): Validator<number> {
  return base('number', (raw) => {
    if (!FLOAT_GRAMMAR.test(raw)) throw new Error('expected a finite number');
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error('expected a finite number');
    return value;
  });
}

/**
 * A plain decimal integer (no exponent/point/hex forms — Rust integer
 * `FromStr` grammar), limited to the safe range `±(2^53 - 1)`: JS numbers are
 * doubles, so bigger values would silently round (Rust 64-bit integers parse
 * them exactly — use {@link str} for 64-bit ids).
 */
export function int(): Validator<number> {
  return base('integer', (raw) => {
    if (!INT_GRAMMAR.test(raw)) throw new Error('expected an integer');
    const value = Number(raw);
    if (!Number.isSafeInteger(value)) throw new Error('expected a safe integer (within ±(2^53 - 1))');
    return value;
  });
}

/** A TCP/UDP port: an integer in `1..=65535`. */
export function port(): Validator<number> {
  const inner = int();
  return base('port', (raw) => {
    const value = inner.parse(raw);
    if (value < 1 || value > 65535) throw new Error('expected a port (1-65535)');
    return value;
  });
}

/** An absolute URL (validated with `new URL`, returned as the original string). */
export function url(): Validator<string> {
  return base('url', (raw) => {
    // `new URL` silently strips whitespace/tabs/newlines; a padded value would
    // validate here and then break whatever consumes the raw string.
    if (raw === '' || /\s/.test(raw)) throw new Error('expected an absolute URL');
    try {
      new URL(raw);
    } catch {
      throw new Error('expected an absolute URL');
    }
    return raw;
  });
}

/**
 * One of a fixed set of strings, narrowed to the literal union:
 *
 * ```ts
 * const env = oneOf(['development', 'production']); // Validator<'development' | 'production'>
 * ```
 */
export function oneOf<const V extends string>(values: readonly V[]): Validator<V> {
  const expected = `expected one of ${values.map((value) => `\`${value}\``).join(', ')}`;
  return base('choice', (raw) => {
    if ((values as readonly string[]).includes(raw)) return raw as V;
    throw new Error(expected);
  });
}

/**
 * Contract: split on `,`, trim each item, drop empty items, parse the rest
 * with `item` (default {@link str}). Item numbering in errors counts the kept
 * items from 1 and never leaks the item value, so secret lists stay
 * redactable. Wrap the *list* in {@link secret}/{@link optional}, not the item.
 */
export function list(): Validator<readonly string[]>;
export function list<T>(item: Validator<T>): Validator<readonly T[]>;
export function list<T>(item?: Validator<T>): Validator<readonly (T | string)[]> {
  const inner = item ?? str();
  return base('list', (raw) =>
    raw
      .split(',')
      .map((piece) => piece.trim())
      .filter((piece) => piece !== '')
      .map((piece, index) => {
        try {
          return inner.parse(piece);
        } catch (error) {
          throw new Error(`item ${index + 1}: ${messageOf(error)}`);
        }
      }),
  );
}

/**
 * Unset (or empty) is fine and yields `undefined` — the mirror of a Rust
 * `Option<T>` field. Cannot be combined with {@link withDefault}: a defaulted
 * setting is always present ({@link createSettings} rejects the combination).
 */
export function optional<T>(validator: Validator<T>): Validator<T | undefined> {
  return { ...validator, optional: true };
}

/**
 * Fall back to `literal` when the variable is unset. The literal goes through
 * the exact same parsing rules as an env value — the mirror of the Rust
 * `= "literal"` field default.
 */
export function withDefault<T>(validator: Validator<T>, literal: string): Validator<T> {
  return { ...validator, defaultLiteral: literal };
}

/**
 * Redact the raw value in error output — the mirror of `#[secret]`. Note that
 * unlike Rust (whose generated `Debug` prints `***`), JS has no debug-print
 * boundary: `console.log(settings.TOKEN)` prints the real value. The redaction
 * covers what the *library* emits: `SettingsError` messages and issues.
 */
export function secret<T>(validator: Validator<T>): Validator<T> {
  return { ...validator, secret: true };
}
