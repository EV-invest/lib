//! The composition root of a landing site: every brand fact the machinery
//! reads — routing, schema.org, `<head>`, the sitemap — arrives through one
//! validated [`Site`], instead of each builder importing the brand's constants.

use std::collections::BTreeMap;

use super::{
	place::{Place, PublicationField, PublicationPolicy},
	routing::GONE,
};
use crate::i18n::LocaleRegistry;

/// The key of the page every place has.
pub const HOME: &str = "home";
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BrandFacts {
	/// `brand_id` in analytics, the `data-brand` palette scope.
	pub id: String,
	pub name: String,
	pub legal_name: String,
	pub email: Option<String>,
	/// As printed, international; `None` → no `tel:` channel.
	pub phone: Option<String>,
	/// The apex; `None` → nothing is indexable and robots disallow everything.
	pub domain: Option<String>,
	/// schema.org type of each place's business node: `"Plumber"`, `"LocalBusiness"`…
	pub business_type: String,
	pub price_range: Option<String>,
}

/// How places map onto hosts.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Topology {
	/// One place per `<slug>.<domain>`; the apex is a directory of them.
	Subdomains,
	/// The whole site is one place, and its canonical origin is the apex.
	Single { place: String },
}

/// A path an earlier site served, and where it moved per locale prefix.
/// A prefix left out of `to` is still a live page there.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LegacyRedirect {
	pub from: String,
	/// `(prefix, target)`; `None` is the unprefixed path.
	pub to: Vec<(Option<String>, String)>,
}

impl LegacyRedirect {
	pub(crate) fn target(&self, locale: Option<&str>) -> Option<&str> {
		self.to.iter().find_map(|(prefix, target)| (prefix.as_deref() == locale).then_some(target.as_str()))
	}
}

/// Everything a site is declared with; [`Site::try_new`] validates it.
#[derive(Clone, Debug)]
pub struct SiteConfig {
	pub brand: BrandFacts,
	pub i18n: LocaleRegistry,
	/// `og:locale` per locale — a region is required there, unlike `hreflang`.
	/// A locale left out is derived from its `hreflang` (`fr-FR` → `fr_FR`).
	pub og_locale: BTreeMap<String, String>,
	pub topology: Topology,
	/// `(key, suffix)` for every indexable page of a place, in order; `home`
	/// is required. A suffix is `""` for home or `/<page>`.
	pub pages: Vec<(String, String)>,
	/// Every place the site has, baked; a live source may overlay them.
	pub places: Vec<Place>,
	/// Which fields a place must fill before it may be indexed.
	pub publication: PublicationPolicy,
	pub legacy_redirects: Vec<LegacyRedirect>,
	/// Files served as they are at the root — `/icon.svg`, `/llms.txt`. Only
	/// these pass the router untouched; any other path with an extension is a
	/// dead path like the rest.
	pub public_files: Vec<String>,
}

/// Why a [`SiteConfig`] was refused.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SiteError {
	NoHomePage,
	PageListedTwice(String),
	/// A suffix other than `""` must start with `/` and not end with one.
	BadPageSuffix(String),
	PlaceListedTwice(String),
	/// A slug must be `[a-z0-9-]`, not starting with `-`.
	BadPlaceSlug(String),
	/// `404` names the 404's own route.
	ReservedPlaceSlug(String),
	UnknownSinglePlace(String),
	/// A public file must be a path like `/icon.svg`: rooted, not a
	/// directory, not under `/_next/`.
	BadPublicFile(String),
	/// The router passes a file only without a locale; under one it is a
	/// page path.
	PublicFileUnderLocale(String),
}

impl std::fmt::Display for SiteError {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		match self {
			Self::NoHomePage => f.write_str("pages must include \"home\""),
			Self::PageListedTwice(key) => write!(f, "page {key:?} is listed twice"),
			Self::BadPageSuffix(suffix) => write!(f, "page suffix {suffix:?} must be \"\" or \"/<page>\""),
			Self::PlaceListedTwice(slug) => write!(f, "place slug {slug:?} is listed twice"),
			Self::BadPlaceSlug(slug) => write!(f, "place slug {slug:?} must be [a-z0-9-], not starting with \"-\""),
			Self::ReservedPlaceSlug(slug) => write!(f, "place slug {slug:?} is reserved for the 404 route"),
			Self::UnknownSinglePlace(slug) => write!(f, "topology place {slug:?} is not one of the places"),
			Self::BadPublicFile(file) => write!(f, "public file {file:?} must be a path like \"/icon.svg\""),
			Self::PublicFileUnderLocale(file) => write!(f, "public file {file:?} must not sit under a locale"),
		}
	}
}

