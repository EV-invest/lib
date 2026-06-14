/** Unit of work. */

/**
 * One atomic transaction (e.g. a sqlx/Postgres transaction), made type-safe.
 *
 * `commit` and `rollback` are **terminal**: after either settles the unit of work
 * must not be reused. Rust enforces this by consuming `self: Box<Self>`; TS has no
 * move semantics, so this is a contract, not a compile error — implementations
 * may guard against reuse at runtime if they wish.
 *
 * Failure is signalled by a **rejected promise** (a thrown error), not a `Result`
 * value — the idiomatic TS shape for I/O. Rust's `type Error` associated type
 * becomes whatever the implementation throws.
 *
 * Note the deliberate absence of any repository-lending accessor (no
 * `uow.blogs()`): a tx-bound repo and an `Arc<dyn>`-style service port are
 * different shapes and cannot be unified here. The concrete adapter vends a
 * tx-scoped repository instead.
 */
export interface UnitOfWork {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}
