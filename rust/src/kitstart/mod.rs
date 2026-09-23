//! `kitstart` — the pure core of a small-business landing (mirrors the core of
//! `@evinvest/kitstart`).
//!
//! What a crawler and a router read, and nothing that renders: the place model
//! (a storefront with an address, or a service area with none), the
//! publication gate, request routing and locale negotiation, schema.org
//! JSON-LD, the `<head>` metadata, the sitemap and `robots.txt`, the quote
//! form's spam barriers, and `tel:` / `wa.me` links. No I/O, no clock — the
//! caller passes `now` — and `wasm32`-safe, so an edge router, a server and a
//! Dioxus page share one implementation.
//!
//! Both ports are pinned to the same vectors in `tests/fixtures/kitstart/`,
//! compared as serialised text: key order is part of the contract, which is
//! why the builders emit this module's ordered [`Json`] rather than a map.
//!
//! ```
//! use ev_lib::{
//!     i18n::{LocaleRegistry, LocaleRegistryConfig},
//!     kitstart::{BrandFacts, Channels, Decision, Place, Presence, RequestFacts, SERVICE_AREA_GATE, Site, SiteConfig, Topology, decide},
//! };
//!
//! let site = Site::new(SiteConfig {
//!     brand: BrandFacts {
//!         id: "cleaning".into(),
//!         name: "Clean Co".into(),
//!         legal_name: "Clean Co SAS".into(),
//!         email: None,
//!         phone: None,
//!         domain: Some("clean.example".into()),
//!         business_type: "LocalBusiness".into(),
//!         price_range: None,
//!     },
//!     i18n: LocaleRegistry::new(LocaleRegistryConfig {
//!         locales: vec![("fr".into(), "Français".into()), ("en".into(), "English".into())],
//!         default: "fr".into(),
//!         prefix_default_locale: true,
//!         hreflang: vec![],
//!     })
//!     .unwrap(),
//!     og_locale: Default::default(),
//!     topology: Topology::Single { place: "paris".into() },
//!     pages: vec![("home".into(), "".into()), ("prices".into(), "/prices".into())],
//!     places: vec![Place {
//!         slug: "paris".into(),
//!         gbp_name: "Clean Co Paris".into(),
//!         name: Default::default(),
//!         presence: Presence::ServiceArea,
//!         service_area: None,
//!         channels: Channels::default(),
//!         hours: None,
//!         rating: None,
//!     }],
//!     publication: SERVICE_AREA_GATE,
//!     legacy_redirects: vec![],
//! })
//! .unwrap();
//!
//! let request = RequestFacts { host: "clean.example", pathname: "/en/prices", query: "", accept_language: None, cookie_lang: None };
//! assert_eq!(decide(&site, &request), Decision::Serve { pathname: "/en/_paris/prices".into() });
//! ```

mod antispam;
mod contact;
mod json;
mod ld;
mod meta;
mod place;
mod query;
mod routing;
mod site;
mod sitemap;
#[cfg(test)]
mod tests;

pub use antispam::{HONEYPOT_FIELD, MIN_FILL_MS, RENDERED_AT_FIELD, RateLimiter, SpamVerdict, Submission, check_timing, screen};
pub use contact::{ContactChannel, contact_channel, tel_href, whatsapp_href};
pub use json::{Json, Object};
pub use ld::{
	OfferInput, PageGraphCopy, QuestionAnswer, area_served_nodes, breadcrumb_node, business_id, business_node, faq_page_node, offer_nodes, organization_id, organization_node, place_graph,
	website_id,
};
pub use meta::{Alternates, OG_IMAGE_SIZE, OpenGraph, PageMeta, PageMetaCopy, Robots, brand_meta, og_image_url, place_meta, status_meta};
pub use place::{
	Channels, DayOfWeek, Geo, OpeningHours, PerLocale, Place, PostalAddress, Presence, PublicationField, PublicationPolicy, RATING_MAX_AGE_DAYS, Rating, SERVICE_AREA_GATE, STOREFRONT_GATE,
	ServiceArea, Storefront,
};
pub use routing::{Decision, HOST_MARK, LANG_COOKIE, LANG_COOKIE_MAX_AGE, LANG_PARAM, RequestFacts, THANKS, decide, host_slug, parse_place_param, place_param, place_suffixes};
pub use site::{BrandFacts, Contact, HOME, LegacyRedirect, LinkMode, Page, PlaceView, Site, SiteConfig, SiteError, Topology, place_href};
pub use sitemap::{AI_CRAWLERS, RobotsFile, SitemapEntry, robots_for, sitemap_for, sitemap_json, sitemap_xml};
