/**
 * Typed identities.
 *
 * Rust's `Id<Tag, U>` is a phantom-tagged newtype over a primitive. TypeScript
 * has no newtypes, so we use a **branded primitive**: the value at runtime *is*
 * the underlying primitive (`string` UUID, `bigint`, …), and the `Tag` lives only
 * in the type. This is strictly more ergonomic than Rust here — branded
 * primitives compare with `===` and work as `Map`/`Set` keys natively, so the
 * `Identifier`/`underlying()` indirection collapses into the value itself.
 */

declare const idTag: unique symbol;

/** The wire/storage primitive backing an identity (Rust `Identifier::Underlying`). */
export type IdUnderlying = string | number | bigint;

/**
 * A typed identity value. Distinct `Tag`s are incompatible at compile time, even
 * over the same primitive, so an `Id<TransferTag>` can never be passed where an
 * `Id<AccountTag>` is expected — a real double-entry bug class removed at zero
 * runtime cost.
 *
 * @example
 * ```ts
 * type UserId = Id<'user', bigint>;
 * const id = Id.fromRaw<'user', bigint>(7n);
 * Id.raw(id); // 7n
 * ```
 */
export type Id<Tag, U extends IdUnderlying = string> = U & {
  /** Phantom tag — type-level only; never present at runtime. */
  readonly [idTag]: Tag;
};

/**
 * Any typed identity (Rust's `Identifier` trait) with its tag erased. Use as a
 * generic bound when a function accepts "some id" regardless of which aggregate
 * it belongs to.
 */
export type Identifier<U extends IdUnderlying = IdUnderlying> = Id<unknown, U>;

/** Companion operations for {@link Id} (mirrors Rust's `Id::from_raw` / `raw` / `new`). */
export const Id = {
  /** Wrap a raw primitive as a typed id (Rust `Id::from_raw`). */
  fromRaw<Tag, U extends IdUnderlying>(value: U): Id<Tag, U> {
    return value as Id<Tag, U>;
  },

  /** Recover the underlying primitive (Rust `Id::raw` / `Identifier::underlying`). */
  raw<U extends IdUnderlying>(id: Id<unknown, U>): U {
    return id as U;
  },

  /**
   * Mint a fresh UUID-backed id (Rust `Id::new`). Uses the platform Web Crypto
   * RNG, so it works on Node and in the browser. Rust gates minting out of wasm
   * because wasm consumers only ever *deserialize* ids; the same advice applies.
   */
  newUuid<Tag>(): Id<Tag, string> {
    return globalThis.crypto.randomUUID() as Id<Tag, string>;
  },
} as const;
