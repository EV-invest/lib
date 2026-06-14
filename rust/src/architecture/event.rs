//! Domain events.
//!
//! The traits here are *defined but not yet wired* in the EV codebase: no
//! aggregate raises events today. They are the documented home for a future
//! Postgres↔external-system consistency story — a domain event can be written to
//! a Postgres `outbox` table inside the same
//! [`super::unit_of_work::UnitOfWork`] as the state change, then dispatched
//! asynchronously.

use serde::Serialize;
use serde::de::DeserializeOwned;

/// A fact that happened in the domain, named in the past tense.
///
/// Serializable so it can be persisted to an outbox. Object-*unsafe*
/// (associated const, `DeserializeOwned`): used as a concrete per-context enum,
/// never as `dyn DomainEvent`.
///
/// # Examples
///
/// ```
/// use ev::architecture::DomainEvent;
/// use serde::{Deserialize, Serialize};
///
/// #[derive(Clone, Serialize, Deserialize)]
/// enum BlogEvent {
///     Published { slug: String },
/// }
///
/// impl DomainEvent for BlogEvent {
///     const KIND: &'static str = "blog";
/// }
///
/// assert_eq!(BlogEvent::KIND, "blog");
/// ```
pub trait DomainEvent: Clone + Serialize + DeserializeOwned + Send + 'static {
	/// Stable discriminator for storage and routing (e.g. `"blog.published"`).
	const KIND: &'static str;
}

/// Implemented only by aggregates that actually raise events. Aggregates that
/// raise none (like a plain CRUD `Blog`) simply do not implement this, so the
/// non-event case carries no stub event type.
///
/// # Examples
///
/// ```
/// use ev::architecture::{AggregateRoot, DomainEvent, EmitsEvents, Entity, Id};
/// use serde::{Deserialize, Serialize};
///
/// struct CartTag;
/// type CartId = Id<CartTag, u64>;
///
/// #[derive(Clone, Serialize, Deserialize)]
/// enum CartEvent {
///     ItemAdded { sku: String },
/// }
/// impl DomainEvent for CartEvent {
///     const KIND: &'static str = "cart";
/// }
///
/// #[derive(Default)]
/// struct Cart {
///     id: u64,
///     pending: Vec<CartEvent>,
/// }
///
/// impl Cart {
///     fn add(&mut self, sku: &str) {
///         self.pending.push(CartEvent::ItemAdded { sku: sku.to_owned() });
///     }
/// }
///
/// impl Entity for Cart {
///     type Id = CartId;
///     fn id(&self) -> CartId {
///         CartId::from_raw(self.id)
///     }
/// }
/// impl AggregateRoot for Cart {
///     const NAME: &'static str = "cart";
/// }
/// impl EmitsEvents for Cart {
///     type Event = CartEvent;
///     fn drain_events(&mut self) -> Vec<CartEvent> {
///         std::mem::take(&mut self.pending)
///     }
/// }
///
/// let mut cart = Cart::default();
/// cart.add("SKU-1");
/// assert_eq!(cart.drain_events().len(), 1);
/// assert!(cart.drain_events().is_empty()); // drained
/// ```
pub trait EmitsEvents: super::entity::AggregateRoot {
	type Event: DomainEvent;

	/// Take and clear the events accumulated on this aggregate.
	fn drain_events(&mut self) -> Vec<Self::Event>;
}

/// A domain event plus the metadata an outbox needs to store and order it.
///
/// The explicit serde bound resolves the ambiguity between the derive's default
/// `E: Deserialize<'de>` bound and `DomainEvent`'s `DeserializeOwned` supertrait.
#[derive(Clone, Debug, serde::Deserialize, serde::Serialize)]
#[serde(bound = "E: DomainEvent")]
pub struct EventEnvelope<E: DomainEvent> {
	pub id: uuid::Uuid,
	pub occurred_at: jiff::Timestamp,
	pub payload: E,
}

#[cfg(test)]
mod tests {
	use super::*;

	#[derive(Clone, Debug, PartialEq, serde::Deserialize, serde::Serialize)]
	struct Published {
		slug: String,
	}

	impl DomainEvent for Published {
		const KIND: &'static str = "blog.published";
	}

	#[test]
	fn envelope_round_trips_through_json() {
		let envelope = EventEnvelope {
			id: uuid::Uuid::nil(),
			occurred_at: jiff::Timestamp::UNIX_EPOCH,
			payload: Published { slug: "hello".to_owned() },
		};

		let json = serde_json::to_string(&envelope).unwrap();
		let back: EventEnvelope<Published> = serde_json::from_str(&json).unwrap();

		assert_eq!(back.id, envelope.id);
		assert_eq!(back.occurred_at, envelope.occurred_at);
		assert_eq!(back.payload, envelope.payload);
	}
}
