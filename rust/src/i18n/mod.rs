//! `i18n` — five-locale internationalisation (mirrors `@evinvest/i18n`).
//!
//! Zero-dependency and `wasm32`-safe: the locale registry, the URL contract,
//! `Accept-Language` negotiation, a small ICU-subset message formatter over
//! caller-supplied catalogues, and the translation [`policy`].
//!
//! This is the Rust half of a contract the TypeScript package already defines.
//! It exists because `real_estate_allocation` is a Dioxus app that cannot import
//! an npm package, and a zone rendering English chrome under a Russian shell is
//! the exact failure the shared registry was created to prevent. Both halves
//! read **the same `messages/<locale>/*.json` files** and apply the same rules,
//! so a catalogue is portable between them and neither can drift alone.
//!
//! **Why this hard-codes its locales**, unlike [`experiments`](crate::experiments):
//! experiment keys are per-app, but the same five locales apply to the public
//! site, the cabinet and every MFE, and having one place they are declared is the
//! entire point of putting this in a shared library. Helpers that iterate locales
//! still take a `locales` slice, so a surface shipping a subset is not forced to
//! claim all five. A surface outside that set — a brand landing that is `fr` by
//! default and prefixes every locale — builds a [`LocaleRegistry`] over its own
//! list and gets the same URL contract and negotiation.
//!
//! **Formatting numbers and money is deliberately NOT this module's job.** The
//! formatter supports `plural` and `select` but not `number`, `date` or
//! `currency`: consuming apps own one policy per unit of measure and interpolate
//! the already-formatted string. A second, competing number policy hiding inside
//! message catalogues is exactly the drift that rule exists to prevent. The one
//! exception is `#` inside a plural branch, which is the count itself — see
//! [`Locale::format_number`].
//!
//! **English is written where it renders.** Every lookup carries the English
//! sentence as authored at the call site, and `messages/en/common.json` is
//! generated back out of the code — so copy cannot be edited in one place and
//! read from another, and a key a translated catalogue lacks renders the
//! sentence the component asked for. Use the [`t!`](crate::t) macro, which makes
//! the compiler the literal-ness gate and registers the pair for extraction.
//!
//! ```
//! use ev_lib::{i18n::{Locale, Messages, Translator}, t};
//!
//! let mut messages = Messages::new();
//! messages.insert("cart.items".into(), "{n, plural, one {# товар} few {# товара} many {# товаров}}".into());
//! let tr = Translator::new(messages, Locale::Ru);
//!
//! assert_eq!(t!(tr, "cart.items", "{n, plural, one {# item} other {# items}}", n = 3.0), "3 товара");
//! assert_eq!(t!(tr, "nope", "Five hundred years of compounding"), "Five hundred years of compounding");
//! ```

use std::collections::BTreeMap;

mod format;
mod plural;
pub mod policy;
mod registry;
#[cfg(test)]
mod tests;

pub use format::{MessageValue, MessageValues, format_message};
pub use plural::PluralCategory;
pub use registry::{LocaleRegistry, LocaleRegistryConfig, RegistryError};

/// The locales EV publishes, in the order they are offered to a reader.
/// `En` is first because it is both the default and the authored source.
pub const LOCALES: [Locale; 5] = [Locale::En, Locale::Ru, Locale::Vi, Locale::Fr, Locale::De];

/// The authored source locale, and the fallback for any reader we cannot place.
/// Also the only locale whose URLs carry no prefix — see [`locale_path`].
pub const DEFAULT_LOCALE: Locale = Locale::En;

/// A loaded catalogue: flat `key → pattern`.
///
/// Flat rather than nested because the policy diffs and reports per
/// fully-qualified key, and a nested shape would make every one of those
/// operations a tree walk for no gain at the call site. `BTreeMap` rather than
/// `HashMap` so a report's key order is deterministic — a CI diff that reorders
/// itself between runs is not a diff.
pub type Messages = BTreeMap<String, String>;

impl Locale {
	/// The BCP 47 language subtag — what goes in `<html lang>` and a URL prefix.
	pub fn code(self) -> &'static str {
		match self {
			Self::En => "en",
			Self::Ru => "ru",
			Self::Vi => "vi",
			Self::Fr => "fr",
			Self::De => "de",
		}
	}

	/// This locale's name **in that locale** — what a language switcher must show.
	///
	/// A reader who cannot read the current language cannot read "Russian"
	/// either, so a switcher that localises its own option labels is unusable to
	/// the very person reaching for it.
	pub fn label(self) -> &'static str {
		match self {
			Self::En => "English",
			Self::Ru => "Русский",
			Self::Vi => "Tiếng Việt",
			Self::Fr => "Français",
			Self::De => "Deutsch",
		}
	}

	/// Parse untrusted input — a URL segment, a cookie, a query param.
	///
	/// ```
	/// use ev_lib::i18n::Locale;
	/// assert_eq!(Locale::parse("ru"), Some(Locale::Ru));
	/// assert_eq!(Locale::parse("vn"), None); // country code, not a language code
	/// ```
	pub fn parse(value: &str) -> Option<Self> {
		LOCALES.into_iter().find(|l| l.code() == value)
	}
}

