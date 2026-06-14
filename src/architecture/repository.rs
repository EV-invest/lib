//! Repository ports.
//!
//! These are honest *documentation markers*: they tie a port to the aggregate it
//! persists (living documentation) and pin the `Send + Sync` `dyn` shape, but
//! prescribe no CRUD. The concrete methods live on the leaf trait in the
//! consuming application, where the argument types (the aggregate's typed id) are
//! known. Both are object-safe: associated type only, no methods.

use super::entity::AggregateRoot;

/// A port that persists and retrieves a single aggregate.
///
/// # Examples
///
/// A leaf port extends `Repository` to declare *which* aggregate it owns, then
/// adds the actual CRUD:
///
/// ```
/// use ev::architecture::{AggregateRoot, Entity, Id, Reader, Repository};
///
/// struct BlogTag;
/// type BlogId = Id<BlogTag>;
/// struct Blog {
///     id: BlogId,
/// }
/// impl Entity for Blog {
///     type Id = BlogId;
///     fn id(&self) -> BlogId {
///         self.id
///     }
/// }
/// impl AggregateRoot for Blog {
///     const NAME: &'static str = "blog";
/// }
///
/// trait BlogRepository: Repository<Aggregate = Blog> + Reader<Aggregate = Blog> {
///     fn create(&self, blog: Blog);
///     fn find(&self, id: BlogId) -> Option<Blog>;
/// }
///
/// // The marker keeps the port object-safe, so it can be held as a trait object.
/// fn _accepts_dyn(_: &dyn Repository<Aggregate = Blog>) {}
/// ```
pub trait Repository: Send + Sync {
	type Aggregate: AggregateRoot;
}

/// The read-only half (ISP / CQRS): query handlers can depend on the narrow read
/// port without write power.
pub trait Reader: Send + Sync {
	type Aggregate: AggregateRoot;
}
