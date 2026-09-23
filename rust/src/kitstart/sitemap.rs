//! One sitemap per host: a sitemap may only list URLs on its own host, and a
//! place's canonical host is its subdomain (the apex on a `Single` site). The
//! apex of a `Subdomains` site lists the brand page.
//!
//! Each locale version is its own entry, annotated with the whole cluster
//! *including itself*. No `lastmod`: a deploy timestamp that moves without the
//! content moving is a lie. An unpublished place is left out entirely, and a
//! site with no domain lists nothing.

use super::{
	json::{Json, Object},
	place::Place,
	routing::host_slug,
	site::Site,
};

#[derive(Clone, Debug, PartialEq)]
pub struct SitemapEntry {
	pub url: String,
	pub priority: f64,
	/// `(hreflang, url)`, `x-default` last.
	pub languages: Vec<(String, String)>,
}

/// Crawlers named explicitly: several treat a bare wildcard as ambiguous.
pub const AI_CRAWLERS: [&str; 4] = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"];

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RobotsFile {
	/// Allow everyone, the named AI crawlers explicitly, and point at `sitemap`.
	Open { sitemap: String },
	/// A site with no domain is not ready to be crawled at all.
	Closed,
}

fn cluster(site: &Site, origin: &str, suffix: &str, priority: f64) -> Vec<SitemapEntry> {
	let path = if suffix.is_empty() { "/" } else { suffix };
	let languages = site.i18n().language_alternates(path, origin);
	site.i18n()
		.locales()
		.map(|locale| SitemapEntry {
			url: format!("{origin}{}", site.i18n().locale_path(locale, path)),
			priority,
			languages: languages.clone(),
		})
		.collect()
}

/// The sitemap for a request's host. `places` is the list as the live source
/// sees it now — fetched strictly by the caller: an unreachable source must
/// fail the sitemap (a 5xx a crawler retries), never shrink it (a list of
/// places a crawler drops).
pub fn sitemap_for(site: &Site, host: &str, places: &[Place]) -> Vec<SitemapEntry> {
	let Some(apex) = site.origin() else {
		return Vec::new();
	};
	let Some(slug) = host_slug(site, host) else {
		return cluster(site, &apex, "", 1.0);
	};
	let Some(place) = places.iter().find(|p| p.slug == slug) else {
		return Vec::new();
	};
	let Some(origin) = site.place_origin(slug) else {
		return Vec::new();
	};
	if !site.publication().is_published(place, site.brand().domain.as_deref()) {
		return Vec::new();
	}
	site.pages()
		.flat_map(|page| cluster(site, &origin, page.suffix, if page.is_home() { 1.0 } else { 0.8 }))
		.collect()
}

/// Allow everything, and point at the host's own sitemap. Unpublished places
/// are held back by `noindex`, not here, so a crawler can still read the
/// `noindex`.
pub fn robots_for(site: &Site, host: &str) -> RobotsFile {
	let Some(apex) = site.origin() else {
		return RobotsFile::Closed;
	};
	let origin = host_slug(site, host).and_then(|slug| site.place_origin(slug)).unwrap_or(apex);
	RobotsFile::Open {
		sitemap: format!("{origin}/sitemap.xml"),
	}
}

/// The Next `MetadataRoute.Sitemap` shape.
pub fn sitemap_json(entries: &[SitemapEntry]) -> Json {
	entries
		.iter()
		.map(|entry| {
			let languages: Object = entry.languages.iter().map(|(tag, url)| (tag.clone(), Json::from(url))).collect();
			Json::from(
				Object::new()
					.with("url", &entry.url)
					.with("priority", entry.priority)
					.with("alternates", Object::new().with("languages", languages)),
			)
		})
		.collect::<Vec<_>>()
		.into()
}

/// `sitemap.xml`, with every entry's cluster as `xhtml:link` alternates.
pub fn sitemap_xml(entries: &[SitemapEntry]) -> String {
	let mut out = String::from("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\" xmlns:xhtml=\"http://www.w3.org/1999/xhtml\">\n");
	for entry in entries {
		out.push_str(&format!("  <url>\n    <loc>{}</loc>\n", xml_escape(&entry.url)));
		for (tag, url) in &entry.languages {
			out.push_str(&format!("    <xhtml:link rel=\"alternate\" hreflang=\"{}\" href=\"{}\"/>\n", xml_escape(tag), xml_escape(url)));
		}
		out.push_str(&format!("    <priority>{:.1}</priority>\n  </url>\n", entry.priority));
	}
	out.push_str("</urlset>\n");
	out
}

fn xml_escape(s: &str) -> String {
	s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;").replace('\'', "&apos;")
}

impl RobotsFile {
	/// The Next `MetadataRoute.Robots` shape.
	pub fn to_json(&self) -> Json {
		match self {
			Self::Open { sitemap } => Object::new()
				.with(
					"rules",
					vec![
						Object::new().with("userAgent", "*").with("allow", "/"),
						Object::new().with("userAgent", AI_CRAWLERS.iter().map(|c| Json::from(*c)).collect::<Vec<_>>()).with("allow", "/"),
					],
				)
				.with("sitemap", sitemap)
				.into(),
			Self::Closed => Object::new().with("rules", vec![Object::new().with("userAgent", "*").with("disallow", "/")]).into(),
		}
	}

	/// `robots.txt`.
	pub fn to_txt(&self) -> String {
		match self {
			Self::Open { sitemap } => {
				let named: String = AI_CRAWLERS.iter().map(|c| format!("User-agent: {c}\n")).collect();
				format!("User-agent: *\nAllow: /\n\n{named}Allow: /\n\nSitemap: {sitemap}\n")
			}
			Self::Closed => "User-agent: *\nDisallow: /\n".to_owned(),
		}
	}
}
