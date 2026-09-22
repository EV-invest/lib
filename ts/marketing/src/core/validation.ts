// Form validation contract: errors are translation KEYS, not prose.
//
// A schema (zod or anything shaped like it) is built at module scope, where no
// translator exists yet — and it is shared by every locale. So a refinement's
// "message" is a key like `"validation.email.invalid"`, and the form resolves
// it with the injected `t` at render time, where the reader's locale is known.
// This module is server-safe and dependency-free: it speaks to a schema
// library only through the structural {@link SafeParseLike} shape.

/** The injected translator. The package never imports an i18n library. */
export type Translate = (key: string) => string;

/** One translation key per failing field — the inline error a form shows. */
export type FieldErrors<T> = Partial<Record<keyof T & string, string>>;

/** What a validator answers: the cleaned payload, or a key per bad field. */
export type Validated<T> =
  | { data: T; errors?: never }
  | { data?: never; errors: FieldErrors<T> };

/**
 * Why a submit that passed validation still failed, as a key rather than the
 * backend's sentence: the backend answers in one language, the reader may
 * read another. Per-field precision is already covered inline.
 */
export type SubmitFailure = "submit" | "network";

/** Lifecycle of one submission, from untouched form to accepted payload. */
export type FormStatus = "idle" | "sending" | "sent" | "error";

/**
 * Code-point count. A backend in Rust (or any `chars()`-counting limit)
 * counts code points, while `String.length` counts UTF-16 units — an emoji
 * would pass the client and fail the server.
 */
export const charLength = (value: string): number => [...value].length;

/** Structural subset of a zod (3 or 4) / valibot-style issue. */
export interface ValidationIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

/** Structural subset of `schema.safeParse(input)`'s result. */
export type SafeParseLike<T> =
  | { success: true; data: T }
  | { success: false; error: { issues: readonly ValidationIssue[] } };

/**
 * First issue per top-level field — the key an inline form error displays.
 * Issues with no path (form-level refinements) have no field to sit under and
 * are dropped; express them as a field refinement if the reader must see them.
 */
export function firstFieldErrors<T>(
  issues: readonly ValidationIssue[],
): FieldErrors<T> {
  const first: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || field in first) continue;
    first[field] = issue.message;
  }
  return first as FieldErrors<T>;
}

/** Adapt a `safeParse` result to the harness's {@link Validated} shape. */
export function fromSafeParse<T>(result: SafeParseLike<T>): Validated<T> {
  return result.success
    ? { data: result.data }
    : { errors: firstFieldErrors<T>(result.error.issues) };
}

/** Resolve every key in `errors` through `t`, for a non-React consumer. */
export function translateErrors<T>(
  errors: FieldErrors<T>,
  t: Translate,
): FieldErrors<T> {
  const out: Record<string, string> = {};
  for (const [field, key] of Object.entries(errors)) {
    if (typeof key === "string") out[field] = t(key);
  }
  return out as FieldErrors<T>;
}
