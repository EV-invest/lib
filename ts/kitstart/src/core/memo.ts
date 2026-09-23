/**
 * `fn` memoised per key for the life of the process, the pending promise
 * included, so concurrent first requests share one computation. A rejection is
 * forgotten, so the next caller retries instead of inheriting the failure.
 *
 * Unbounded by design: callers pass only keys drawn from a closed set.
 */
export function memoByKey<T>(fn: (key: string) => Promise<T>): (key: string) => Promise<T> {
  const cache = new Map<string, Promise<T>>();
  return key => {
    let hit = cache.get(key);
    if (!hit) {
      hit = fn(key);
      cache.set(key, hit);
      hit.catch(() => cache.delete(key));
    }
    return hit;
  };
}
