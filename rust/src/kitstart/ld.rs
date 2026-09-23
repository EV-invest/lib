//! schema.org, derived from the site, the place and the page's copy — never
//! authored. One `@graph` per page with shared `@id`s, so Google collapses the
//! entities instead of reading each as separate. Pinned, with the TypeScript
//! port, against aquafix's goldens in `tests/fixtures/kitstart/json-ld.json`.
//!
//! A storefront carries its address, pin and photo; a service-area business
//! has none of the three in its type, so its node says where it goes
//! (`areaServed`) and nothing about where it is. No `aggregateRating` from
//! anything baked: only a live rating inside the API's 30-day window.

use jiff::Timestamp;

use super::{
	json::{Json, Object},
	place::{Place, ServiceArea},
	site::{Page, PlaceView, Site},
};

/// One row of a price list, as the page's table prints it.
#[derive(Clone, Debug, PartialEq)]
pub struct OfferInput {
	pub name: String,
	/// Whole currency units, the same number the table cell renders.
	pub price: f64,
	/// ISO 4217; `EUR` when `None`.
	pub currency: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QuestionAnswer {
	pub q: String,
	pub a: String,
}

/// The words one page's graph quotes.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct PageGraphCopy {
	/// The short place name the copy uses: "Royat".
	pub place_name: String,
	pub title: String,
	pub description: String,
	/// Emitted only where the page renders the price list.
	pub offers: Vec<OfferInput>,
	/// Emitted only where the page renders the FAQ.
	pub faq: Vec<QuestionAnswer>,
}

pub fn organization_id(site: &Site) -> String {
	format!("{}/#organization", site.origin().unwrap_or_default())
}

// Locale-free: the French and the English page describe one business.
pub fn business_id(site: &Site, slug: &str) -> String {
	format!("{}/#business", site.place_origin(slug).unwrap_or_default())
}

pub fn website_id(site: &Site, slug: &str) -> String {
	format!("{}/#website", site.place_origin(slug).unwrap_or_default())
}

pub fn organization_node(site: &Site) -> Object {
	let brand = site.brand();
	Object::typed("Organization")
		.with("@id", organization_id(site))
		.with("name", &brand.name)
		.with("legalName", &brand.legal_name)
		.with("url", site.origin())
		.with("email", brand.email.as_deref())
		.compact()
}

/// Named communes as `Place`s, a radius as a `GeoCircle`.
pub fn area_served_nodes(place: &Place) -> Vec<Object> {
	let named = place.served_localities().into_iter().map(|name| Object::typed("Place").with("name", name));
	let circles = place.service_area.iter().flatten().filter_map(|area| match area {
		ServiceArea::Radius { center, km } => Some(
			Object::typed("GeoCircle")
				.with("geoMidpoint", Object::typed("GeoCoordinates").with("latitude", center.lat).with("longitude", center.lng))
				.with("geoRadius", km * 1000.0),
		),
		ServiceArea::Localities(_) => None,
	});
	named.chain(circles).collect()
}

fn opening_hours(place: &Place) -> Option<Vec<Object>> {
	place.hours.as_ref().map(|hours| {
		hours
			.iter()
			.map(|h| {
				Object::typed("OpeningHoursSpecification")
					.with("dayOfWeek", h.days.iter().map(|d| Json::from(d.as_str())).collect::<Vec<_>>())
					.with("opens", &h.opens)
					.with("closes", &h.closes)
			})
			.collect()
	})
}

/// The business behind one place.
pub fn business_node(view: &PlaceView<'_>, now: Timestamp) -> Object {
	let site = view.site;
	let place = view.place;
	let front = place.storefront();
	let address = front.map(|f| {
		Object::typed("PostalAddress")
			.with("streetAddress", &f.address.street)
			.with("postalCode", &f.address.postal_code)
			.with("addressLocality", &f.address.locality)
			.with("addressRegion", &f.address.region)
			.with("addressCountry", &f.address.country)
			.compact()
	});
	let geo = front
		.and_then(|f| f.geo)
		.map(|g| Object::typed("GeoCoordinates").with("latitude", g.lat).with("longitude", g.lng));
	let rating = place.fresh_rating(now).map(|r| {
		Object::typed("AggregateRating")
			.with("ratingValue", r.value)
			.with("reviewCount", r.count)
			.with("bestRating", 5u32)
	});
	// Key order is `@evinvest/marketing`'s `localBusiness`: its own fields,
	// then address and geo, then the caller's extras.
	let extra = Object::new()
		.with("priceRange", site.brand().price_range.as_deref())
		.with("areaServed", area_served_nodes(place))
		.with("openingHoursSpecification", opening_hours(place))
		.with("aggregateRating", rating)
		.compact();
	Object::typed(&site.brand().business_type)
		.with("@id", business_id(site, &place.slug))
		.with("name", &place.gbp_name)
		.with("url", view.url(site.home().suffix))
		.with("telephone", site.contact_of(place).phone)
		.with("email", site.brand().email.as_deref())
		.with("image", front.and_then(|f| f.storefront_photo.as_deref()))
		.with("parentOrganization", Object::reference(organization_id(site)))
		.with("address", address)
		.with("geo", geo)
		.extend(extra)
		.compact()
}

