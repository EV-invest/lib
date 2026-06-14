/** Exhaustiveness helper for discriminated-union `switch`es (Rust's exhaustive `match`). */

/**
 * Compile-time exhaustiveness guard. Put it in the `default` arm of a `switch`
 * over a discriminated union: if a new variant is added and left unhandled, the
 * argument stops being `never` and TS reports an error at the call site.
 *
 * @example
 * ```ts
 * switch (event.kind) {
 *   case 'blog.published': return ...;
 *   case 'blog.archived':  return ...;
 *   default: return assertNever(event);
 * }
 * ```
 */
export function assertNever(value: never, message = 'Unexpected variant'): never {
  throw new Error(`${message}: ${JSON.stringify(value)}`);
}
