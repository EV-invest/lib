/**
 * React bindings for `@evinvest/types`.
 *
 * Provides input hooks that bridge domain TypeObjects and raw `<input>` state —
 * typed values flow in and out, display formatting stays in the hook.
 *
 * @example
 * ```tsx
 * import { usePhoneNumber } from '@evinvest/types/react';
 *
 * function PhoneField() {
 *   const { inputProps, value, error } = usePhoneNumber();
 *   return (
 *     <div>
 *       <input {...inputProps} placeholder="+1 234 567 8901" />
 *       {error && <p role="alert">{error.message}</p>}
 *     </div>
 *   );
 * }
 * ```
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PhoneNumber,
  type PhoneNumberError,
  type PhoneNumberValidation,
  Email,
  type EmailError,
  type EmailValidation,
} from '@evinvest/types';

// ── usePhoneNumber ────────────────────────────────────────────────────────────

export interface UsePhoneNumberOptions {
  /** Initial E.164 value or `PhoneNumber`. */
  initial?: string | PhoneNumber;
  /** Called whenever a valid `PhoneNumber` is parsed from the input. */
  onValid?: (pn: PhoneNumber) => void;
}

export interface UsePhoneNumberResult {
  /**
   * Props to spread onto an `<input>`. Includes `value`, `onChange`, `onBlur`,
   * and `aria-invalid` when the current input is non-empty and invalid.
   */
  readonly inputProps: {
    readonly value: string;
    readonly onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    readonly onBlur: () => void;
    readonly 'aria-invalid': true | undefined;
  };
  /** The canonical `PhoneNumber`, or `undefined` when the input is invalid or empty. */
  readonly value: PhoneNumber | undefined;
  /** What's currently shown in the input (may differ from `value` while the user is typing). */
  readonly displayValue: string;
  /** Structured error for the current input, or `null` when valid or empty. */
  readonly error: PhoneNumberError | null;
  /** Whether the current display value parses to a valid `PhoneNumber`. */
  readonly isValid: boolean;
  /** Reset to a new value (or clear). Pass a string or `PhoneNumber`. */
  readonly reset: (value?: string | PhoneNumber) => void;
}

/**
 * Bind a phone-number input to a `PhoneNumber` TypeObject.
 *
 * The hook owns the input's display state: keystrokes go to a raw string,
 * which is parsed into a `PhoneNumber` on every change. The input shows the
 * raw display value while the user is typing; on blur, it reformats to the
 * canonical international form when the value is valid.
 *
 * This keeps the input responsive — the user sees what they typed, not a
 * reformatted value jumping under their cursor — while still surfacing a
 * validated `PhoneNumber` to the parent.
 */
export function usePhoneNumber(options: UsePhoneNumberOptions = {}): UsePhoneNumberResult {
  const initialDisplay = useMemo(() => resolveDisplay(options.initial), [options.initial]);
  const initialCanonical = useMemo<string>(() => {
    if (!initialDisplay) return '';
    const stripped = initialDisplay.replace(/[\s.\-()]/g, '');
    if (stripped.length === 0 || stripped === '+') return '';
    return stripped.startsWith('+') ? stripped : `+${stripped}`;
  }, [initialDisplay]);
  const [display, setDisplay] = useState<string>(initialDisplay);
  const [validation, setValidation] = useState<PhoneNumberValidation>(() =>
    initialCanonical.length > 0 ? PhoneNumber.validate(initialCanonical) : { ok: true },
  );
  const onValidRef = useRef(options.onValid);
  onValidRef.current = options.onValid;

  // Canonical E.164 form derived from the display string — strips
  // formatting characters and ensures a leading `+`.
  const canonical = useMemo<string>(() => {
    if (display.length === 0) return '';
    const stripped = display.replace(/[\s.\-()]/g, '');
    if (stripped.length === 0 || stripped === '+') return '';
    return stripped.startsWith('+') ? stripped : `+${stripped}`;
  }, [display]);

  const value = useMemo<PhoneNumber | undefined>(() => {
    if (!validation.ok) return undefined;
    if (canonical.length > 0) return PhoneNumber.fromUnsafe(canonical);
    return undefined;
  }, [validation.ok, canonical]);

  // Notify parent on valid changes.
  const prevValueRef = useRef<PhoneNumber | undefined>(value);
  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      if (value) onValidRef.current?.(value);
    }
  }, [value]);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    // React 19 types define both `target` and `currentTarget` as
    // `EventTarget & HTMLInputElement` (backward compat), so `.value`
    // isn't visible on the intersection — narrow to HTMLInputElement.
    const raw = (event.target as HTMLInputElement).value;
    // Strip formatting and normalise to E.164; validate against that.
    const stripped = raw.replace(/[\s.\-()]/g, '');
    const normalised = stripped.startsWith('+') ? stripped : `+${stripped}`;
    setDisplay(raw);
    setValidation(PhoneNumber.validate(normalised));
  }, []);

  const handleBlur = useCallback(() => {
    // Re-format on blur when valid, using the canonical form.
    if (validation.ok && canonical.length > 0) {
      const pn = PhoneNumber.fromUnsafe(canonical);
      setDisplay(PhoneNumber.format(pn));
    }
  }, [validation.ok, canonical]);

  const reset = useCallback((next?: string | PhoneNumber) => {
    const d = resolveDisplay(next);
    if (!d) {
      setDisplay('');
      setValidation({ ok: true });
      return;
    }
    const s = d.replace(/[\s.\-()]/g, '');
    if (s.length === 0 || s === '+') {
      setDisplay(d);
      setValidation({ ok: true });
      return;
    }
    const canon = s.startsWith('+') ? s : `+${s}`;
    setDisplay(d);
    setValidation(PhoneNumber.validate(canon));
  }, []);

  const error: PhoneNumberError | null = validation.ok ? null : validation;
  const isValid = validation.ok && display.length > 0;

  const inputProps = useMemo<UsePhoneNumberResult['inputProps']>(
    () => ({
      value: display,
      onChange: handleChange,
      onBlur: handleBlur,
      'aria-invalid': error ? true : undefined,
    }),
    [display, handleChange, handleBlur, error],
  );

  return { inputProps, value, displayValue: display, error, isValid, reset };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function resolveDisplay(value?: string | PhoneNumber): string {
  if (value === undefined || value === '') return '';
  // If it's already a valid PhoneNumber, format it.
  if (PhoneNumber.isPhoneNumber(value)) return PhoneNumber.format(value);
  // Raw string — return as-is (may be partial/invalid).
  return value;
}

