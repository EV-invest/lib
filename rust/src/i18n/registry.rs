//! A locale registry over a caller's own list — the Rust half of TS
//! `createLocaleRegistry`.
//!
//! The free functions in [`super`] are fixed to EV's five locales and to
//! "the default is unprefixed". A surface with its own languages — a French
//! storefront that is `fr` by default and prefixes every locale — gets the same
//! URL contract and the same negotiation here instead of a hand-rolled copy
//! that drifts. Locales are plain codes (`"fr"`), validated once at
//! construction; every accessor then answers with the registry's own `&str`.

use super::ranked_tags;

/// What a [`LocaleRegistry`] is built from.
///
/// ```
/// use ev_lib::i18n::{LocaleRegistry, LocaleRegistryConfig};
/// let i18n = LocaleRegistry::try_new(LocaleRegistryConfig {
///     locales: vec![("fr".into(), "Français".into()), ("en".into(), "English".into())],
///     default: "fr".into(),
///     prefix_default_locale: true,
///     hreflang: vec![("fr".into(), "fr-FR".into())],
/// })
/// .unwrap();
/// assert_eq!(i18n.locale_path("fr", "/contact"), "/fr/contact");
/// assert_eq!(i18n.hreflang_of("fr"), "fr-FR");
/// assert_eq!(i18n.negotiate(Some("en-GB,fr;q=0.5")), "en");
/// ```
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct LocaleRegistryConfig {
	/// `(code, label)` in the order a language switcher offers them. The code is
	/// the URL segment, so keep it a bare language; the label is the locale's
	/// name in that locale.
	pub locales: Vec<(String, String)>,
	/// The fallback for any reader we cannot place.
	pub default: String,
	/// Whether the default locale's URLs carry a `/<locale>` prefix too.
	pub prefix_default_locale: bool,
	/// `(code, tag)` for a locale advertised under a regional `hreflang`
	/// (`fr` → `fr-FR`). A locale left out advertises its bare code.
	pub hreflang: Vec<(String, String)>,
}

/// Why a [`LocaleRegistryConfig`] was refused. Each would make the URL contract
/// ambiguous, so it fails at startup rather than on the first request.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RegistryError {
	NoLocales,
	DefaultNotListed(String),
	ListedTwice(String),
	/// An `hreflang` entry for a code that is not one of the locales.
	UnknownHreflangLocale(String),
	/// `x-default` names the fallback; no locale may be advertised under it.
	ReservedHreflang(String),
	/// Two locales advertised under one tag collapse into one alternate.
	HreflangCollision(String),
}

impl std::fmt::Display for RegistryError {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		match self {
			Self::NoLocales => f.write_str("a locale registry needs at least one locale"),
			Self::DefaultNotListed(code) => write!(f, "default locale {code:?} is not one of the locales"),
			Self::ListedTwice(code) => write!(f, "locale {code:?} is listed more than once"),
			Self::UnknownHreflangLocale(code) => write!(f, "hreflang is given for {code:?}, which is not one of the locales"),
			Self::ReservedHreflang(code) => write!(f, "locale {code:?} cannot be advertised as \"x-default\""),
			Self::HreflangCollision(tag) => write!(f, "hreflang tag {tag:?} is used by more than one locale"),
		}
	}
}

impl std::error::Error for RegistryError {}

/// One locale set with everything that depends on it: the URL contract,
/// `hreflang` clusters and `Accept-Language` negotiation.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LocaleRegistry {
	entries: Vec<Entry>,
	default: usize,
	prefix_default_locale: bool,
}
impl LocaleRegistry {
	/// Validate `config` and build the registry.
	pub fn try_new(config: LocaleRegistryConfig) -> Result<Self, RegistryError> {
		if config.locales.is_empty() {
			return Err(RegistryError::NoLocales);
		}
		let mut entries: Vec<Entry> = Vec::with_capacity(config.locales.len());
		for (code, label) in config.locales {
			if entries.iter().any(|e| e.code == code) {
				return Err(RegistryError::ListedTwice(code));
			}
			entries.push(Entry {
				hreflang: code.clone(),
				code,
				label,
			});
		}
		for (code, tag) in config.hreflang {
			let entry = entries.iter_mut().find(|e| e.code == code).ok_or(RegistryError::UnknownHreflangLocale(code))?;
			entry.hreflang = tag;
		}
		// Checked on the effective tags, bare-code fallbacks included.
		for (i, entry) in entries.iter().enumerate() {
			if entry.hreflang.eq_ignore_ascii_case("x-default") {
				return Err(RegistryError::ReservedHreflang(entry.code.clone()));
			}
			if entries[..i].iter().any(|e| e.hreflang.eq_ignore_ascii_case(&entry.hreflang)) {
				return Err(RegistryError::HreflangCollision(entry.hreflang.clone()));
			}
		}
		let default = entries.iter().position(|e| e.code == config.default).ok_or(RegistryError::DefaultNotListed(config.default))?;
		Ok(Self {
			entries,
			default,
			prefix_default_locale: config.prefix_default_locale,
		})
	}

