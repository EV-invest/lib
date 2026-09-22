//! Deterministic hash bucketing — the byte-for-byte twin of the TS
//! `hashToUnit` / `hashRng` / `pickVariantFor` in `@evinvest/experiments`.
//!
//! The contract both sides implement:
//! - `fnv1a32` is 32-bit FNV-1a over the UTF-8 bytes of the input
//!   (offset basis `0x811C9DC5`, prime `0x01000193`, wrapping multiply);
//! - `hash_to_unit(seed) = fnv1a32(seed) / 2^32`, a value in `[0, 1)`;
//! - the `n`-th call (`n = 0, 1, 2, …`) of `hash_rng(seed)` returns
//!   `hash_to_unit("{seed}#{n}")`;
//! - `pick_variant_for(exp, key, subject)` draws from `hash_rng("{key}:{subject}")`.
//!
//! Changing any of this reshuffles every subject's bucket and breaks parity with
//! TS, so the test vectors below pin it.
//!
//! Everything here is allocation-free: FNV-1a is a streaming hash, so the seed
//! strings above are fed piecewise instead of being `format!`-ed.

use super::{Experiment, pick_variant};

const FNV_OFFSET_BASIS: u32 = 0x811c_9dc5;
const FNV_PRIME: u32 = 0x0100_0193;
/// `2^32` — divides a `u32` hash into `[0, 1)`; exactly representable in `f64`.
const U32_RANGE: f64 = 4_294_967_296.0;

/// 32-bit FNV-1a over `bytes` (offset basis `0x811C9DC5`, prime `0x01000193`).
///
/// # Examples
/// ```
/// use ev_lib::experiments::fnv1a32;
/// assert_eq!(fnv1a32(b""), 0x811C_9DC5);
/// assert_eq!(fnv1a32(b"a"), 0xE40C_292C);
/// assert_eq!(fnv1a32("foobar".as_bytes()), 0xBF9C_F968);
/// ```
pub const fn fnv1a32(bytes: &[u8]) -> u32 {
	Fnv1a::new().write(bytes).0
}

/// Maps `seed` to a deterministic value in `[0, 1)`: `fnv1a32(seed) / 2^32`,
/// hashing the UTF-8 bytes (mirrors the TS `hashToUnit`).
///
/// # Examples
/// ```
/// use ev_lib::experiments::hash_to_unit;
/// let u = hash_to_unit("exp:loc-1");
/// assert!((0.0..1.0).contains(&u));
/// assert_eq!(u, hash_to_unit("exp:loc-1"));
/// ```
pub fn hash_to_unit(seed: &str) -> f64 {
	Fnv1a::new().write(seed.as_bytes()).to_unit()
}

/// A deterministic random source seeded by `seed`: the `n`-th call returns
/// `hash_to_unit("{seed}#{n}")` (mirrors the TS `hashRng`). Plug it into
/// [`pick_variant`] wherever a stable, cookie-free draw is needed.
///
/// The returned closure does not borrow `seed`, and never allocates.
///
/// # Examples
/// ```
/// use ev_lib::experiments::{hash_rng, hash_to_unit};
/// let mut rng = hash_rng("seed");
/// assert_eq!(rng(), hash_to_unit("seed#0"));
/// assert_eq!(rng(), hash_to_unit("seed#1"));
/// ```
pub fn hash_rng(seed: &str) -> impl FnMut() -> f64 + use<> {
	rng_from_prefix(Fnv1a::new().write(seed.as_bytes()))
}

/// Picks a variant deterministically for `subject` (a location id, a user id…)
/// in the experiment `key`: [`pick_variant`] driven by
/// [`hash_rng`]`("{key}:{subject}")` (mirrors the TS `pickVariantFor`).
///
/// The same `(key, subject)` always lands on the same variant, so no cookie is
/// read or written and pages stay static. `key` is part of the seed so one
/// subject is bucketed independently across experiments.
///
/// # Examples
/// ```
/// use ev_lib::experiments::{Experiment, pick_variant_for};
/// let exp = Experiment::uniform(["a", "b"]);
/// let v = pick_variant_for(&exp, "hero", "loc-1");
/// assert_eq!(v, pick_variant_for(&exp, "hero", "loc-1"));
/// assert!(exp.variants.contains(&v));
/// ```
pub fn pick_variant_for(exp: &Experiment, key: &str, subject: &str) -> String {
	let seed = Fnv1a::new().write(key.as_bytes()).write(b":").write(subject.as_bytes());
	pick_variant(exp, rng_from_prefix(seed))
}

/// Streaming FNV-1a state, so composite seeds hash without being concatenated.
#[derive(Clone, Copy)]
struct Fnv1a(u32);

impl Fnv1a {
	const fn new() -> Self {
		Self(FNV_OFFSET_BASIS)
	}

	const fn write(mut self, bytes: &[u8]) -> Self {
		let mut i = 0;
		while i < bytes.len() {
			self.0 ^= bytes[i] as u32;
			self.0 = self.0.wrapping_mul(FNV_PRIME);
			i += 1;
		}
		self
	}

