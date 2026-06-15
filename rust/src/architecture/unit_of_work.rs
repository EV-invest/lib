//! Unit of work.

use async_trait::async_trait;

/// One atomic SQL (e.g. sqlx/Postgres) transaction, made type-safe.
/// `commit`/`rollback` consume the boxed self so a finished transaction can't be
/// reused. Taking `self: Box<Self>` (rather than `self`) keeps the trait
/// object-safe, so a `Box<dyn UnitOfWork<Error = …>>` is nameable.
///
/// What this trait deliberately does **not** have: a repository-lending accessor
/// (`fn blogs(&mut self) -> &mut dyn BlogRepository`). A transaction-bound repo
/// must borrow `&mut Transaction` (so its methods take `&mut self`), whereas the
/// `Arc<dyn>` service port takes `&self`; they are different types and cannot be
/// unified behind one trait object. The concrete adapter (e.g. `PgUnitOfWork`)
/// vends a concrete tx-scoped repository instead.
///
/// # Examples
///
/// ```
/// use ev::architecture::UnitOfWork;
///
/// struct InMemoryTx;
///
/// #[async_trait::async_trait]
/// impl UnitOfWork for InMemoryTx {
///     type Error = std::convert::Infallible;
///
///     async fn commit(self: Box<Self>) -> Result<(), Self::Error> {
///         Ok(())
///     }
///
///     async fn rollback(self: Box<Self>) -> Result<(), Self::Error> {
///         Ok(())
///     }
/// }
///
/// // Object-safe: a finished transaction is held and consumed behind `dyn`.
/// let uow: Box<dyn UnitOfWork<Error = std::convert::Infallible>> = Box::new(InMemoryTx);
///
/// let rt = tokio::runtime::Builder::new_current_thread().build().unwrap();
/// rt.block_on(uow.commit()).unwrap();
/// ```
#[async_trait]
pub trait UnitOfWork: Send {
	type Error;

	async fn commit(self: Box<Self>) -> Result<(), Self::Error>;

	async fn rollback(self: Box<Self>) -> Result<(), Self::Error>;
}

#[cfg(test)]
mod tests {
	use std::sync::{
		Arc,
		atomic::{AtomicU8, Ordering},
	};

	use super::*;

	// 0 = untouched, 1 = committed, 2 = rolled back.
	struct SpyTx(Arc<AtomicU8>);

	#[async_trait]
	impl UnitOfWork for SpyTx {
		type Error = std::convert::Infallible;

		async fn commit(self: Box<Self>) -> Result<(), Self::Error> {
			self.0.store(1, Ordering::SeqCst);
			Ok(())
		}

		async fn rollback(self: Box<Self>) -> Result<(), Self::Error> {
			self.0.store(2, Ordering::SeqCst);
			Ok(())
		}
	}

	#[tokio::test]
	async fn commit_consumes_and_runs() {
		let state = Arc::new(AtomicU8::new(0));
		let uow: Box<dyn UnitOfWork<Error = std::convert::Infallible>> = Box::new(SpyTx(state.clone()));
		uow.commit().await.unwrap();
		assert_eq!(state.load(Ordering::SeqCst), 1);
	}

	#[tokio::test]
	async fn rollback_consumes_and_runs() {
		let state = Arc::new(AtomicU8::new(0));
		let uow: Box<dyn UnitOfWork<Error = std::convert::Infallible>> = Box::new(SpyTx(state.clone()));
		uow.rollback().await.unwrap();
		assert_eq!(state.load(Ordering::SeqCst), 2);
	}
}
