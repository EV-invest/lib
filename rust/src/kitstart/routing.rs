//! Which place and which locale a request gets, decided before any route
//! renders. Pure, so it is tested without a server — and pinned, with the
//! TypeScript port, against `tests/fixtures/kitstart/decide.json`.
//!
//! ```text
//! <slug>.<domain>/fr/prices      → /fr/_<slug>/prices   (host link mode)
//! <domain>/fr/<slug>/prices      → as it is             (path link mode, apex fallback)
//! single site: /fr/prices        → /fr/_<place>/prices  (host link mode)
//! /fr/_<slug>/…                  → as it is             (a re-entry with the rewritten path)
//! ?lang=<l> on a page            → cookie for a year, 303 to the clean URL
//! a legacy redirect's path       → 301 to where it moved
//! unprefixed page                → 302 to /<cookie ?? Accept-Language>/…
//! ```
//!
//! The link mode rides in the path, never in a request header: a page that
//! read a header would render per request, and every page here is cached. In
//! the path, each mode is its own cache entry, and the two modes' different
//! links can never share one.
//!
//! The negotiation is a **302**, never a 301: the choice is per visitor and
//! must not be cached as permanent. Only page paths enter it — `/quote`,
//! `/sitemap.xml`, `/og` and assets pass straight through.

use super::{
	query::Query,
	site::{LinkMode, Site, Topology},
};

/// Not indexable, not in the sitemap, but negotiated like any other page.
pub const THANKS: &str = "/thanks";

pub const LANG_COOKIE: &str = "lang";
/// A year, in seconds.
pub const LANG_COOKIE_MAX_AGE: u32 = 31_536_000;
/// The query parameter a language switcher links with.
pub const LANG_PARAM: &str = "lang";

/// The prefix a place route param carries in host link mode.
pub const HOST_MARK: &str = "_";

/// The route param for a slug in a mode: `_royat` on its host, `royat`
/// through the apex.
pub fn place_param(slug: &str, mode: LinkMode) -> String {
	match mode {
		LinkMode::Host => format!("{HOST_MARK}{slug}"),
		LinkMode::Path => slug.to_owned(),
	}
}

/// Inverse of [`place_param`].
pub fn parse_place_param(param: &str) -> (&str, LinkMode) {
	match param.strip_prefix(HOST_MARK) {
		Some(slug) => (slug, LinkMode::Host),
		None => (param, LinkMode::Path),
	}
}

/// What the router reads off a request.
#[derive(Clone, Copy, Debug)]
pub struct RequestFacts<'a> {
	/// The `Host` header, port included.
	pub host: &'a str,
	pub pathname: &'a str,
	/// The raw query string, with or without its `?`.
	pub query: &'a str,
	pub accept_language: Option<&'a str>,
	pub cookie_lang: Option<&'a str>,
}

/// What to do with a request.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Decision {
	/// Not a page: hand it on untouched.
	Pass,
	/// 302 to the visitor's locale.
	Negotiate { location: String },
	/// Set the `lang` cookie to `locale` and 303 to `location`.
	Choose { location: String, locale: String },
	/// 301: the path moved.
	Moved { location: String },
	/// Render `pathname` (a rewrite when it differs from the request's).
	Serve { pathname: String },
}

/// The place a host names: `royat.<domain>` → `royat`, `royat.localhost:3000`
/// too, for local work. On a `Single` site every host is the one place.
pub fn host_slug<'a>(site: &'a Site, host: &str) -> Option<&'a str> {
	if let Topology::Single { place } = site.topology() {
		return Some(place);
	}
	let name = host.to_lowercase();
	let name = strip_port(&name);
	let bases = site.brand().domain.as_deref().into_iter().chain(["localhost"]);
	for base in bases {
		if let Some(sub) = name.strip_suffix(base).and_then(|rest| rest.strip_suffix('.')) {
			return site.place_slugs().find(|s| *s == sub);
		}
	}
	None
}

fn strip_port(host: &str) -> &str {
	match host.rsplit_once(':') {
		Some((name, port)) if !port.is_empty() && port.bytes().all(|b| b.is_ascii_digit()) => name,
		_ => host,
	}
}

