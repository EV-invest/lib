import { useEffect, useRef, useState, type FormEvent } from "react";

import type {
  FieldErrors,
  FormStatus,
  SubmitFailure,
  Translate,
  Validated,
} from "../../core/validation";

export interface ValidatedFormOptions<T> {
  /** Field values before the first keystroke; read once, on mount. */
  initial: T;
  /** Cleans the fields into a payload, or answers a translation key per bad field. */
  validate: (fields: T) => Validated<T>;
  /**
   * Delivers the payload. Resolving counts as sent unless the value carries a
   * truthy `error` (the openapi-fetch `{ data, error }` pair) or `ok: false`
   * (a fetch `Response`); throwing counts as a network failure.
   */
  send: (data: T) => Promise<unknown>;
  /** Resolves error keys in {@link ValidatedForm.field}. Without it, keys pass through. */
  t?: Translate;
}

/** Props {@link ValidatedForm.field} hands a `TextField`. */
export interface BoundField {
  name: string;
  value: string;
  onChange: (value: string) => void;
  error: string | undefined;
}

export interface ValidatedForm<T> {
  fields: T;
  /** Translation keys — resolve with your `t` at render. */
  errors: FieldErrors<T>;
  status: FormStatus;
  /** Why the last submit failed, as a key; `null` unless `status === "error"`. */
  failure: SubmitFailure | null;
  edit: (field: keyof T & string) => (value: string) => void;
  field: (field: keyof T & string) => BoundField;
  submit: (event?: FormEvent) => Promise<void>;
  reset: () => void;
}

/**
 * A payload is there exactly when no field failed. TypeScript cannot read that
 * off the union while the field map is still generic, so it is stated once.
 */
const isPayload = <T,>(
  result: Validated<T>,
): result is { data: T; errors?: never } => !result.errors;

function rejected(result: unknown): boolean {
  if (typeof result !== "object" || result === null) return false;
  if ("error" in result && Boolean(result.error)) return true;
  return "ok" in result && result.ok === false;
}

/**
 * Text-field state and the validated submit a marketing form runs on. The
 * caller owns what a payload is (`validate`) and where it goes (`send`); the
 * harness owns the rest — clearing a field's error as it is edited, the
 * idle/sending/sent/error transitions, and the failure keys.
 *
 * Errors stay translation KEYS in state: the schema that produced them lives
 * at module scope with no translator, and the locale is only known here, at
 * render.
 */
export function useValidatedForm<T extends Record<string, string>>({
  initial,
  validate,
  send,
  t,
}: ValidatedFormOptions<T>): ValidatedForm<T> {
  const [fields, setFields] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors<T>>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [failure, setFailure] = useState<SubmitFailure | null>(null);
  // A ref, not `status`: a double click or Enter-then-click lands the second
  // submit before React has re-rendered with "sending", so a state check would
  // still read "idle" and post the lead twice.
  const inFlight = useRef(false);
  // The form to move focus into once the failed fields have rendered as
  // invalid; `invalidSubmits` re-arms the effect even when the same fields
  // fail twice in a row.
  const invalidForm = useRef<HTMLElement | null>(null);
  const [invalidSubmits, setInvalidSubmits] = useState(0);

  useEffect(() => {
    const form = invalidForm.current;
    invalidForm.current = null;
    // After commit, so `aria-invalid` is already on the controls. Without this
    // a keyboard or screen-reader user presses submit and stays on the button,
    // with no cue which field — possibly scrolled away — needs fixing.
    form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [invalidSubmits]);

  const edit = (field: keyof T & string) => (value: string) => {
    setFields(prev => ({ ...prev, [field]: value }));
    setErrors(prev => {
      if (!Object.hasOwn(prev, field)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setStatus(prev => (prev === "error" ? "idle" : prev));
    setFailure(null);
  };

  const field = (name: keyof T & string): BoundField => {
    const key = Object.hasOwn(errors, name) ? errors[name] : undefined;
    return {
      name,
      value: fields[name] ?? "",
      onChange: edit(name),
      error: key && t ? t(key) : key,
    };
  };

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (inFlight.current) return;
    const result = validate(fields);
    if (!isPayload(result)) {
      setErrors(result.errors);
      setFailure(null);
      setStatus(prev => (prev === "error" ? "idle" : prev));
      const target = event?.currentTarget;
      invalidForm.current = target instanceof HTMLElement ? target : null;
      setInvalidSubmits(n => n + 1);
      return;
    }
    inFlight.current = true;
    setErrors({});
    setFailure(null);
    setStatus("sending");
    try {
      if (rejected(await send(result.data))) {
        setFailure("submit");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setFailure("network");
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }

  const reset = () => {
    setFields(initial);
    setErrors({});
    setFailure(null);
    setStatus("idle");
  };

  return { fields, errors, status, failure, edit, field, submit, reset };
}
