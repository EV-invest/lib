/**
 * Branded primitive — a zero-cost type-level tag over a runtime primitive.
 *
 * Patterned on the DDD `TypeObject` / value-object idiom: the value at runtime
 * *is* the underlying primitive (`string`), and the `Brand` lives only in the
 * type system. Branded primitives compare with `===`, work as `Map`/`Set` keys,
 * and serialize to the primitive directly — all at zero runtime cost.
 *
 * This is the same mechanism as {@link ../architecture/src/identifier.ts:Id},
 * generalised beyond identity to any value object (phone number, email, URL, …).
 */

declare const brandTag: unique symbol;

/** A value branded with a compile-time-only tag. */
export type Branded<T, Brand> = T & {
  /** Phantom tag — type-level only; never present at runtime. */
  readonly [brandTag]: Brand;
};

/**
 * Companion for creating branded value objects.
 *
 * @example
 * ```ts
 * type Email = Branded<string, 'Email'>;
 * ```
 */
export const Brand = {
  /** Brand a value without validation — the caller guarantees correctness. */
  fromRaw<T, B>(value: T): Branded<T, B> {
    return value as Branded<T, B>;
  },

  /** Recover the underlying primitive. */
  raw<T>(branded: Branded<T, unknown>): T {
    return branded as T;
  },
} as const;
