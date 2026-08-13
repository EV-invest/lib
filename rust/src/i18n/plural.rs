//! CLDR plural categories and number grouping for EV's five locales.
//!
//! In the TypeScript mirror these two jobs belong to the platform:
//! `Intl.PluralRules` selects the category and `Intl.NumberFormat` renders `#`.
//! Rust has neither in `std`, and pulling ICU4X in would add a multi-megabyte
//! data dependency to a crate whose whole point is that it is dep-light.
//!
//! So both are hand-written — but only for the five locales EV publishes, which
//! is what makes that defensible. This is not a general i18n library and must
//! never grow into one: adding a sixth locale means transcribing its CLDR rule
//! here deliberately, which is exactly the review moment a silent generic
//! fallback would rob us of. The rules below are transcribed from CLDR 46
//! `plurals.xml`; the tests pin the boundary values that distinguish them.

use super::Locale;

/// A CLDR plural category. `Zero` and `Two` are unused by EV's five locales but
/// named so the enum matches CLDR rather than our current subset — a locale
/// that needs them should not require widening this type under time pressure.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum PluralCategory {
	Zero,
	One,
	Two,
	Few,
	Many,
	Other,
}

impl PluralCategory {
	/// The CLDR keyword, which is also the branch key used in a message pattern.
	pub fn as_str(self) -> &'static str {
		match self {
			Self::Zero => "zero",
			Self::One => "one",
			Self::Two => "two",
			Self::Few => "few",
			Self::Many => "many",
			Self::Other => "other",
		}
	}
}

impl std::fmt::Display for PluralCategory {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		f.write_str(self.as_str())
	}
}

impl Locale {
	/// Every plural category this locale can select — the mirror of
	/// `Intl.PluralRules(locale).resolvedOptions().pluralCategories`.
	///
	/// This is the arithmetic half of the translation policy: a Russian plural
	/// that only carries `one`/`other` is *provably* not equivalent to an English
	/// one, because Russian can select `few` and `many` for real counts.
	pub fn plural_categories(self) -> &'static [PluralCategory] {
		use PluralCategory as P;
		match self {
			// i = 1 and v = 0 → one; otherwise other.
			Locale::En | Locale::De => &[P::One, P::Other],
			// Vietnamese has no plural inflection at all — one branch covers it.
			Locale::Vi => &[P::Other],
			// French: `one` covers 0 and 1; `many` is the compact-millions rule.
			Locale::Fr => &[P::One, P::Many, P::Other],
			Locale::Ru => &[P::Few, P::Many, P::One, P::Other],
		}
	}

	/// Select the plural category for `n` — the mirror of
	/// `Intl.PluralRules(locale).select(n)`.
	///
	/// A non-integer always selects `Other` in every locale EV publishes: each of
	/// their CLDR rules requires `v = 0` (no visible fraction digits) for any
	/// category other than `other`, so this is the rule, not a shortcut.
	pub fn select_plural(self, n: f64) -> PluralCategory {
		use PluralCategory as P;

		if !n.is_finite() {
			return P::Other;
		}
		// `v` in CLDR terms: fraction digits present. All five locales gate every
		// non-`other` category on v = 0.
		if n.fract() != 0.0 {
			return P::Other;
		}
		// CLDR's `i` is the integer digits — the absolute value. "-1 item" takes
		// the same branch as "1 item"; the sign is not a plural distinction.
		let i = n.abs() as u64;

		match self {
			Locale::En | Locale::De =>
				if i == 1 {
					P::One
				} else {
					P::Other
				},
			Locale::Vi => P::Other,
			Locale::Fr => {
				if i == 0 || i == 1 {
					P::One
				// e = 0 and i != 0 and i % 1000000 = 0 and v = 0 → many.
				} else if i != 0 && i.is_multiple_of(1_000_000) {
					P::Many
				} else {
					P::Other
				}
			}
			Locale::Ru => {
				let m10 = i % 10;
				let m100 = i % 100;
				if m10 == 1 && m100 != 11 {
					P::One
				} else if (2..=4).contains(&m10) && !(12..=14).contains(&m100) {
					P::Few
				} else {
					// m10 == 0, or 5..=9, or m100 in 11..=14.
					P::Many
				}
			}
		}
	}

	/// Group separator and decimal separator, as `Intl.NumberFormat` uses them.
	///
	/// French and Russian group with a *space*, and which space matters: CLDR
	/// moved French to U+202F (narrow no-break) and Russian uses U+00A0
	/// (no-break). A plain ASCII space would let a number wrap across a line.
	fn separators(self) -> (&'static str, &'static str) {
		match self {
			Locale::En => (",", "."),
			Locale::De | Locale::Vi => (".", ","),
			Locale::Fr => ("\u{202f}", ","),
			Locale::Ru => ("\u{a0}", ","),
		}
	}

	/// Render `n` the way this locale writes numbers — what `#` becomes inside a
	/// plural branch.
	///
	/// Deliberately minimal: grouping and the decimal separator, nothing else. No
	/// currency, no units, no notation. That is the same line the TypeScript
	/// module draws, and for the same reason — a consuming app owns one policy
	/// per unit of measure, and a second one hiding inside message catalogues is
	/// precisely the drift that rule exists to prevent.
	pub fn format_number(self, n: f64) -> String {
		if !n.is_finite() {
			return n.to_string();
		}
		let (group, decimal) = self.separators();

		let negative = n.is_sign_negative() && n != 0.0;
		let plain = format!("{}", n.abs());
		let (int_part, frac_part) = match plain.split_once('.') {
			Some((i, f)) => (i, Some(f)),
			None => (plain.as_str(), None),
		};

		// Group the integer part in threes from the right.
		let digits: Vec<char> = int_part.chars().collect();
		let mut grouped = String::new();
		for (idx, ch) in digits.iter().enumerate() {
			if idx > 0 && (digits.len() - idx).is_multiple_of(3) {
				grouped.push_str(group);
			}
			grouped.push(*ch);
		}

		let mut out = String::new();
		if negative {
			out.push('-');
		}
		out.push_str(&grouped);
		if let Some(frac) = frac_part {
			out.push_str(decimal);
			out.push_str(frac);
		}
		out
	}
}