	/// Feeds the decimal digits of `n`, the same bytes `format!("{n}")` would produce.
	fn write_decimal(self, mut n: u64) -> Self {
		// u64::MAX has 20 decimal digits.
		let mut buf = [0u8; 20];
		let mut start = buf.len();
		loop {
			start -= 1;
			buf[start] = b'0' + (n % 10) as u8;
			n /= 10;
			if n == 0 {
				break;
			}
		}
		self.write(&buf[start..])
	}

	fn to_unit(self) -> f64 {
		f64::from(self.0) / U32_RANGE
	}
}

/// The shared tail of [`hash_rng`] and [`pick_variant_for`]: `prefix` has already
/// absorbed the seed, each call continues it with `#<n>`.
fn rng_from_prefix(prefix: Fnv1a) -> impl FnMut() -> f64 {
	let prefix = prefix.write(b"#");
	let mut n: u64 = 0;
	move || {
		let unit = prefix.write_decimal(n).to_unit();
		n += 1;
		unit
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn fnv1a32_matches_reference_vectors() {
		assert_eq!(fnv1a32(b""), 0x811c_9dc5);
		assert_eq!(fnv1a32(b"a"), 0xe40c_292c);
		assert_eq!(fnv1a32(b"foobar"), 0xbf9c_f968);
	}

	#[test]
	fn hash_to_unit_is_fnv_over_two_pow_32() {
		for seed in ["", "a", "foobar", "exp:loc-1", "héllo"] {
			assert_eq!(hash_to_unit(seed), f64::from(fnv1a32(seed.as_bytes())) / U32_RANGE, "seed={seed}");
		}
		assert_eq!(hash_to_unit(""), f64::from(0x811c_9dc5_u32) / U32_RANGE);
	}

	#[test]
	fn hash_to_unit_hashes_utf8_bytes() {
		// "é" is two UTF-8 bytes (0xC3 0xA9); hashing chars or UTF-16 units would differ.
		assert_eq!(hash_to_unit("héllo"), f64::from(fnv1a32(&[b'h', 0xc3, 0xa9, b'l', b'l', b'o'])) / U32_RANGE);
	}

	#[test]
	fn hash_to_unit_stays_below_one() {
		// fnv1a32 can reach u32::MAX; dividing by 2^32 (not u32::MAX) keeps it < 1.
		assert!(f64::from(u32::MAX) / U32_RANGE < 1.0);
	}

	#[test]
	fn hash_rng_nth_call_hashes_seed_hash_n() {
		let mut rng = hash_rng("exp:loc-1");
		for n in 0..1_200 {
			assert_eq!(rng(), hash_to_unit(&format!("exp:loc-1#{n}")), "n={n}");
		}
	}

	#[test]
	fn hash_rng_is_reproducible_and_seed_sensitive() {
		let draws = |seed: &str| {
			let mut rng = hash_rng(seed);
			[rng(), rng(), rng()]
		};
		assert_eq!(draws("s"), draws("s"));
		assert_ne!(draws("s"), draws("t"));
	}

	#[test]
	fn write_decimal_matches_display() {
		for n in [0, 1, 9, 10, 99, 100, 12_345, u64::MAX] {
			assert_eq!(Fnv1a::new().write_decimal(n).0, fnv1a32(n.to_string().as_bytes()), "n={n}");
		}
	}

	#[test]
	fn pick_variant_for_equals_pick_variant_with_seeded_rng() {
		let exp = Experiment::new(["a", "b", "c"], [1.0, 2.0, 3.0]);
		for subject in ["loc-1", "loc-2", "héllo", ""] {
			let expected = pick_variant(&exp, hash_rng(&format!("hero:{subject}")));
			assert_eq!(pick_variant_for(&exp, "hero", subject), expected, "subject={subject}");
		}
	}

	#[test]
	fn pick_variant_for_spreads_subjects_across_variants() {
		let exp = Experiment::uniform(["a", "b"]);
		let a = (0..1_000).filter(|i| pick_variant_for(&exp, "hero", &format!("loc-{i}")) == "a").count();
		// A fair 50/50 split over 1000 subjects; ±10 % leaves ample slack for a fixed hash.
		assert!((400..=600).contains(&a), "a={a}");
	}

	#[test]
	fn pick_variant_for_empty_experiment_returns_empty_string() {
		let exp = Experiment::new(Vec::<String>::new(), Vec::<f64>::new());
		assert_eq!(pick_variant_for(&exp, "hero", "loc-1"), "");
	}

	#[test]
	fn hash_to_unit_matches_ts_parity_vectors() {
		// The same literals are asserted by the TS `hashToUnit` tests; a drift on
		// either side breaks the per-subject split across the two stacks.
		assert_eq!(fnv1a32("exp:loc-1".as_bytes()), 0xb8cc_48a2);
		assert_eq!(hash_to_unit("exp:loc-1"), 0.7218671222217381);
		assert_eq!(fnv1a32("exp:loc-2".as_bytes()), 0xb7cc_470f);
		assert_eq!(hash_to_unit("exp:loc-2"), 0.7179607783909887);
		assert_eq!(fnv1a32("héllo".as_bytes()), 0x4aa4_8540);
		assert_eq!(hash_to_unit("héllo"), 0.2915728837251663);
	}
}
