/** Gateway port to an external transactional system. */

/**
 * An anti-corruption boundary to an *external* transactional system that owns its
 * own identity, invariants, and atomicity (a ledger like TigerBeetle, a payment
 * or email API).
 *
 * Explicitly **not** a {@link Repository}: it persists no aggregate we own, and it
 * cannot enroll in our {@link UnitOfWork}. In Rust the absence of a
 * `UnitOfWork.gateway()` accessor makes "this external system cannot join a local
 * SQL transaction" a compile-discoverable fact; TS keeps this as documentation.
 * System metadata (e.g. `SYSTEM = "tigerbeetle"`) belongs on the concrete
 * adapter, not here.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- intentional marker interface
export interface Gateway {}