// ── useEmail ───────────────────────────────────────────────────────────────────

export interface UseEmailOptions {
  /** Initial email value (raw string or `Email`). */
  initial?: string | Email;
  /** Called whenever a valid `Email` is parsed from the input. */
  onValid?: (email: Email) => void;
}

export interface UseEmailResult {
  /**
   * Props to spread onto an `<input type="email">`. Includes `value`,
   * `onChange`, `onBlur`, and `aria-invalid` when the current input is
   * non-empty and invalid.
   */
  readonly inputProps: {
    readonly value: string;
    readonly onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    readonly onBlur: () => void;
    readonly 'aria-invalid': true | undefined;
  };
  /** The canonical `Email`, or `undefined` when the input is invalid or empty. */
  readonly value: Email | undefined;
  /** What's currently shown in the input. */
  readonly displayValue: string;
  /** Structured error for the current input, or `null` when valid or empty. */
  readonly error: EmailError | null;
  /** Whether the current display value parses to a valid `Email`. */
  readonly isValid: boolean;
  /** Reset to a new value (or clear). Pass a string or `Email`. */
  readonly reset: (value?: string | Email) => void;
}

/**
 * Bind an email input to an `Email` TypeObject.
 *
 * The hook owns the input's display state. The email is validated on every
 * keystroke; the input shows the raw value while the user is typing and trims
 * on blur.
 */
export function useEmail(options: UseEmailOptions = {}): UseEmailResult {
  const initialDisplay = useMemo(() => {
    if (!options.initial) return '';
    if (Email.isEmail(options.initial)) return Email.raw(options.initial);
    return String(options.initial);
  }, [options.initial]);

  const [display, setDisplay] = useState<string>(initialDisplay);
  const [validation, setValidation] = useState<EmailValidation>(() =>
    initialDisplay.length > 0 ? Email.validate(initialDisplay) : { ok: true },
  );
  const onValidRef = useRef(options.onValid);
  onValidRef.current = options.onValid;

  const value = useMemo<Email | undefined>(() => {
    if (!validation.ok) return undefined;
    if (display.trim().length > 0)
      return Email.fromUnsafe(display.trim().toLowerCase());
    return undefined;
  }, [validation.ok, display]);

  // Notify parent on valid changes.
  const prevValueRef = useRef<Email | undefined>(value);
  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      if (value) onValidRef.current?.(value);
    }
  }, [value]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = (event.target as HTMLInputElement).value;
      setDisplay(raw);
      setValidation(Email.validate(raw.trim()));
    },
    [],
  );

  const handleBlur = useCallback(() => {
    // Trim whitespace and normalise to lowercase on blur when valid.
    if (validation.ok && display.trim().length > 0) {
      setDisplay(display.trim().toLowerCase());
    }
  }, [validation.ok, display]);

  const reset = useCallback((next?: string | Email) => {
    if (!next) {
      setDisplay('');
      setValidation({ ok: true });
      return;
    }
    const raw = typeof next === 'string' ? next : Email.raw(next);
    setDisplay(raw);
    setValidation(Email.validate(raw));
  }, []);

  const error: EmailError | null = validation.ok ? null : validation;
  const isValid = validation.ok && display.trim().length > 0;

  const inputProps = useMemo<UseEmailResult['inputProps']>(
    () => ({
      value: display,
      onChange: handleChange,
      onBlur: handleBlur,
      'aria-invalid': error ? true : undefined,
    }),
    [display, handleChange, handleBlur, error],
  );

  return { inputProps, value, displayValue: display, error, isValid, reset };
}