	/// Every locale, in switcher order.
	pub fn locales(&self) -> impl ExactSizeIterator<Item = &str> + '_ {
		self.entries.iter().map(|e| e.code.as_str())
	}

	pub fn default_locale(&self) -> &str {
		&self.entries[self.default].code
	}

	pub fn prefix_default_locale(&self) -> bool {
		self.prefix_default_locale
	}

	/// Narrow untrusted input — a URL segment, a cookie, a query param — to one
	/// of the registry's locales.
	pub fn locale(&self, value: &str) -> Option<&str> {
		self.entry(value).map(|e| e.code.as_str())
	}

	pub fn is_locale(&self, value: &str) -> bool {
		self.entry(value).is_some()
	}

	/// The locale's name in that locale — what a switcher must show.
	pub fn label(&self, locale: &str) -> Option<&str> {
		self.entry(locale).map(|e| e.label.as_str())
	}

	/// The `hreflang` tag a locale is advertised under; an unknown code is
	/// advertised as itself.
	pub fn hreflang_of<'a>(&'a self, locale: &'a str) -> &'a str {
		self.entry(locale).map_or(locale, |e| e.hreflang.as_str())
	}

	/// The path `locale` serves `path` at.
	pub fn locale_path(&self, locale: &str, path: &str) -> String {
		let clean = if path.starts_with('/') { path.to_owned() } else { format!("/{path}") };
		if !self.is_prefixed(locale) {
			return clean;
		}
		// "/" would otherwise yield "/fr/", and a trailing slash is a distinct URL
		// to a crawler.
		if clean == "/" { format!("/{locale}") } else { format!("/{locale}{clean}") }
	}

	/// Split a request path into its locale and the locale-free path beneath
	/// it. An absent or unrecognised prefix reads as the default locale.
	pub fn split_locale_path(&self, pathname: &str) -> (&str, String) {
		let clean = if pathname.starts_with('/') { pathname.to_owned() } else { format!("/{pathname}") };
		let after = &clean[1..];
		let (head, rest) = after.find('/').map_or((after, ""), |i| (&after[..i], &after[i..]));
		match self.locale(head) {
			// An explicit `/<default>` segment is not a prefix when the default is
			// unprefixed: it stays part of the path, like any stray segment.
			Some(locale) if self.is_prefixed(locale) => (locale, if rest.is_empty() { "/".to_owned() } else { rest.to_owned() }),
			_ => (self.default_locale(), clean),
		}
	}

	/// Every locale's root-relative URL for one page, in switcher order.
	pub fn locale_alternates(&self, path: &str) -> Vec<(&str, String)> {
		self.locales().map(|l| (l, self.locale_path(l, path))).collect()
	}

	/// Absolute URLs for one page keyed by `hreflang` tag, in switcher order,
	/// then `x-default` on the default locale's URL.
	pub fn language_alternates(&self, path: &str, site_url: &str) -> Vec<(String, String)> {
		let origin = site_url.trim_end_matches('/');
		let mut out: Vec<(String, String)> = self
			.entries
			.iter()
			.map(|e| (e.hreflang.clone(), format!("{origin}{}", self.locale_path(&e.code, path))))
			.collect();
		out.push(("x-default".to_owned(), format!("{origin}{}", self.locale_path(self.default_locale(), path))));
		out
	}

	/// Best locale for an `Accept-Language` header — for suggesting, not serving.
	pub fn negotiate(&self, header: Option<&str>) -> &str {
		let Some(header) = header else {
			return self.default_locale();
		};
		for tag in ranked_tags(header) {
			let base = tag.split('-').next().unwrap_or("");
			if let Some(hit) = self.entries.iter().find(|e| {
				let code = e.code.to_ascii_lowercase();
				code == tag || code == base
			}) {
				return &hit.code;
			}
			if tag == "*" {
				return self.default_locale();
			}
		}
		self.default_locale()
	}

	fn entry(&self, code: &str) -> Option<&Entry> {
		self.entries.iter().find(|e| e.code == code)
	}

	fn is_prefixed(&self, locale: &str) -> bool {
		self.prefix_default_locale || locale != self.default_locale()
	}
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct Entry {
	code: String,
	label: String,
	hreflang: String,
}
