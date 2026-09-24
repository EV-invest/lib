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
//! any other path                 → gone: the 404 in the path's (or the
//!                                  negotiated) locale, for its place
//! /_next/…, a NON_PAGE_ROUTES path, a site's public file → pass
//! ```
//!
//! A path with an extension is no exception: `/wp-login.php` or `/fr/x.php`
//! let past would reach the locale route, whose not-found a framework may
//! cache as a page — a bare 404 without the phone, one cache entry per
//! scanner's guess. Only the files the site declares pass.
//!
//! ```text
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

/// How a dead path reaches a 404 a visitor without JavaScript can read: the
/// router rewrites it to [`gone_path`], which no route matches, so the
/// framework's server-rendered not-found page answers, told the locale and
/// place through [`GONE_HEADER`]. Reserved: no place may take it as a slug.
pub const GONE: &str = "404";

/// Set only by the router on a `Gone` rewrite, and stripped from every other
/// request, so a client cannot choose which 404 it is shown.
pub const GONE_HEADER: &str = "x-landing-not-found";

/// Routes that are not pages and pass untouched, besides `/_next/…` and the
/// site's own [`SiteConfig::public_files`](super::SiteConfig::public_files):
/// the form target, the OG card, the probe, the sitemap and robots.
pub const NON_PAGE_ROUTES: [&str; 5] = ["/quote", "/og", "/health", "/sitemap.xml", "/robots.txt"];

/// The same list as [`NON_PAGE_ROUTES`], under its old name.
#[deprecated(note = "renamed to NON_PAGE_ROUTES")]
pub const PASS_PATHS: [&str; 5] = NON_PAGE_ROUTES;

/// The path no route matches, in a locale.
pub fn gone_path(locale: &str) -> String {
	format!("/{locale}/{GONE}/{GONE}")
}

/// `fr` or `fr/_royat`: the 404's locale and, if it has one, its place param.
pub fn gone_header(locale: &str, location: Option<&str>) -> String {
	match location {
		Some(location) if !location.is_empty() => format!("{locale}/{location}"),
		_ => locale.to_owned(),
	}
}

/// Inverse of [`gone_header`]; anything absent or malformed reads as nothing.
pub fn parse_gone_header(value: Option<&str>) -> (Option<&str>, Option<&str>) {
	let mut parts = value.unwrap_or("").split('/');
	let locale = parts.next().filter(|l| !l.is_empty());
	let location = parts.next().filter(|l| !l.is_empty());
	if parts.next().is_some() {
		return (None, None);
	}
	(locale, location)
}

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
	/// A dead path: rewrite to [`gone_path`]`(locale)` with [`GONE_HEADER`]
	/// set to [`gone_header`]`(locale, location)`. `location` is a place's
	/// route param (`_royat` in host mode) or `None` for the brand's 404.
	Gone { locale: String, location: Option<String> },
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
/// Every suffix the router treats as a page of a place.
pub fn place_suffixes(site: &Site) -> Vec<&str> {
	site.pages().map(|p| p.suffix).chain([THANKS]).collect()
}
pub fn decide(site: &Site, req: &RequestFacts<'_>) -> Decision {
	let i18n = site.i18n();
	let query = Query::parse(req.query);
	let suffixes = place_suffixes(site);
	let (locale, rest) = split(site, req.pathname);
	if locale.is_none() && is_infrastructure(site, req.pathname) {
		return Decision::Pass;
	}
	let gone = |locale: &str, location: Option<&str>| Decision::Gone {
		locale: locale.to_owned(),
		location: location.map(str::to_owned),
	};

	if let Some(locale) = locale {
		// The 404's own target passes, keeping the header it was sent with.
		if rest == format!("/{GONE}/{GONE}") {
			return Decision::Serve { pathname: req.pathname.to_owned() };
		}
		// A cached page renders by running the router again, host-less, on the
		// path it was rewritten to; that path must come out as it went in.
		let (first, suffix) = head_and_tail(&rest);
		if first.starts_with(HOST_MARK) {
			let (slug, _) = parse_place_param(first);
			if !site.has_place(slug) {
				return gone(locale, None);
			}
			return if suffixes.contains(&suffix.as_str()) {
				Decision::Serve { pathname: req.pathname.to_owned() }
			} else {
				gone(locale, Some(first))
			};
		}
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

	let page = is_page(site, &suffixes, &rest, slug);
	let page_path = if rest.is_empty() { "/" } else { rest.as_str() };
	if page && let Some(asked) = query.get(LANG_PARAM).and_then(|l| i18n.locale(l)) {
		// The visitor chose, so record it and take the query back out — a
		// shared or bookmarked link should not keep re-asserting a locale.
		return Decision::Choose {
			location: with_query(&i18n.locale_path(asked, page_path), &query),
			locale: asked.to_owned(),
		};
	}

	let host_param = slug.map(|s| place_param(s, LinkMode::Host));
	let Some(locale) = locale else {
		let chosen = req.cookie_lang.and_then(|c| i18n.locale(c)).unwrap_or_else(|| i18n.negotiate(req.accept_language));
		if page {
			return Decision::Negotiate {
				location: with_query(&i18n.locale_path(chosen, page_path), &query),
			};
		}
		// Junk without a locale still gets a readable 404, in the locale the
		// visitor would have been sent to.
		return gone(chosen, host_param.as_deref());
	};

	// Every prefixed path on a place's host belongs to that place: `/fr/nope`
	// is that place's 404, not the brand's.
	if let Some(param) = host_param {
		return if page {
			Decision::Serve {
				pathname: format!("/{locale}/{param}{rest}"),
			}
		} else {
			gone(locale, Some(&param))
		};
	}
	if page {
		return Decision::Serve { pathname: req.pathname.to_owned() };
	}
	let (first, _) = head_and_tail(&rest);
	gone(locale, site.has_place(first).then_some(first))
}
fn is_infrastructure(site: &Site, pathname: &str) -> bool {
	NON_PAGE_ROUTES.contains(&pathname) || site.config().public_files.iter().any(|f| f == pathname) || pathname.starts_with("/_next/")
}

fn strip_port(host: &str) -> &str {
	match host.rsplit_once(':') {
		Some((name, port)) if !port.is_empty() && port.bytes().all(|b| b.is_ascii_digit()) => name,
		_ => host,
	}
}

/// `"/royat/prices"` → `("royat", "/prices")`; `"/royat"` → `("royat", "")`.
fn head_and_tail(rest: &str) -> (&str, String) {
	let mut segments = rest.split('/').skip(1);
	let first = segments.next().unwrap_or("");
	let more: Vec<&str> = segments.collect();
	(first, if more.is_empty() { String::new() } else { format!("/{}", more.join("/")) })
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

/// Is `rest` (locale-free) a page this host serves?
fn is_page(site: &Site, suffixes: &[&str], rest: &str, slug: Option<&str>) -> bool {
	if slug.is_some() {
		return suffixes.contains(&rest);
	}
	// The brand's own pages.
	if rest.is_empty() || rest == THANKS {
		return true;
	}
	let (first, suffix) = head_and_tail(rest);
	site.has_place(first) && suffixes.contains(&suffix.as_str())
}
