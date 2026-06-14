//! Specifications: composable boolean predicates.

/// A composable boolean predicate over an in-memory `T` — for domain rules and
/// small read-side filters, *not* SQL pushdown.
///
/// `holds` is object-safe, so `Box<dyn Specification<T>>` works; the `and`/`or`/
/// `not` combinators are gated on `Self: Sized` so they remain available on
/// concrete specs while staying off the trait object.
///
/// # Examples
///
/// Named, reusable rules compose at compile time with zero dynamic dispatch:
///
/// ```
/// use ev::architecture::Specification;
///
/// struct Published;
/// impl Specification<Blog> for Published {
///     fn holds(&self, blog: &Blog) -> bool {
///         blog.published
///     }
/// }
///
/// struct LongRead;
/// impl Specification<Blog> for LongRead {
///     fn holds(&self, blog: &Blog) -> bool {
///         blog.words >= 5_000
///     }
/// }
///
/// struct Blog {
///     published: bool,
///     words: u32,
/// }
///
/// // Published AND (a long read OR pinned-by-a-closure).
/// let featured = Published.and(LongRead.or(|b: &Blog| b.words == 0));
///
/// assert!(featured.holds(&Blog { published: true, words: 9000 }));
/// assert!(!featured.holds(&Blog { published: false, words: 9000 }));
/// ```
///
/// Any `Fn(&T) -> bool` is already a specification, so one-off predicates need no
/// struct:
///
/// ```
/// use ev::architecture::Specification;
///
/// let is_even = |n: &i32| n % 2 == 0;
/// assert!(is_even.holds(&4));
/// assert!(is_even.not().holds(&3));
/// ```
///
/// Heterogeneous, data-driven rule sets erase to a trait object (note: only
/// `holds` is available on `dyn` — the combinators are `Sized`-gated):
///
/// ```
/// use ev::architecture::Specification;
///
/// let rules: Vec<Box<dyn Specification<i32>>> = vec![
///     Box::new(|n: &i32| *n > 0),
///     Box::new(|n: &i32| n % 2 == 0),
/// ];
/// assert!(rules.iter().all(|r| r.holds(&4)));
/// assert!(!rules.iter().all(|r| r.holds(&3)));
/// ```
pub trait Specification<T: ?Sized> {
	fn holds(&self, candidate: &T) -> bool;

	fn and<S: Specification<T>>(self, other: S) -> And<Self, S>
	where
		Self: Sized,
	{
		And(self, other)
	}

	fn or<S: Specification<T>>(self, other: S) -> Or<Self, S>
	where
		Self: Sized,
	{
		Or(self, other)
	}

	fn not(self) -> Not<Self>
	where
		Self: Sized,
	{
		Not(self)
	}
}

pub struct And<A, B>(A, B);
pub struct Or<A, B>(A, B);
pub struct Not<A>(A);

impl<T: ?Sized, A: Specification<T>, B: Specification<T>> Specification<T> for And<A, B> {
	fn holds(&self, candidate: &T) -> bool {
		self.0.holds(candidate) && self.1.holds(candidate)
	}
}

impl<T: ?Sized, A: Specification<T>, B: Specification<T>> Specification<T> for Or<A, B> {
	fn holds(&self, candidate: &T) -> bool {
		self.0.holds(candidate) || self.1.holds(candidate)
	}
}

impl<T: ?Sized, A: Specification<T>> Specification<T> for Not<A> {
	fn holds(&self, candidate: &T) -> bool {
		!self.0.holds(candidate)
	}
}

/// Any `Fn(&T) -> bool` is a specification, so trivial predicates stay free.
impl<T: ?Sized, F: Fn(&T) -> bool> Specification<T> for F {
	fn holds(&self, candidate: &T) -> bool {
		self(candidate)
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	const POSITIVE: fn(&i32) -> bool = |n| *n > 0;
	const EVEN: fn(&i32) -> bool = |n| n % 2 == 0;

	#[test]
	fn and_requires_both() {
		let spec = POSITIVE.and(EVEN);
		assert!(spec.holds(&4));
		assert!(!spec.holds(&3)); // odd
		assert!(!spec.holds(&-2)); // negative
	}

	#[test]
	fn or_requires_either() {
		let spec = POSITIVE.or(EVEN);
		assert!(spec.holds(&3)); // positive
		assert!(spec.holds(&-2)); // even
		assert!(!spec.holds(&-3)); // neither
	}

	#[test]
	fn not_inverts() {
		assert!(EVEN.not().holds(&3));
		assert!(!EVEN.not().holds(&4));
	}

	#[test]
	fn nests_arbitrarily() {
		// positive AND (even OR NOT >100)  — type And<_, Or<_, Not<_>>>.
		let spec = POSITIVE.and(EVEN.or((|n: &i32| *n > 100).not()));
		assert!(spec.holds(&4)); // positive, even
		assert!(spec.holds(&7)); // positive, odd but <=100
		assert!(!spec.holds(&101)); // positive, odd, >100
	}

	#[test]
	fn dyn_dispatch_via_holds() {
		let spec: Box<dyn Specification<i32>> = Box::new(EVEN);
		assert!(spec.holds(&2));
	}
}
