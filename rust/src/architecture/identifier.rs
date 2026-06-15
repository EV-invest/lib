//! Typed identities.

use core::{
	fmt::{Debug, Display},
	hash::Hash,
	marker::PhantomData,
};

use uuid::Uuid;

/// A typed identity value.
///
/// Object-*unsafe* by design (associated type, `Copy`, `Self`-shaped contract):
/// identities are always concrete, so this is never held behind `dyn`.
///
/// # Examples
///
/// ```
/// use ev::architecture::{Id, Identifier};
///
/// struct UserTag;
/// type UserId = Id<UserTag, u64>;
///
/// let id = UserId::from_raw(7);
/// assert_eq!(id.underlying(), 7);
/// ```
pub trait Identifier: Copy + Eq + Hash + Debug {
	/// The wire/storage primitive backing this identity (`Uuid`, `u128`, …).
	type Underlying: Copy + Eq;

	fn underlying(&self) -> Self::Underlying;
}

/// Phantom-tagged identity newtype: each aggregate gets its own incompatible id
/// type from one generic, so a `TransferId` can never be passed where an
/// `AccountId` is expected — a real double-entry bug class, removed at zero
/// runtime cost. `PhantomData<fn() -> Tag>` keeps `Id` `Send + Sync` for any
/// `Tag` and imposes no bound on `Tag` itself.
///
/// `Id` is `#[serde(transparent)]`: it serializes as the bare underlying value,
/// so the wire/storage shape is identical to using the primitive directly.
///
/// # Examples
///
/// Distinct tags are incompatible, even over the same primitive:
///
/// ```compile_fail
/// use ev::architecture::Id;
///
/// struct AccountTag;
/// struct TransferTag;
/// type AccountId = Id<AccountTag, u128>;
/// type TransferId = Id<TransferTag, u128>;
///
/// fn debit(_: AccountId) {}
///
/// let transfer = TransferId::from_raw(1);
/// debit(transfer); // ❌ expected AccountId, found TransferId
/// ```
///
/// Serialization is transparent:
///
/// ```
/// use ev::architecture::Id;
///
/// struct AccountTag;
/// type AccountId = Id<AccountTag, u128>;
///
/// let json = serde_json::to_string(&AccountId::from_raw(42)).unwrap();
/// assert_eq!(json, "42");
///
/// let back: AccountId = serde_json::from_str("42").unwrap();
/// assert_eq!(back, AccountId::from_raw(42));
/// ```
#[derive(serde::Deserialize, serde::Serialize)]
#[serde(transparent)]
pub struct Id<Tag, U = Uuid> {
	value: U,
	#[serde(skip)]
	_tag: PhantomData<fn() -> Tag>,
}
impl<Tag, U: Copy> Id<Tag, U> {
	pub const fn from_raw(value: U) -> Self {
		Self { value, _tag: PhantomData }
	}

	pub const fn raw(self) -> U {
		self.value
	}
}
impl<Tag> Id<Tag, Uuid> {
	/// Mint a fresh `Uuid`-backed id. Host-only: wasm consumers never mint ids,
	/// only deserialize them, so gating out the v4 call keeps the wasm build lean.
	///
	/// No `Default` impl: defaulting an identity to a random value is misleading
	/// — callers should reach for `new()` explicitly.
	#[cfg(not(target_arch = "wasm32"))]
	#[allow(clippy::new_without_default)]
	pub fn new() -> Self {
		Self::from_raw(Uuid::new_v4())
	}
}

// Manual trait impls so `Tag` is never constrained (derives would over-constrain
// it by requiring `Tag: Clone`/`Eq`/… which `Tag` is only ever a marker for).
impl<Tag, U: Copy> Clone for Id<Tag, U> {
	fn clone(&self) -> Self {
		*self
	}
}

impl<Tag, U: Copy> Copy for Id<Tag, U> {}

impl<Tag, U: PartialEq> PartialEq for Id<Tag, U> {
	fn eq(&self, other: &Self) -> bool {
		self.value == other.value
	}
}

impl<Tag, U: Eq> Eq for Id<Tag, U> {}

impl<Tag, U: Hash> Hash for Id<Tag, U> {
	fn hash<H: core::hash::Hasher>(&self, state: &mut H) {
		self.value.hash(state);
	}
}

impl<Tag, U: Debug> Debug for Id<Tag, U> {
	fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
		Debug::fmt(&self.value, f)
	}
}

impl<Tag, U: Display> Display for Id<Tag, U> {
	fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
		Display::fmt(&self.value, f)
	}
}

impl<Tag, U: Copy + Eq + Hash + Debug> Identifier for Id<Tag, U> {
	type Underlying = U;

	fn underlying(&self) -> U {
		self.value
	}
}

impl<Tag, U: Copy> From<U> for Id<Tag, U> {
	fn from(value: U) -> Self {
		Self::from_raw(value)
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	struct AccountTag;
	struct TransferTag;
	type AccountId = Id<AccountTag, u128>;
	type TransferId = Id<TransferTag, u128>;

	#[test]
	fn round_trips_through_raw() {
		let id = AccountId::from_raw(99);
		assert_eq!(id.raw(), 99);
		assert_eq!(id.underlying(), 99);
		assert_eq!(AccountId::from(99), id);
	}

	#[test]
	fn equality_is_by_value_within_a_tag() {
		assert_eq!(AccountId::from_raw(1), AccountId::from_raw(1));
		assert_ne!(AccountId::from_raw(1), AccountId::from_raw(2));
	}

	#[test]
	fn distinct_tags_hash_independently() {
		use std::collections::HashMap;
		let mut by_account: HashMap<AccountId, &str> = HashMap::new();
		by_account.insert(AccountId::from_raw(1), "a");
		assert_eq!(by_account.get(&AccountId::from_raw(1)), Some(&"a"));
		// TransferId is a different key type entirely — no accidental collision.
		let _t = TransferId::from_raw(1);
	}

	#[test]
	fn serializes_transparently() {
		let json = serde_json::to_string(&AccountId::from_raw(7)).unwrap();
		assert_eq!(json, "7");
		let back: AccountId = serde_json::from_str(&json).unwrap();
		assert_eq!(back, AccountId::from_raw(7));
	}

	#[cfg(not(target_arch = "wasm32"))]
	#[test]
	fn new_mints_unique_uuids() {
		struct DocTag;
		type DocId = Id<DocTag>;
		assert_ne!(DocId::new(), DocId::new());
	}
}