impl std::error::Error for SiteError {}

/// One indexable page of a place.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Page<'a> {
	pub key: &'a str,
	/// `""` for home, `/prices` for a subpage.
	pub suffix: &'a str,
}

impl Page<'_> {
	pub fn is_home(&self) -> bool {
		self.key == HOME
	}
}

/// How a place's links are written on a page. On its own host a page is
/// `/fr/prices` (`Host`); reached through the apex it is `/fr/<slug>/prices`
/// (`Path`). The router says which by the route it rewrites to.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum LinkMode {
	Host,
	Path,
}

/// A validated [`SiteConfig`].
#[derive(Clone, Debug)]
pub struct Site {
	config: SiteConfig,
}

impl Site {
	pub fn try_new(config: SiteConfig) -> Result<Self, SiteError> {
		let mut keys: Vec<&str> = Vec::with_capacity(config.pages.len());
		for (key, suffix) in &config.pages {
			if keys.contains(&key.as_str()) {
				return Err(SiteError::PageListedTwice(key.clone()));
			}
			// One spelling per page: `/prices/` would be a second URL for `/prices`.
			if !suffix.is_empty() && (!suffix.starts_with('/') || suffix.ends_with('/') || suffix.contains("//")) {
				return Err(SiteError::BadPageSuffix(suffix.clone()));
			}
			keys.push(key);
		}
		if !keys.contains(&HOME) {
			return Err(SiteError::NoHomePage);
		}
		let mut slugs: Vec<&str> = Vec::with_capacity(config.places.len());
		for place in &config.places {
			let slug = place.slug.as_str();
			if slugs.contains(&slug) {
				return Err(SiteError::PlaceListedTwice(slug.to_owned()));
			}
			// The host-mode route param is `_<slug>`; a slug starting with the
			// mark would read back as a different place.
			let valid = slug.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-') && !slug.is_empty() && !slug.starts_with('-');
			if !valid {
				return Err(SiteError::BadPlaceSlug(slug.to_owned()));
			}
			// `/<locale>/404/404` is the router's route to the 404.
			if slug == GONE {
				return Err(SiteError::ReservedPlaceSlug(slug.to_owned()));
			}
			slugs.push(slug);
		}
		if let Topology::Single { place } = &config.topology
			&& !slugs.contains(&place.as_str())
		{
			return Err(SiteError::UnknownSinglePlace(place.clone()));
		}
		for file in &config.public_files {
			if !file.starts_with('/') || file.ends_with('/') || file.starts_with("/_next/") {
				return Err(SiteError::BadPublicFile(file.clone()));
			}
			if config.i18n.is_locale(file.split('/').nth(1).unwrap_or("")) {
				return Err(SiteError::PublicFileUnderLocale(file.clone()));
			}
		}
		Ok(Self { config })
	}

	pub fn config(&self) -> &SiteConfig {
		&self.config
	}

	pub fn brand(&self) -> &BrandFacts {
		&self.config.brand
	}

	pub fn i18n(&self) -> &LocaleRegistry {
		&self.config.i18n
	}

	pub fn topology(&self) -> &Topology {
		&self.config.topology
	}

	pub fn places(&self) -> &[Place] {
		&self.config.places
	}

	pub fn publication(&self) -> &PublicationPolicy {
		&self.config.publication
	}

