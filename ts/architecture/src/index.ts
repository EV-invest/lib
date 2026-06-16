/**
 * `@evinvest/architecture` — a generic, I/O-free DDD tactical kernel: typed ids,
 * entities, aggregate roots, domain events, repositories, gateways, the unit of
 * work, and specifications.
 *
 * The TypeScript port of the `architecture` feature of the `ev` Rust crate. It
 * preserves the *semantics* of the public API while reading like idiomatic TS —
 * see the README for the Rust↔TS mapping and the handful of intentional
 * divergences (error handling, numbers, serialization).
 */

export { Id } from "./identifier";
export type { Identifier, IdUnderlying } from "./identifier";

export type { Entity, AggregateRoot } from "./entity";

export type { DomainEvent, EmitsEvents, EventEnvelope } from "./event";

export type { Gateway } from "./gateway";

export type { Repository, Reader } from "./repository";

export type { UnitOfWork } from "./unit-of-work";

export { spec, and, or, not } from "./specification";
export type { Specification, ComposableSpecification, Spec } from "./specification";

export { assertNever } from "./match";
