//! A page's `<head>`: title, description, robots, canonical and `hreflang`
//! cluster, Open Graph and the Twitter card. Pinned, with the TypeScript port,
//! against aquafix's goldens in `tests/fixtures/kitstart/metadata.json`, which
//! hold the Next `Metadata` object — [`PageMeta::to_next_metadata`] writes that
//! shape, and a Rust server renders the same facts as tags.
//!
//! Each locale version is its own indexable URL, self-canonical, naming the
//! whole cluster in `hreflang` with `x-default` on the default locale. The
//! canonical host is always the place's own, so the apex fallback path never
//! competes. An unpublished place answers `noindex`.

use super::{
	json::{Json, Object},
	query::Query,
	site::{Page, PlaceView, Site},
};

/// What `<head>` reads for one page: the title as the copy writes it, and the
/// description every reader of the page (head, OG card, sitemap) shares.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct PageMetaCopy {
	pub title: String,
	pub description: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Robots {
	pub index: bool,
	pub follow: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Alternates {
	pub canonical: String,
	/// `(hreflang, url)`, `x-default` last.
	pub languages: Vec<(String, String)>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OpenGraph {
	pub site_name: String,
	pub title: String,
	pub description: String,
	pub url: String,
	pub locale: String,
	pub alternate_locales: Vec<String>,
	/// The card, rendered at `/og` on the apex.
	pub image: String,
}

/// The OG card's size — the one Open Graph and Twitter both crop well.
pub const OG_IMAGE_SIZE: (u32, u32) = (1200, 630);

/// One page's `<head>`. A field left `None` is not emitted.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PageMeta {
	pub title: String,
	pub description: Option<String>,
	pub robots: Option<Robots>,
	pub alternates: Option<Alternates>,
	pub open_graph: Option<OpenGraph>,
	/// `summary_large_image` when the page has an OG card.
	pub twitter_card: bool,
}

impl PageMeta {
	/// The Next `Metadata` object, key for key.
	pub fn to_next_metadata(&self) -> Json {
		let (width, height) = OG_IMAGE_SIZE;
		let mut out = Object::new().with("title", &self.title);
		if let Some(description) = &self.description {
			out.set("description", description);
		}
		if let Some(robots) = self.robots {
			out.set("robots", Object::new().with("index", robots.index).with("follow", robots.follow));
		}
		if let Some(alternates) = &self.alternates {
			let languages: Object = alternates.languages.iter().map(|(tag, url)| (tag.clone(), Json::from(url))).collect();
			out.set("alternates", Object::new().with("canonical", &alternates.canonical).with("languages", languages));
		}
		if let Some(og) = &self.open_graph {
			out.set(
				"openGraph",
				Object::new()
					.with("type", "website")
					.with("siteName", &og.site_name)
					.with("title", &og.title)
					.with("description", &og.description)
					.with("url", &og.url)
					.with("locale", &og.locale)
					.with("alternateLocale", og.alternate_locales.clone())
					.with("images", vec![Object::new().with("url", &og.image).with("width", width).with("height", height)]),
			);
		}
		if self.twitter_card {
			out.set("twitter", Object::new().with("card", "summary_large_image"));
		}
		out.into()
	}
}

/// The OG card URL: on the apex, so it never needs a rewrite.
pub fn og_image_url(site: &Site, slug: Option<&str>, locale: &str, page: Option<&str>) -> String {
	let mut query = Query::new();
	query.append("lang", locale);
	if let Some(slug) = slug {
		query.append("l", slug);
	}
	if let Some(page) = page {
		query.append("p", page);
	}
	format!("{}/og?{query}", site.origin().unwrap_or_default())
}

fn other_og_locales(site: &Site, locale: &str) -> Vec<String> {
	site.i18n().locales().filter(|l| *l != locale).map(|l| site.og_locale_of(l)).collect()
}

/// The `<head>` of one of a place's pages.
pub fn place_meta(view: &PlaceView<'_>, page: Page<'_>, copy: &PageMetaCopy) -> PageMeta {
	let site = view.site;
	let brand = &site.brand().name;
	let title = if page.is_home() {
		format!("{brand} — {}", copy.title)
	} else {
		format!("{} · {brand}", copy.title)
	};
	let canonical = view.url(page.suffix);
	let path = if page.suffix.is_empty() { "/" } else { page.suffix };
	let published = site.publication().is_published(view.place, site.brand().domain.as_deref());
	PageMeta {
		description: Some(copy.description.clone()),
		robots: Some(Robots { index: published, follow: true }),
		alternates: Some(Alternates {
			canonical: canonical.clone(),
			languages: site.i18n().language_alternates(path, &site.place_origin(&view.place.slug).unwrap_or_default()),
		}),
		open_graph: Some(OpenGraph {
			site_name: brand.clone(),
			title: title.clone(),
			description: copy.description.clone(),
			url: canonical,
			locale: site.og_locale_of(view.locale),
			alternate_locales: other_og_locales(site, view.locale),
			image: og_image_url(site, Some(&view.place.slug), view.locale, Some(page.key)),
		}),
		twitter_card: true,
		title,
	}
}

/// The `<head>` of the brand's own page on the apex — the directory of places,
/// or a single site's landing before a place is chosen.
pub fn brand_meta(site: &Site, locale: &str, copy: &PageMetaCopy) -> PageMeta {
	let origin = site.origin().unwrap_or_default();
	let canonical = format!("{origin}{}", site.i18n().locale_path(locale, "/"));
	PageMeta {
		title: copy.title.clone(),
		description: Some(copy.description.clone()),
		robots: None,
		alternates: Some(Alternates {
			canonical: canonical.clone(),
			languages: site.i18n().language_alternates("/", &origin),
		}),
		open_graph: Some(OpenGraph {
			site_name: site.brand().name.clone(),
			title: copy.title.clone(),
			description: copy.description.clone(),
			url: canonical,
			locale: site.og_locale_of(locale),
			alternate_locales: other_og_locales(site, locale),
			image: og_image_url(site, None, locale, None),
		}),
		twitter_card: true,
	}
}

/// A status page — 404, 500, the thank-you — is never indexed nor listed.
pub fn status_meta(site: &Site, title: &str) -> PageMeta {
	PageMeta {
		title: format!("{title} · {}", site.brand().name),
		description: None,
		robots: Some(Robots { index: false, follow: false }),
		alternates: None,
		open_graph: None,
		twitter_card: false,
	}
}
