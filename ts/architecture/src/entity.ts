/** Entities and aggregate roots. */

import type { Identifier } from './identifier';

/**
 * A thing with a stable identity over time; equality is by id, not by field
 * values. In Rust this is an object-unsafe trait; in TS it is a plain interface,
 * and "equality by id" is `a.id === b.id` (branded ids compare by value).
 */
export interface Entity<TId extends Identifier = Identifier> {
  readonly id: TId;
}

/**
 * The transactional consistency boundary — the only kind of type a
 * {@link Repository} loads or stores.
 *
 * Rust models the human-facing name as a compile-time `const NAME` reachable
 * without an instance. TS interfaces cannot require statics ergonomically, so it
 * becomes a `readonly name` instance member. If you need the name without an
 * instance (e.g. for a `NotFound` error), expose it as a `static` on your class
 * as well.
 */
export interface AggregateRoot<TId extends Identifier = Identifier> extends Entity<TId> {
  /** Stable, human-facing name used for `NotFound { entity, .. }` errors and logs. */
  readonly name: string;
}