impl std::fmt::Display for Locale {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		f.write_str(self.code())
	}
}

impl std::str::FromStr for Locale {
	type Err = UnknownLocale;

	fn from_str(s: &str) -> Result<Self, Self::Err> {
		Self::parse(s).ok_or_else(|| UnknownLocale(s.to_owned()))
	}
}

impl std::fmt::Display for UnknownLocale {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		write!(f, "unknown locale {:?} — EV publishes en, ru, vi, fr, de", self.0)
	}
}

impl std::error::Error for UnknownLocale {}

// ── URL contract ─────────────────────────────────────────────────────────────
//
// One rule, applied identically by the public site, the cabinet and every zone:
// the default locale is unprefixed, every other locale carries a `/<locale>`
// prefix.
//
//   en → /team          ru → /ru/team
//
// Unprefixed English means no already-indexed URL has to move and no redirect
// sits on the busiest route. The cost is that these functions are the only place
// that asymmetry may be expressed — hand-built locale URLs elsewhere drift
// immediately.

// ── Messages ─────────────────────────────────────────────────────────────────

impl Translator {
	/// Bind `messages` to `locale`.
	pub fn new(messages: Messages, locale: Locale) -> Self {
		Self { messages, locale }
	}

	/// The locale this translator renders in.
	pub fn locale(&self) -> Locale {
		self.locale
	}

	/// Render `key`, falling back to `en`, with no interpolation.
	pub fn t(&self, key: &str, en: &str) -> String {
		self.render(key, en, &MessageValues::new())
	}

	/// Render `key`, falling back to `en`, interpolating `values`.
	pub fn tv(&self, key: &str, en: &str, values: &MessageValues) -> String {
		self.render(key, en, values)
	}

	/// Render `key` with a single numeric argument — the common plural case.
	///
	/// ```
	/// use ev_lib::i18n::{Locale, Messages, Translator};
	/// let en = "{count, plural, one {# role} other {# roles}}";
	/// let mut m = Messages::new();
	/// m.insert("roles".into(), "{count, plural, one {# вакансия} few {# вакансии} many {# вакансий}}".into());
	/// let t = Translator::new(m, Locale::Ru);
	/// assert_eq!(t.count("roles", en, "count", 3.0), "3 вакансии");
	/// assert_eq!(t.count("nope", en, "count", 2.0), "2 roles");
	/// ```
	pub fn count(&self, key: &str, en: &str, name: &str, n: f64) -> String {
		let mut values = MessageValues::new();
		values.insert(name.to_owned(), MessageValue::Num(n));
		self.render(key, en, &values)
	}

	fn render(&self, key: &str, en: &str, values: &MessageValues) -> String {
		let pattern = if self.locale == DEFAULT_LOCALE {
			en
		} else {
			self.messages.get(key).map_or(en, String::as_str)
		};
		format_message(pattern, self.locale, values)
	}
}

/// Look up one string, and register it for extraction.
///
/// ```
/// use ev_lib::{i18n::{Locale, Messages, Translator}, t};
/// let tr = Translator::new(Messages::new(), Locale::En);
///
/// t!(tr, "hero.title", "Invest in the China+1 narrative");
/// t!(tr, "cart.items", "{n, plural, one {# item} other {# items}}", n = 2);
/// ```
///
/// `$key` and `$en` are `literal` fragments, so **the compiler is the
/// literal-ness gate** — the TypeScript extractor has to enforce that by hand,
/// and a key assembled at runtime is neither visible where it renders nor
/// greppable.
///
/// Natively, each site also registers its pair with [`i18n::catalogue`](catalogue).
/// Extraction is therefore *linking*, not parsing: a site that compiles is
/// registered whether or not it ever renders, which is what a recording
/// translator driven by one SSR pass could never promise — it would silently
/// drop every string behind a branch that did not run. The corollary, and the
/// ceiling: **copy must live in natively-compilable code.** For a microfrontend
/// the component-MFE snapshot contract already requires exactly that.
#[cfg(feature = "i18n")]
#[macro_export]
macro_rules! t {
	($tr:expr, $key:literal, $en:literal) => {{
		$crate::__i18n_register!($key, $en);
		$tr.t($key, $en)
	}};
	($tr:expr, $key:literal, $en:literal, $($name:ident = $value:expr),+ $(,)?) => {{
		$crate::__i18n_register!($key, $en);
		let mut values = $crate::i18n::MessageValues::new();
		$(values.insert(stringify!($name).to_owned(), $crate::i18n::MessageValue::from($value));)+
		$tr.tv($key, $en, &values)
	}};
}

