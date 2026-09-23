//! The place model. Three words, one each:
//!
//! - **Place** — the aggregate: one point of the business, baked config merged
//!   with the live source;
//! - **Presence** — how the place exists for a visitor: a storefront with an
//!   address, or a service area with none;
//! - **ServiceArea** — where the van goes.
//!
//! A service-area business has no address *in the type*, so no builder can
//! render one for it by accident — schema.org, the map and the footer all have
//! to match on [`Presence`] first.

use std::{borrow::Cow, collections::BTreeMap};

use jiff::{Timestamp, civil::Date, tz::TimeZone};

/// Text per locale code — a place name, a landmark.
pub type PerLocale = BTreeMap<String, String>;

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum DayOfWeek {
	Monday,
	Tuesday,
	Wednesday,
	Thursday,
	Friday,
	Saturday,
	Sunday,
}

impl DayOfWeek {
	/// The schema.org `DayOfWeek` name.
	pub fn as_str(self) -> &'static str {
		match self {
			Self::Monday => "Monday",
			Self::Tuesday => "Tuesday",
			Self::Wednesday => "Wednesday",
			Self::Thursday => "Thursday",
			Self::Friday => "Friday",
			Self::Saturday => "Saturday",
			Self::Sunday => "Sunday",
		}
	}

	pub fn parse(value: &str) -> Option<Self> {
		[Self::Monday, Self::Tuesday, Self::Wednesday, Self::Thursday, Self::Friday, Self::Saturday, Self::Sunday]
			.into_iter()
			.find(|d| d.as_str() == value)
	}
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PostalAddress {
	pub street: String,
	pub postal_code: String,
	pub locality: String,
	/// Région administrative, as schema.org `addressRegion`.
	pub region: String,
	/// ISO 3166-1 alpha-2.
	pub country: String,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Geo {
	pub lat: f64,
	pub lng: f64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OpeningHours {
	pub days: Vec<DayOfWeek>,
	/// `HH:MM`, local time.
	pub opens: String,
	pub closes: String,
}

/// Google's rating for the place, mirrored from the Business Profile API.
/// Never baked: it exists only when the live source supplied it, and the API's
/// terms cap how long a copy may be shown, so `fetched_at` travels with it.
#[derive(Clone, Debug, PartialEq)]
pub struct Rating {
	pub value: f64,
	pub count: u32,
	/// ISO 8601, as the live source wrote it.
	pub fetched_at: String,
}

/// Where the van goes: named communes, or a radius around a centre.
#[derive(Clone, Debug, PartialEq)]
pub enum ServiceArea {
	Localities(Vec<String>),
	Radius { center: Geo, km: f64 },
}

#[derive(Clone, Debug, PartialEq)]
pub enum Presence {
	Storefront(Storefront),
	/// No address, by construction.
	ServiceArea,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Storefront {
	pub address: PostalAddress,
	pub geo: Option<Geo>,
	/// Absolute URL of the storefront or van photo taken at the place.
	pub storefront_photo: Option<String>,
	/// How a visitor recognises the place — a local landmark, per locale.
	pub landmark: Option<PerLocale>,
}

/// International numbers as printed; `None` → the brand's own.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct Channels {
	pub phone: Option<String>,
	pub whatsapp: Option<String>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Place {
	/// The subdomain, or the path segment through the apex.
	pub slug: String,
	/// The Google Business Profile's own name — the schema.org `name`.
	pub gbp_name: String,
	/// The short place name the copy uses: "Royat", "Lyon 3e".
	pub name: PerLocale,
	pub presence: Presence,
	pub service_area: Option<Vec<ServiceArea>>,
	pub channels: Channels,
	pub hours: Option<Vec<OpeningHours>>,
	/// Live only.
	pub rating: Option<Rating>,
}

impl Place {
	/// The storefront half of the place, or `None` for a service-area business.
	pub fn storefront(&self) -> Option<&Storefront> {
		match &self.presence {
			Presence::Storefront(front) => Some(front),
			Presence::ServiceArea => None,
		}
	}

	/// The communes the place names. Until its zone is named a storefront
	/// serves its own town; a radius names no commune.
	pub fn served_localities(&self) -> Vec<&str> {
		match &self.service_area {
			None => self.storefront().map(|f| vec![f.address.locality.as_str()]).unwrap_or_default(),
			Some(areas) => areas
				.iter()
				.flat_map(|area| match area {
					ServiceArea::Localities(names) => names.iter().map(String::as_str).collect(),
					ServiceArea::Radius { .. } => Vec::new(),
				})
				.collect(),
		}
	}

	/// The rating, only while it may still be shown. A stale, future-dated or
	/// unreadable copy is treated as absent — the page then says nothing about
	/// a rating rather than something the terms no longer allow.
	pub fn fresh_rating(&self, now: Timestamp) -> Option<&Rating> {
		let rating = self.rating.as_ref()?;
		let fetched = parse_instant(&rating.fetched_at)?;
		let age_ms = now.as_millisecond() - fetched.as_millisecond();
		(0..=RATING_MAX_AGE_DAYS * 86_400_000).contains(&age_ms).then_some(rating)
	}
}

/// Google Business Profile API policy: no cached copy older than this.
pub const RATING_MAX_AGE_DAYS: i64 = 30;

/// An RFC 3339 instant, or a bare date read as UTC midnight — the two shapes
/// `Date.parse` agrees on across engines, so both ports accept the same input.
fn parse_instant(value: &str) -> Option<Timestamp> {
	if let Ok(ts) = value.parse::<Timestamp>() {
		return Some(ts);
	}
	value.parse::<Date>().ok()?.to_zoned(TimeZone::UTC).ok().map(|z| z.timestamp())
}

/// The fields that make a place's page about *that* place. Google's spam
/// policy names "many similar pages that funnel to one business" as doorway
/// pages, and pages that differ only by address are exactly that. So a place
/// is indexable only once it says something its neighbours cannot.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum PublicationField {
	StorefrontPhoto,
	Landmark,
	ServiceArea,
	Hours,
}

/// Which fields a place must fill before it may be indexed.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PublicationPolicy {
	pub required: Cow<'static, [PublicationField]>,
}

/// A storefront network: what the place looks like, how to find it, where its
/// van goes, and when it opens.
pub const STOREFRONT_GATE: PublicationPolicy = PublicationPolicy {
	required: Cow::Borrowed(&[
		PublicationField::StorefrontPhoto,
		PublicationField::Landmark,
		PublicationField::ServiceArea,
		PublicationField::Hours,
	]),
};

/// A service-area business has no front to photograph: its zone and its hours.
pub const SERVICE_AREA_GATE: PublicationPolicy = PublicationPolicy {
	required: Cow::Borrowed(&[PublicationField::ServiceArea, PublicationField::Hours]),
};

impl PublicationPolicy {
	/// What is still missing, in the policy's order; empty means the place may
	/// be indexed.
	pub fn gaps(&self, place: &Place) -> Vec<PublicationField> {
		self.required.iter().copied().filter(|field| !filled(place, *field)).collect()
	}

	/// An unpublished place still answers — its phone is real and someone may
	/// have been given the link — but it carries `noindex` and stays out of the
	/// sitemap. A site with no domain yet publishes nothing.
	pub fn is_published(&self, place: &Place, domain: Option<&str>) -> bool {
		domain.is_some() && self.gaps(place).is_empty()
	}
}

fn filled(place: &Place, field: PublicationField) -> bool {
	let front = place.storefront();
	match field {
		PublicationField::StorefrontPhoto => front.and_then(|f| f.storefront_photo.as_deref()).is_some_and(|p| !p.is_empty()),
		PublicationField::Landmark => front.and_then(|f| f.landmark.as_ref()).is_some_and(|l| l.values().all(|v| !v.trim().is_empty())),
		PublicationField::ServiceArea => place.service_area.as_ref().is_some_and(|a| !a.is_empty()),
		PublicationField::Hours => place.hours.as_ref().is_some_and(|h| !h.is_empty()),
	}
}
