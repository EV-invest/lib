//! Gateway port to an external transactional system.

/// An anti-corruption boundary to an *external* transactional system that owns
/// its own identity, invariants, and atomicity (a ledger like TigerBeetle, a
/// payment or email API).
///
/// Explicitly **not** a [`super::repository::Repository`]: it persists no
/// aggregate we own, and it **cannot** enroll in our
/// [`super::unit_of_work::UnitOfWork`]. The deliberate absence of any
/// `UnitOfWork::gateway()` accessor makes "this external system cannot join a
/// local SQL transaction" a compile-discoverable fact.
///
/// An empty marker by necessity: an associated const on a `dyn`-held supertrait
/// would break object safety (`Arc<dyn Ledger>`). System metadata belongs on an
/// inherent const on the concrete adapter instead.
///
/// # Examples
///
/// ```
/// use ev_lib::architecture::Gateway;
/// use std::sync::Arc;
///
/// trait Ledger: Gateway {
///     fn transfer(&self, from: u128, to: u128, amount: u128);
/// }
///
/// struct TigerBeetleLedger;
/// impl TigerBeetleLedger {
///     // System metadata lives here, not on the object-safe trait.
///     const SYSTEM: &'static str = "tigerbeetle";
/// }
/// impl Gateway for TigerBeetleLedger {}
/// impl Ledger for TigerBeetleLedger {
///     fn transfer(&self, _from: u128, _to: u128, _amount: u128) {}
/// }
///
/// // Object-safe: usable behind `Arc<dyn _>`.
/// let ledger: Arc<dyn Ledger> = Arc::new(TigerBeetleLedger);
/// ledger.transfer(1, 2, 100);
/// assert_eq!(TigerBeetleLedger::SYSTEM, "tigerbeetle");
/// ```
pub trait Gateway: Send + Sync {}