/// The registration half of [`t!`], which is a no-op on `wasm32` so the shipped
/// bundle carries no extraction machinery.
#[cfg(all(feature = "i18n", not(target_arch = "wasm32")))]
#[doc(hidden)]
#[macro_export]
macro_rules! __i18n_register {
	($key:literal, $en:literal) => {
		$crate::i18n::inventory::submit! { $crate::i18n::Source { key: $key, en: $en } }
	};
}

#[cfg(all(feature = "i18n", target_arch = "wasm32"))]
#[doc(hidden)]
#[macro_export]
macro_rules! __i18n_register {
	($key:literal, $en:literal) => {};
}

// ── Extraction ───────────────────────────────────────────────────────────────

#[cfg(not(target_arch = "wasm32"))]
pub use inventory;

/// A catalogue bound to one locale, ready to render.
///
/// `en` is the English as authored at the call site; `key` is what a translated
/// catalogue files it under. A key the catalogue lacks renders `en` — the call
/// site has the correct sentence in hand, so putting a dotted key on screen
/// instead would be strictly worse. [`policy::audit`] is what *finds* missing
/// keys; the runtime's job is only to degrade legibly.
///
/// For [`Locale::En`] the catalogue is never consulted: it is generated back out
/// of these very strings, so there is nothing left to look up.
///
/// Prefer the [`t!`](crate::t) macro over calling these directly — it gates the
/// literal-ness the extractor needs, at compile time.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Translator {
	messages: Messages,
	locale: Locale,
}

/// Pick the best locale for an `Accept-Language` header, honouring q-values and
/// matching a bare language against a regional tag (`ru-RU` → `ru`).
///
/// Note what this is *for*. EV serves the default locale at unprefixed URLs and
/// never auto-redirects on it — Google crawls in English from a US IP, so a
/// language redirect can bury the other locales, and a reader who deliberately
/// chose English should not be bounced out of it. Use this to decide which
/// locale to *suggest*, not what to serve.
///
/// ```
/// use ev_lib::i18n::{LOCALES, Locale, negotiate};
/// assert_eq!(negotiate(Some("ru-RU,ru;q=0.9,en;q=0.8"), &LOCALES), Locale::Ru);
/// assert_eq!(negotiate(Some("ja,ko;q=0.8"), &LOCALES), Locale::En); // no match
/// assert_eq!(negotiate(None, &LOCALES), Locale::En);
/// ```
pub fn negotiate(header: Option<&str>, locales: &[Locale]) -> Locale {
	let Some(header) = header else {
		return DEFAULT_LOCALE;
	};
	for tag in ranked_tags(header) {
		// "ru-RU" and "ru" both match the "ru" catalogue.
		let base = tag.split('-').next().unwrap_or("");
		if let Some(hit) = locales.iter().find(|l| l.code() == tag || l.code() == base) {
			return *hit;
		}
		// "*" means "anything", for which the default is as good an answer as any.
		if tag == "*" {
			return DEFAULT_LOCALE;
		}
	}
	DEFAULT_LOCALE
}

/// The language tags of an `Accept-Language` header, lowercased, best first.
/// Shared by [`negotiate`] and [`LocaleRegistry::negotiate`] so the two cannot
/// rank one header differently.
fn ranked_tags(header: &str) -> Vec<String> {
	let mut ranked: Vec<(String, f64)> = header
		.split(',')
		.filter_map(|part| {
			let mut params = part.trim().split(';');
			let tag = params.next().unwrap_or("").trim().to_ascii_lowercase();
			let quality = params
				.map(str::trim)
				.find_map(|p| p.strip_prefix("q="))
				// A malformed or non-finite q= (`inf`, `NaN` — Rust parses both) is
				// dropped rather than outranking every real preference.
				.map_or(1.0, |q| q.parse::<f64>().ok().filter(|q| q.is_finite()).unwrap_or(0.0));
			// q=0 is an explicit refusal of that language, not a weak preference.
			(!tag.is_empty() && quality > 0.0).then_some((tag, quality))
		})
		.collect();

	// Stable sort: equal q-values keep the client's stated order, which is the
	// tie-break the header itself intends.
	ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
	ranked.into_iter().map(|(tag, _)| tag).collect()
}

