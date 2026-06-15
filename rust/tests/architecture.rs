//! End-to-end usage of the `architecture` kernel from an external consumer,
//! modelling a tiny bounded context the way `domain`/`backend` do.
#![cfg(feature = "architecture")]

use std::sync::Mutex;

use ev::architecture::{AggregateRoot, Entity, Gateway, Id, Reader, Repository, Specification, UnitOfWork};

type BlogId = Id<BlogTag>;
trait BlogRepository: Repository<Aggregate = Blog> + Reader<Aggregate = Blog> {
	fn create(&self, blog: Blog);
	fn find(&self, id: BlogId) -> Option<Blog>;
}
struct BlogTag;

#[derive(Clone)]
struct Blog {
	id: BlogId,
	published: bool,
	words: u32,
}

impl Entity for Blog {
	type Id = BlogId;

	fn id(&self) -> BlogId {
		self.id
	}
}

impl AggregateRoot for Blog {
	const NAME: &'static str = "blog";
}

// --- Specifications: a reusable rule and a composed one ---------------------

struct Published;
impl Specification<Blog> for Published {
	fn holds(&self, blog: &Blog) -> bool {
		blog.published
	}
}

#[test]
fn specifications_compose() {
	let long = |b: &Blog| b.words >= 1_000;
	let featured = Published.and(long);

	let a = Blog {
		id: BlogId::new(),
		published: true,
		words: 2_000,
	};
	let b = Blog {
		id: BlogId::new(),
		published: false,
		words: 2_000,
	};
	let c = Blog {
		id: BlogId::new(),
		published: true,
		words: 10,
	};

	assert!(featured.holds(&a));
	assert!(!featured.holds(&b));
	assert!(!featured.holds(&c));
	assert!(Published.not().holds(&b));
}

// --- Repository / Reader markers on a concrete adapter ----------------------

#[derive(Default)]
struct InMemoryBlogs {
	rows: Mutex<Vec<Blog>>,
}

impl Repository for InMemoryBlogs {
	type Aggregate = Blog;
}
impl Reader for InMemoryBlogs {
	type Aggregate = Blog;
}

impl BlogRepository for InMemoryBlogs {
	fn create(&self, blog: Blog) {
		self.rows.lock().unwrap().push(blog);
	}

	fn find(&self, id: BlogId) -> Option<Blog> {
		self.rows.lock().unwrap().iter().find(|b| b.id() == id).cloned()
	}
}

#[test]
fn repository_is_object_safe_and_round_trips() {
	let repo: &dyn BlogRepository = &InMemoryBlogs::default();
	let id = BlogId::new();
	repo.create(Blog { id, published: true, words: 1 });

	assert!(repo.find(id).is_some());
	assert!(repo.find(BlogId::new()).is_none());
	assert_eq!(Blog::NAME, "blog");
}

// --- Gateway marker on an external system -----------------------------------

struct FakeLedger;
impl Gateway for FakeLedger {}

#[test]
fn gateway_is_a_marker() {
	fn assert_gateway<G: Gateway>(_: &G) {}
	assert_gateway(&FakeLedger);
}

// --- UnitOfWork: consumed on commit -----------------------------------------

struct Tx;

#[async_trait::async_trait]
impl UnitOfWork for Tx {
	type Error = std::convert::Infallible;

	async fn commit(self: Box<Self>) -> Result<(), Self::Error> {
		Ok(())
	}

	async fn rollback(self: Box<Self>) -> Result<(), Self::Error> {
		Ok(())
	}
}

#[tokio::test]
async fn unit_of_work_commits() {
	let uow: Box<dyn UnitOfWork<Error = std::convert::Infallible>> = Box::new(Tx);
	uow.commit().await.unwrap();
}
