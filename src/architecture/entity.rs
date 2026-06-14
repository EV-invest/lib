//! Entities and aggregate roots.

use super::identifier::Identifier;

/// A thing with a stable identity over time; equality is by id, not by field
/// values. Object-*unsafe* (associated `Id`, `Self`-shaped contract): entities
/// are concrete, so this is implemented directly, never used behind `dyn`.
///
/// # Examples
///
/// ```
/// use ev::architecture::{Entity, Id};
///
/// struct OrderTag;
/// type OrderId = Id<OrderTag, u64>;
///
/// struct Order {
///     id: OrderId,
///     total_cents: u64,
/// }
///
/// impl Entity for Order {
///     type Id = OrderId;
///     fn id(&self) -> OrderId {
///         self.id
///     }
/// }
///
/// let order = Order { id: OrderId::from_raw(1), total_cents: 999 };
/// assert_eq!(order.id(), OrderId::from_raw(1));
/// ```
pub trait Entity {
	type Id: Identifier;

	fn id(&self) -> Self::Id;
}

/// The transactional consistency boundary — the only kind of type a
/// [`super::repository::Repository`] loads or stores. A marker: it adds intent,
/// not methods. It deliberately does *not* require an event type (see
/// [`super::event::EmitsEvents`]), so a non-event aggregate is truly zero-cost.
///
/// # Examples
///
/// ```
/// use ev::architecture::{AggregateRoot, Entity, Id};
///
/// struct OrderTag;
/// type OrderId = Id<OrderTag, u64>;
///
/// struct Order {
///     id: OrderId,
/// }
///
/// impl Entity for Order {
///     type Id = OrderId;
///     fn id(&self) -> OrderId {
///         self.id
///     }
/// }
///
/// impl AggregateRoot for Order {
///     const NAME: &'static str = "order";
/// }
///
/// // `NAME` is a compile-time constant, reachable without an instance — e.g. for
/// // a `NotFound { entity: Order::NAME, .. }` error.
/// assert_eq!(Order::NAME, "order");
/// ```
pub trait AggregateRoot: Entity {
	/// Stable, human-facing name used for `NotFound { entity, .. }` errors and
	/// logs.
	const NAME: &'static str;
}