/// The town an offer is priced for: a storefront's own, or the first commune
/// served.
fn city_of(place: &Place) -> Option<Object> {
	let name = place.storefront().map(|f| f.address.locality.as_str()).or_else(|| place.served_localities().first().copied())?;
	Some(Object::typed("City").with("name", name))
}

/// One `Service` + `Offer` per price row: the same number as the table cell,
/// tax included.
pub fn offer_nodes(site: &Site, place: &Place, offers: &[OfferInput]) -> Vec<Object> {
	offers
		.iter()
		.map(|row| {
			let currency = row.currency.as_deref().unwrap_or("EUR");
			Object::typed("Service")
				.with("name", &row.name)
				.with("serviceType", &row.name)
				.with("provider", Object::reference(business_id(site, &place.slug)))
				.with("areaServed", city_of(place))
				.with(
					"offers",
					Object::typed("Offer")
						.with("price", row.price)
						.with("priceCurrency", currency)
						.with("availability", "https://schema.org/InStock")
						.with(
							"priceSpecification",
							Object::typed("PriceSpecification")
								.with("minPrice", row.price)
								.with("priceCurrency", currency)
								.with("valueAddedTaxIncluded", true),
						),
				)
				.compact()
		})
		.collect()
}

pub fn faq_page_node(items: &[QuestionAnswer]) -> Object {
	let questions: Vec<Object> = items
		.iter()
		.map(|item| {
			Object::typed("Question")
				.with("name", &item.q)
				.with("acceptedAnswer", Object::typed("Answer").with("text", &item.a))
		})
		.collect();
	Object::typed("FAQPage").with("mainEntity", questions)
}

/// Home → page. The chain is the route, so a new page cannot forget it.
pub fn breadcrumb_node(view: &PlaceView<'_>, page: Page<'_>, copy: &PageGraphCopy) -> Object {
	let site = view.site;
	let mut items = vec![
		Object::typed("ListItem")
			.with("position", 1u32)
			.with("name", format!("{} {}", site.brand().name, copy.place_name))
			.with("item", view.url(site.home().suffix)),
	];
	if !page.is_home() {
		items.push(Object::typed("ListItem").with("position", 2u32).with("name", &copy.title).with("item", view.url(page.suffix)));
	}
	Object::typed("BreadcrumbList").with("itemListElement", items)
}

/// The `@graph` for one of a place's pages in one locale.
///
/// Render it with [`Json::to_script`] inside `<script type="application/ld+json">`.
pub fn place_graph(view: &PlaceView<'_>, page: Page<'_>, copy: &PageGraphCopy, now: Timestamp) -> Json {
	let site = view.site;
	let slug = view.place.slug.as_str();
	let url = view.url(page.suffix);
	let mut nodes = vec![
		organization_node(site),
		business_node(view, now),
		Object::typed("WebSite")
			.with("@id", website_id(site, slug))
			.with("url", site.place_origin(slug).unwrap_or_default())
			.with("name", format!("{} {}", site.brand().name, copy.place_name)),
		Object::typed("WebPage")
			.with("@id", format!("{url}#page"))
			.with("url", url)
			.with("name", &copy.title)
			.with("description", &copy.description)
			.with("inLanguage", site.i18n().hreflang_of(view.locale))
			.with("isPartOf", Object::reference(website_id(site, slug)))
			.with("about", Object::reference(business_id(site, slug))),
		breadcrumb_node(view, page, copy),
	];
	if !copy.offers.is_empty() {
		nodes.extend(offer_nodes(site, view.place, &copy.offers));
	}
	if !copy.faq.is_empty() {
		nodes.push(faq_page_node(&copy.faq));
	}
	Object::new().with("@context", "https://schema.org").with("@graph", nodes).into()
}