/// Every locale's URL for one page — the shape an `hreflang` cluster wants.
///
/// ```
/// use ev_lib::i18n::{LOCALES, locale_alternates};
/// let alts = locale_alternates("/team", &LOCALES);
/// assert_eq!(alts[0].1, "/team");
/// assert_eq!(alts[1].1, "/ru/team");
/// ```
pub fn locale_alternates(path: &str, locales: &[Locale]) -> Vec<(Locale, String)> {
	locales.iter().map(|&l| (l, locale_path(l, path))).collect()
}

/// The inverse of [`locale_path`]: split a request path into its locale and the
/// locale-free path beneath it. An absent or unrecognised prefix reads as
/// [`DEFAULT_LOCALE`], so this never fails on arbitrary input.
///
/// ```
/// use ev_lib::i18n::{Locale, split_locale_path};
/// assert_eq!(split_locale_path("/ru/team"), (Locale::Ru, "/team".to_owned()));
/// assert_eq!(split_locale_path("/team"), (Locale::En, "/team".to_owned()));
/// assert_eq!(split_locale_path("/ru"), (Locale::Ru, "/".to_owned()));
/// ```
pub fn split_locale_path(pathname: &str) -> (Locale, String) {
	let clean = if pathname.starts_with('/') { pathname.to_owned() } else { format!("/{pathname}") };
	let after = &clean[1..];
	let (head, rest) = match after.find('/') {
		Some(idx) => (&after[..idx], &after[idx..]),
		None => (after, ""),
	};
	match Locale::parse(head) {
		Some(locale) if locale != DEFAULT_LOCALE => (locale, if rest.is_empty() { "/".to_owned() } else { rest.to_owned() }),
		_ => (DEFAULT_LOCALE, clean),
	}
}

/// The path `locale` serves `path` at.
///
/// ```
/// use ev_lib::i18n::{Locale, locale_path};
/// assert_eq!(locale_path(Locale::En, "/team"), "/team");
/// assert_eq!(locale_path(Locale::Ru, "/team"), "/ru/team");
/// assert_eq!(locale_path(Locale::Ru, "/"), "/ru");
/// ```
pub fn locale_path(locale: Locale, path: &str) -> String {
	let clean = if path.starts_with('/') { path.to_owned() } else { format!("/{path}") };
	if locale == DEFAULT_LOCALE {
		return clean;
	}
	// "/" would otherwise yield "/ru/", and a trailing slash is a distinct URL to
	// a crawler — one canonical shape per page, so strip it.
	if clean == "/" { format!("/{locale}") } else { format!("/{locale}{clean}") }
}

/// The error [`Locale::from_str`] returns for a tag EV does not publish.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UnknownLocale(pub String);

/// One of the five locales EV publishes.
///
/// Note `Vi` — Vietnamese — is the ISO 639-1 *language* code. `vn` is the ISO
/// 3166 *country* code for Vietnam and is not a valid `hreflang` / `lang` value;
/// Google silently discards invalid values, so the distinction is load-bearing.
#[derive(Clone, Copy, Debug, Default, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub enum Locale {
	#[default]
	En,
	Ru,
	Vi,
	Fr,
	De,
}

/// One `t!` call site, as the linker collected it.
#[cfg(not(target_arch = "wasm32"))]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Source {
	pub key: &'static str,
	pub en: &'static str,
}

#[cfg(not(target_arch = "wasm32"))]
inventory::collect!(Source);

/// A key registered twice with different English. The catalogue can hold only
/// one of them, so which one shipped would be decided by link order.
#[cfg(not(target_arch = "wasm32"))]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KeyConflict {
	pub key: String,
	pub first: String,
	pub second: String,
}

#[cfg(not(target_arch = "wasm32"))]
impl std::fmt::Display for KeyConflict {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		write!(f, "{:?} is registered as {:?} and as {:?}", self.key, self.first, self.second)
	}
}

#[cfg(not(target_arch = "wasm32"))]
impl std::error::Error for KeyConflict {}

/// The English catalogue, read out of every [`t!`] site linked into this binary.
///
/// Write it to `messages/en/common.json` and compare the committed file against
/// it in a test — that pair is the Rust half of `evinvest-i18n-{extract,check}`.
#[cfg(not(target_arch = "wasm32"))]
pub fn catalogue() -> Result<Messages, Vec<KeyConflict>> {
	let mut messages = Messages::new();
	let mut conflicts = Vec::new();
	for source in inventory::iter::<Source> {
		match messages.insert(source.key.to_owned(), source.en.to_owned()) {
			Some(first) if first != source.en => conflicts.push(KeyConflict {
				key: source.key.to_owned(),
				first,
				second: source.en.to_owned(),
			}),
			_ => {}
		}
	}
	if conflicts.is_empty() { Ok(messages) } else { Err(conflicts) }
}