	/// Every page, in declaration order.
	pub fn pages(&self) -> impl ExactSizeIterator<Item = Page<'_>> {
		self.config.pages.iter().map(|(key, suffix)| Page { key, suffix })
	}

	pub fn page(&self, key: &str) -> Option<Page<'_>> {
		self.pages().find(|p| p.key == key)
	}

	pub fn home(&self) -> Page<'_> {
		self.page(HOME).expect("Site::try_new refuses a config without a home page")
	}

	pub fn place_slugs(&self) -> impl Iterator<Item = &str> {
		self.config.places.iter().map(|p| p.slug.as_str())
	}

	pub(crate) fn has_place(&self, slug: &str) -> bool {
		self.place_slugs().any(|s| s == slug)
	}

	/// The baked place for a slug, if the site has it.
	pub fn baked_place(&self, slug: &str) -> Option<&Place> {
		self.config.places.iter().find(|p| p.slug == slug)
	}

	/// What `place` still lacks before this site's publication policy lets it
	/// be indexed.
	pub fn publication_gaps(&self, place: &Place) -> Vec<PublicationField> {
		self.publication().gaps(place)
	}

	/// Whether `place` may be indexed: the site has a domain and the place
	/// fills every field its policy requires.
	pub fn is_published(&self, place: &Place) -> bool {
		self.publication().is_published(place, self.brand().domain.as_deref())
	}

	/// `og:locale` for a locale: the configured one, else its `hreflang` with `_`.
	pub fn og_locale_of(&self, locale: &str) -> String {
		self.config
			.og_locale
			.get(locale)
			.cloned()
			.unwrap_or_else(|| self.i18n().hreflang_of(locale).replacen('-', "_", 1))
	}

	/// `https://<domain>`, or `None` for a site with no domain yet.
	pub fn origin(&self) -> Option<String> {
		self.brand().domain.as_ref().map(|d| format!("https://{d}"))
	}

	/// Where a place's pages canonically live: its subdomain on a
	/// `Subdomains` site, the apex on a `Single` one — whichever URL served
	/// the request.
	pub fn place_origin(&self, slug: &str) -> Option<String> {
		let domain = self.brand().domain.as_ref()?;
		Some(match self.topology() {
			Topology::Single { .. } => format!("https://{domain}"),
			Topology::Subdomains => format!("https://{slug}.{domain}"),
		})
	}

	/// The canonical URL of a place's page. A site with no domain has no
	/// absolute URL to give; the root-relative path it serves is the honest
	/// answer, and every page of such a site is `noindex` anyway.
	pub fn place_url(&self, slug: &str, locale: &str, suffix: &str) -> String {
		match self.place_origin(slug) {
			Some(origin) => format!("{origin}/{locale}{suffix}"),
			None => {
				let mode = if matches!(self.topology(), Topology::Single { .. }) {
					LinkMode::Host
				} else {
					LinkMode::Path
				};
				place_href(mode, slug, locale, suffix)
			}
		}
	}

	/// The numbers a place answers on: its own, or the brand's until it has one.
	pub fn contact_of<'a>(&'a self, place: &'a Place) -> Contact<'a> {
		let brand = self.brand().phone.as_deref();
		Contact {
			phone: place.channels.phone.as_deref().or(brand),
			whatsapp: place.channels.whatsapp.as_deref().or(brand),
		}
	}
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Contact<'a> {
	pub phone: Option<&'a str>,
	pub whatsapp: Option<&'a str>,
}

/// A root-relative href to one of a place's pages. `suffix` is a page suffix
/// and may carry a fragment: `"#quote"`, `"/prices#faq"`.
pub fn place_href(mode: LinkMode, slug: &str, locale: &str, suffix: &str) -> String {
	match mode {
		LinkMode::Host => format!("/{locale}{suffix}"),
		LinkMode::Path => format!("/{locale}/{slug}{suffix}"),
	}
}

/// A place as one request sees it: the merged record, the locale, and how its
/// links are written on this host. Builders take this instead of eight
/// arguments.
#[derive(Clone, Copy, Debug)]
pub struct PlaceView<'a> {
	pub site: &'a Site,
	pub place: &'a Place,
	pub locale: &'a str,
	pub mode: LinkMode,
}

impl<'a> PlaceView<'a> {
	pub fn new(site: &'a Site, place: &'a Place, locale: &'a str, mode: LinkMode) -> Self {
		Self { site, place, locale, mode }
	}

	/// Root-relative link to one of this place's pages, in this view's locale.
	pub fn href(&self, suffix: &str) -> String {
		place_href(self.mode, &self.place.slug, self.locale, suffix)
	}

	/// The same link in another locale — a language switcher's target.
	pub fn href_in(&self, locale: &str, suffix: &str) -> String {
		place_href(self.mode, &self.place.slug, locale, suffix)
	}

	/// Canonical URL — absolute once the site has a domain.
	pub fn url(&self, suffix: &str) -> String {
		self.site.place_url(&self.place.slug, self.locale, suffix)
	}
}
