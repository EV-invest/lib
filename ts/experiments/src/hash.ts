/**
 * Deterministic, dependency-free string hashing shared with the Rust
 * `experiments` feature. The definition is a cross-language contract — the TS
 * and Rust sides must return bit-identical values for the same input, so a
 * subject bucketed on the server lands in the same variant everywhere:
 *
 * - `fnv1a32(s)` — FNV-1a, 32-bit, over the UTF-8 bytes of `s`
 *   (offset basis `0x811C9DC5`, prime `0x01000193`, multiplication mod 2^32).
 * - `hashToUnit(seed) = fnv1a32(seed) / 2^32`, a number in `[0, 1)`.
 * - `hashRng(seed)` — the n-th call (n = 0, 1, 2…) returns
 *   `hashToUnit(`${seed}#${n}`)`.
 *
 * Not a cryptographic hash: it is for stable bucketing only.
 */

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const TWO_POW_32 = 0x1_0000_0000;

/**
 * Encodes a string as UTF-8 bytes. Hand-rolled rather than `TextEncoder` so the
 * zero-dep core needs no platform global; a lone surrogate becomes U+FFFD, the
 * same substitution `TextEncoder` makes (Rust strings cannot hold one at all).
 */
function utf8(input: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    let cp = input.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (next - 0xdc00);
        i++;
      } else {
        cp = 0xfffd;
      }
    } else if (cp >= 0xdc00 && cp <= 0xdfff) {
      cp = 0xfffd;
    }
    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp < 0x800) {
      bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }
  return bytes;
}

/**
 * FNV-1a 32-bit hash of the UTF-8 bytes of `input`, as an unsigned integer.
 *
 * @param input - Any string (hashed as UTF-8).
 * @returns An unsigned 32-bit integer in `[0, 2^32)`.
 *
 * @example
 * ```ts
 * fnv1a32("");  // 0x811c9dc5
 * fnv1a32("a"); // 0xe40c292c
 * ```
 */
export function fnv1a32(input: string): number {
  let h = FNV_OFFSET_BASIS;
  for (const byte of utf8(input)) {
    h = Math.imul((h ^ byte) >>> 0, FNV_PRIME) >>> 0;
  }
  return h;
}

/**
 * Maps a seed string to a stable number in `[0, 1)`: `fnv1a32(seed) / 2^32`.
 *
 * @param seed - The seed string.
 * @returns A deterministic number in `[0, 1)`.
 *
 * @example
 * ```ts
 * hashToUnit("hero:loc-1") === hashToUnit("hero:loc-1"); // true
 * ```
 */
export function hashToUnit(seed: string): number {
  return fnv1a32(seed) / TWO_POW_32;
}

/**
 * A deterministic `rng` for {@link pickVariant}: the n-th call returns
 * `hashToUnit(`${seed}#${n}`)`. Each returned generator has its own counter, so
 * two generators built from the same seed yield the same sequence.
 *
 * @param seed - The seed string.
 * @returns A `() => number` yielding values in `[0, 1)`.
 *
 * @example
 * ```ts
 * const rng = hashRng("hero:loc-1");
 * rng(); // hashToUnit("hero:loc-1#0")
 * rng(); // hashToUnit("hero:loc-1#1")
 * ```
 */
export function hashRng(seed: string): () => number {
  let n = 0;
  return () => hashToUnit(`${seed}#${n++}`);
}