/// Every suffix the router treats as a page of a place.
pub fn place_suffixes(site: &Site) -> Vec<&str> {
	site.pages().map(|p| p.suffix).chain([THANKS]).collect()
}

pub fn decide(site: &Site, req: &RequestFacts<'_>) -> Decision {
	let i18n = site.i18n();
	let query = Query::parse(req.query);
	let suffixes = place_suffixes(site);
	let (locale, rest) = split(site, req.pathname);

	// A cached page renders by running the router again, host-less, on the
	// path it was rewritten to; that path must come out as it went in.
	if locale.is_some() && host_mode_route(site, &rest) {
		return Decision::Serve { pathname: req.pathname.to_owned() };
	}

	let slug = host_slug(site, req.host);
	if slug.is_none() || matches!(site.topology(), Topology::Single { .. }) {
		let moved = site.config().legacy_redirects.iter().filter(|r| r.from == rest).find_map(|r| r.target(locale));
		if let Some(moved) = moved {
			return Decision::Moved {
				location: with_query(moved, &query),
			};
		}
	}

	if is_page(site, &suffixes, &rest, slug) {
		let page = if rest.is_empty() { "/" } else { rest.as_str() };
		if let Some(asked) = query.get(LANG_PARAM).and_then(|l| i18n.locale(l)) {
			// The visitor chose, so record it and take the query back out — a
			// shared or bookmarked link should not keep re-asserting a locale.
			return Decision::Choose {
				location: with_query(&i18n.locale_path(asked, page), &query),
				locale: asked.to_owned(),
			};
		}
		if locale.is_none() {
			let chosen = req.cookie_lang.and_then(|c| i18n.locale(c)).unwrap_or_else(|| i18n.negotiate(req.accept_language));
			return Decision::Negotiate {
				location: with_query(&i18n.locale_path(chosen, page), &query),
			};
		}
	}

	let Some(locale) = locale else {
		return Decision::Pass;
	};
	match slug {
		// Every prefixed path on a place's host belongs to that place, page or
		// not: `/fr/nonsense` is that place's 404, not the brand's.
		Some(slug) => Decision::Serve {
			pathname: format!("/{locale}/{}{rest}", place_param(slug, LinkMode::Host)),
		},
		None => Decision::Serve { pathname: req.pathname.to_owned() },
	}
}

/// `location` with the request's query, minus the `lang` choice.
fn with_query(location: &str, query: &Query) -> String {
	let mut rest = query.clone();
	rest.remove(LANG_PARAM);
	if rest.is_empty() { location.to_owned() } else { format!("{location}?{rest}") }
}

/// The locale prefix, if the first segment is one, and the path beneath it
/// (`""` for the locale's root). Trailing slashes are not a different page.
fn split<'a>(site: &'a Site, pathname: &str) -> (Option<&'a str>, String) {
	let trimmed = if pathname.len() > 1 { pathname.trim_end_matches('/') } else { pathname };
	let mut segments = trimmed.split('/').skip(1);
	let first = segments.next().unwrap_or("");
	if let Some(locale) = site.i18n().locale(first) {
		let more: Vec<&str> = segments.collect();
		let rest = if more.is_empty() { String::new() } else { format!("/{}", more.join("/")) };
		return (Some(locale), rest);
	}
	(None, if trimmed == "/" { String::new() } else { trimmed.to_owned() })
}

/// `/_royat/…` — already rewritten to a host-mode route.
fn host_mode_route(site: &Site, rest: &str) -> bool {
	let first = rest.split('/').nth(1).unwrap_or("");
	first.strip_prefix(HOST_MARK).is_some_and(|slug| site.has_place(slug))
}

/// Is `rest` (locale-free) a page this host serves?
fn is_page(site: &Site, suffixes: &[&str], rest: &str, slug: Option<&str>) -> bool {
	if slug.is_some() {
		return suffixes.contains(&rest);
	}
	// The brand's own pages.
	if rest.is_empty() || rest == THANKS {
		return true;
	}
	let mut segments = rest.split('/').skip(1);
	let first = segments.next().unwrap_or("");
	let more: Vec<&str> = segments.collect();
	let suffix = if more.is_empty() { String::new() } else { format!("/{}", more.join("/")) };
	site.has_place(first) && suffixes.contains(&suffix.as_str())
}
