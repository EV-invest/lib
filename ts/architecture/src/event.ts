/**
 * Domain events.
 *
 * The Rust `DomainEvent` trait is implemented by per-context enums and carries a
 * `const KIND` discriminator. The idiomatic TS equivalent is a **discriminated
 * union** whose members each carry a literal `kind`, which is exactly what this
 * interface constrains.
 */

import type { AggregateRoot } from './entity';

/**
 * A fact that happened in the domain, named in the past tense. Plain serializable
 * data — persist it to an outbox with `JSON.stringify`.
 *
 * @example
 * ```ts
 * type BlogEvent =
 *   | { kind: 'blog.published'; slug: string }
 *   | { kind: 'blog.archived' };
 * ```
 */
export interface DomainEvent {
  /** Stable discriminator for storage and routing (Rust `DomainEvent::KIND`), e.g. `"blog.published"`. */
  readonly kind: string;
}

/**
 * Implemented only by aggregates that actually raise events. Aggregates that
 * raise none simply do not implement this, so the non-event case carries no stub
 * event type.
 */
export interface EmitsEvents<E extends DomainEvent> extends AggregateRoot {
  /** Take and clear the events accumulated on this aggregate. */
  drainEvents(): E[];
}

/**
 * A domain event plus the metadata an outbox needs to store and order it.
 *
 * `occurredAt` is an RFC 3339 string rather than a `Date`: a string round-trips
 * losslessly through JSON and preserves sub-millisecond precision (Rust uses
 * `jiff::Timestamp`, nanosecond-precise; `Date` is millisecond-only and parses
 * back from JSON as a string anyway).
 */
export interface EventEnvelope<E extends DomainEvent> {
  /** UUID. */
  readonly id: string;
  /** RFC 3339 timestamp. */
  readonly occurredAt: string;
  readonly payload: E;
}
