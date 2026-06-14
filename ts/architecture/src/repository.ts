/**
 * Repository ports.
 *
 * Honest *documentation markers*: they tie a port to the aggregate it persists
 * and pin nothing else — the concrete CRUD lives on the leaf interface in the
 * consuming application, where the argument types (the aggregate's typed id) are
 * known. The `aggregate` member is phantom (optional, never set at runtime); it
 * exists so `Repository<Blog>` and `Repository<User>` stay distinct types.
 */

import type { AggregateRoot } from './entity';

/** A port that persists and retrieves a single aggregate (Rust `Repository`). */
export interface Repository<A extends AggregateRoot> {
  /** Phantom: binds this port to its aggregate (Rust `type Aggregate`). */
  readonly aggregate?: A;
}

/**
 * The read-only half (ISP / CQRS): query handlers can depend on the narrow read
 * port without write power.
 */
export interface Reader<A extends AggregateRoot> {
  /** Phantom: binds this port to its aggregate (Rust `type Aggregate`). */
  readonly aggregate?: A;
}
