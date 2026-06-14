/** Specifications: composable boolean predicates. */

/**
 * A composable boolean predicate over an in-memory `T` — for domain rules and
 * small read-side filters, *not* SQL pushdown.
 */
export interface Specification<T> {
  holds(candidate: T): boolean;
}

/**
 * A specification or a bare predicate. Rust blanket-implements `Specification`
 * for every `Fn(&T) -> bool`; the TS equivalent is accepting either shape
 * wherever a spec is wanted, so one-off rules need no object.
 */
export type Spec<T> = Specification<T> | ((candidate: T) => boolean);

function evaluate<T>(spec: Spec<T>, candidate: T): boolean {
  return typeof spec === 'function' ? spec(candidate) : spec.holds(candidate);
}

/** A specification that also offers the `and` / `or` / `not` combinators fluently. */
export interface ComposableSpecification<T> extends Specification<T> {
  and(other: Spec<T>): ComposableSpecification<T>;
  or(other: Spec<T>): ComposableSpecification<T>;
  not(): ComposableSpecification<T>;
}

/**
 * Wrap a spec or predicate so it composes fluently (Rust's `Self: Sized`-gated
 * `and`/`or`/`not`). The combinators are closures rather than Rust's `And`/`Or`/
 * `Not` structs — the observable behaviour (`holds`) is identical.
 *
 * @example
 * ```ts
 * const published: Spec<Blog> = (b) => b.published;
 * const longRead: Spec<Blog> = (b) => b.words >= 5_000;
 * const featured = spec(published).and(longRead.or((b: Blog) => b.words === 0));
 * featured.holds(blog);
 * ```
 */
export function spec<T>(source: Spec<T>): ComposableSpecification<T> {
  return {
    holds: (candidate) => evaluate(source, candidate),
    and: (other) => spec((c: T) => evaluate(source, c) && evaluate(other, c)),
    or: (other) => spec((c: T) => evaluate(source, c) || evaluate(other, c)),
    not: () => spec((c: T) => !evaluate(source, c)),
  };
}

/** `a AND b` as a standalone specification. */
export function and<T>(a: Spec<T>, b: Spec<T>): Specification<T> {
  return { holds: (c) => evaluate(a, c) && evaluate(b, c) };
}

/** `a OR b` as a standalone specification. */
export function or<T>(a: Spec<T>, b: Spec<T>): Specification<T> {
  return { holds: (c) => evaluate(a, c) || evaluate(b, c) };
}

/** `NOT a` as a standalone specification. */
export function not<T>(a: Spec<T>): Specification<T> {
  return { holds: (c) => !evaluate(a, c) };
}
