//! Generic DDD tactical building blocks: the kernel every bounded context
//! implements — typed identities, entities, aggregate roots, domain events,
//! repositories, gateways, the unit of work, and specifications.
//!
//! It is deliberately I/O-free and `wasm32`-safe, so a domain layer that builds
//! on it can compile to wasm. The only async here is `#[async_trait]` trait
//! *definitions* (boxed-future signatures), which pull in no runtime. Concrete
//! implementations (sqlx, an external ledger, …) live in the consuming service.
//!
//! # Object safety at a glance
//!
//! | Trait | Held behind `dyn`? |
//! | --- | --- |
//! | [`Identifier`] / [`Id`] | no — always concrete |
//! | [`Entity`] / [`AggregateRoot`] | no |
//! | [`Repository`] / [`Reader`] | yes |
//! | [`Gateway`] | yes |
//! | [`UnitOfWork`] | yes |
//! | [`DomainEvent`] / [`EmitsEvents`] | no |
//! | [`Specification`] | yes (the `holds` method) |

pub mod entity;
pub use entity::*;

pub mod event;
pub use event::*;

pub mod gateway;
pub use gateway::*;

pub mod identifier;
pub use identifier::*;

pub mod repository;
pub use repository::*;

pub mod specification;
pub use specification::*;

pub mod unit_of_work;
pub use unit_of_work::*;
