//! The shared fixtures in `tests/fixtures/kitstart/`, run against this port.
//! The TypeScript port runs the same files; expected values are aquafix's
//! goldens verbatim, compared as serialised text so key order is pinned too.
//!
//! The fixtures are read with a small order-preserving JSON reader rather than
//! `serde_json`, whose maps sort their keys and would make the comparison blind
//! to exactly the drift it exists to catch.

use std::{collections::BTreeMap, path::PathBuf};

use jiff::Timestamp;

use super::{
	BrandFacts, Channels, DayOfWeek, Decision, Geo, Json, LegacyRedirect, LinkMode, MIN_FILL_MS, Object, OfferInput, OpeningHours, PageGraphCopy, PageMetaCopy, Place, PlaceView,
	PostalAddress, Presence, PublicationField, QuestionAnswer, RateLimiter, Rating, RequestFacts, SERVICE_AREA_GATE, STOREFRONT_GATE, ServiceArea, Site, SiteConfig, SpamVerdict, Storefront,
	Submission, Topology, brand_meta, decide, place_graph, place_meta, robots_for, screen, sitemap_for, sitemap_json, status_meta,
};
use crate::i18n::{LocaleRegistry, LocaleRegistryConfig};

// ── reading the fixtures ─────────────────────────────────────────────────────

fn fixture(name: &str) -> Json {
	let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../tests/fixtures/kitstart").join(name);
	let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("reading {}: {e}", path.display()));
	let mut reader = Reader { bytes: text.as_bytes(), at: 0 };
	let value = reader.value();
	reader.skip_ws();
	assert_eq!(reader.at, reader.bytes.len(), "trailing bytes in {name}");
	value
}

struct Reader<'a> {
	bytes: &'a [u8],
	at: usize,
}

impl Reader<'_> {
	fn skip_ws(&mut self) {
		while self.bytes.get(self.at).is_some_and(u8::is_ascii_whitespace) {
			self.at += 1;
		}
	}

	fn eat(&mut self, byte: u8) {
		self.skip_ws();
		assert_eq!(self.bytes.get(self.at), Some(&byte), "expected {:?} at byte {}", char::from(byte), self.at);
		self.at += 1;
	}

	fn peek(&mut self) -> u8 {
		self.skip_ws();
		self.bytes[self.at]
	}

	fn value(&mut self) -> Json {
		match self.peek() {
			b'{' => {
				self.eat(b'{');
				let mut object = Object::new();
				if self.peek() == b'}' {
					self.eat(b'}');
					return object.into();
				}
				loop {
					let key = self.string();
					self.eat(b':');
					let value = self.value();
					object.set(&key, value);
					if self.peek() == b',' {
						self.eat(b',');
					} else {
						self.eat(b'}');
						return object.into();
					}
				}
			}
			b'[' => {
				self.eat(b'[');
				let mut items = Vec::new();
				if self.peek() == b']' {
					self.eat(b']');
					return Json::List(items);
				}
				loop {
					items.push(self.value());
					if self.peek() == b',' {
						self.eat(b',');
					} else {
						self.eat(b']');
						return Json::List(items);
					}
				}
			}
			b'"' => Json::Str(self.string()),
			b't' => self.word("true", Json::Bool(true)),
			b'f' => self.word("false", Json::Bool(false)),
			b'n' => self.word("null", Json::Null),
			_ => {
				let start = self.at;
				while self.bytes.get(self.at).is_some_and(|b| b.is_ascii_digit() || b"+-.eE".contains(b)) {
					self.at += 1;
				}
				let text = std::str::from_utf8(&self.bytes[start..self.at]).expect("ascii");
				Json::Num(text.parse().unwrap_or_else(|_| panic!("bad number {text:?}")))
			}
		}
	}

	fn word(&mut self, word: &str, value: Json) -> Json {
		assert!(self.bytes[self.at..].starts_with(word.as_bytes()), "expected {word} at byte {}", self.at);
		self.at += word.len();
		value
	}

	fn string(&mut self) -> String {
		self.eat(b'"');
		let mut out = Vec::new();
		loop {
			let byte = self.bytes[self.at];
			self.at += 1;
			match byte {
				b'"' => return String::from_utf8(out).expect("utf-8"),
				b'\\' => {
					let escape = self.bytes[self.at];
					self.at += 1;
					let c = match escape {
						b'n' => '\n',
						b't' => '\t',
						b'r' => '\r',
						b'b' => '\u{08}',
						b'f' => '\u{0c}',
						b'u' => {
							let hex = std::str::from_utf8(&self.bytes[self.at..self.at + 4]).expect("ascii");
							self.at += 4;
							char::from_u32(u32::from_str_radix(hex, 16).expect("hex")).expect("the fixtures hold no surrogate pairs")
						}
						other => char::from(other),
					};
					out.extend_from_slice(c.encode_utf8(&mut [0; 4]).as_bytes());
				}
				other => out.push(other),
			}
		}
	}
}

fn field<'a>(json: &'a Json, key: &str) -> &'a Json {
	json.as_object().and_then(|o| o.get(key)).unwrap_or_else(|| panic!("no {key:?} in {}", json.to_json()))
}

fn opt<'a>(json: &'a Json, key: &str) -> Option<&'a Json> {
	json.as_object().and_then(|o| o.get(key)).filter(|v| !matches!(v, Json::Null))
}

fn text(json: &Json) -> String {
	match json {
		Json::Str(s) => s.clone(),
		other => panic!("not a string: {}", other.to_json()),
	}
}

fn num(json: &Json) -> f64 {
	match json {
		Json::Num(n) => *n,
		other => panic!("not a number: {}", other.to_json()),
	}
}

fn list(json: &Json) -> &[Json] {
	match json {
		Json::List(items) => items,
		other => panic!("not a list: {}", other.to_json()),
	}
}

fn opt_text(json: &Json, key: &str) -> Option<String> {
	opt(json, key).map(text)
}

fn per_locale(json: &Json) -> BTreeMap<String, String> {
	json.as_object().expect("an object").iter().map(|(k, v)| (k.to_owned(), text(v))).collect()
}

fn geo(json: &Json) -> Geo {
	Geo {
		lat: num(field(json, "lat")),
		lng: num(field(json, "lng")),
	}
}

fn place(json: &Json) -> Place {
	let presence = field(json, "presence");
	let presence = match text(field(presence, "kind")).as_str() {
		"storefront" => {
			let address = field(presence, "address");
			Presence::Storefront(Storefront {
				address: PostalAddress {
					street: text(field(address, "street")),
					postal_code: text(field(address, "postalCode")),
					locality: text(field(address, "locality")),
					region: text(field(address, "region")),
					country: text(field(address, "country")),
				},
				geo: opt(presence, "geo").map(geo),
				storefront_photo: opt_text(presence, "storefrontPhoto"),
				landmark: opt(presence, "landmark").map(per_locale),
			})
		}
		"service-area" => Presence::ServiceArea,
		other => panic!("unknown presence {other}"),
	};
	let channels = field(json, "channels");
	Place {
		slug: text(field(json, "slug")),
		gbp_name: text(field(json, "gbpName")),
		name: per_locale(field(json, "name")),
		presence,
		service_area: opt(json, "serviceArea").map(|areas| {
			list(areas)
				.iter()
				.map(|area| match text(field(area, "kind")).as_str() {
					"localities" => ServiceArea::Localities(list(field(area, "names")).iter().map(text).collect()),
					"radius" => ServiceArea::Radius {
						center: geo(field(area, "center")),
						km: num(field(area, "km")),
					},
					other => panic!("unknown service area {other}"),
				})
				.collect()
		}),
		channels: Channels {
			phone: opt_text(channels, "phone"),
			whatsapp: opt_text(channels, "whatsapp"),
		},
		hours: opt(json, "hours").map(|hours| {
			list(hours)
				.iter()
				.map(|h| OpeningHours {
					days: list(field(h, "days")).iter().map(|d| DayOfWeek::parse(&text(d)).expect("a day")).collect(),
					opens: text(field(h, "opens")),
					closes: text(field(h, "closes")),
				})
				.collect()
		}),
		rating: opt(json, "rating").map(|r| Rating {
			value: num(field(r, "value")),
			count: num(field(r, "count")) as u32,
			fetched_at: text(field(r, "fetchedAt")),
		}),
	}
}

fn site(name: &str) -> Site {
	let sites = fixture("sites.json");
	let json = field(&sites, name);
	let brand = field(json, "brand");
	let i18n = field(json, "i18n");
	let labels = field(i18n, "labels");
	let topology = field(json, "topology");
	Site::try_new(SiteConfig {
		brand: BrandFacts {
			id: text(field(brand, "id")),
			name: text(field(brand, "name")),
			legal_name: text(field(brand, "legalName")),
			email: opt_text(brand, "email"),
			phone: opt_text(brand, "phone"),
			domain: opt_text(brand, "domain"),
			business_type: text(field(brand, "businessType")),
			price_range: opt_text(brand, "priceRange"),
		},
		i18n: LocaleRegistry::try_new(LocaleRegistryConfig {
			locales: list(field(i18n, "locales")).iter().map(|l| (text(l), text(field(labels, &text(l))))).collect(),
			default: text(field(i18n, "default")),
			prefix_default_locale: matches!(field(i18n, "prefixDefaultLocale"), Json::Bool(true)),
			hreflang: per_locale(field(i18n, "hreflang")).into_iter().collect(),
		})
		.expect("a valid registry"),
		og_locale: per_locale(field(json, "ogLocale")),
		topology: match text(field(topology, "kind")).as_str() {
			"subdomains" => Topology::Subdomains,
			"single" => Topology::Single {
				place: text(field(topology, "place")),
			},
			other => panic!("unknown topology {other}"),
		},
		pages: list(field(json, "pages")).iter().map(|p| (text(field(p, "key")), text(field(p, "suffix")))).collect(),
		places: list(field(json, "places")).iter().map(place).collect(),
		publication: match text(field(json, "publication")).as_str() {
			"storefront" => STOREFRONT_GATE,
			"service-area" => SERVICE_AREA_GATE,
			other => panic!("unknown publication {other}"),
		},
		legacy_redirects: list(field(json, "legacyRedirects"))
			.iter()
			.map(|r| LegacyRedirect {
				from: text(field(r, "from")),
				to: field(r, "to")
					.as_object()
					.expect("an object")
					.iter()
					.map(|(prefix, target)| ((prefix != "null").then(|| prefix.to_owned()), text(target)))
					.collect(),
			})
			.collect(),
		public_files: opt(json, "publicFiles").map_or_else(Vec::new, |files| list(files).iter().map(text).collect()),
	})
	.expect("a valid site")
}

fn mode(json: &Json) -> LinkMode {
	match text(json).as_str() {
		"host" => LinkMode::Host,
		"path" => LinkMode::Path,
		other => panic!("unknown mode {other}"),
	}
}

fn cases(file: &Json) -> &[Json] {
	let cases = list(field(file, "cases"));
	assert!(!cases.is_empty(), "a fixture with no cases proves nothing");
	cases
}

/// Compare as text, one case at a time, and report every mismatch at once.
fn check(failures: &mut Vec<String>, name: &str, actual: &Json, expected: &Json) {
	let (actual, expected) = (actual.to_json_pretty(), expected.to_json_pretty());
	if actual != expected {
		failures.push(format!("── {name}\n   expected: {expected}\n   actual:   {actual}"));
	}
}

fn assert_clean(failures: &[String]) {
	assert!(failures.is_empty(), "{} case(s) differ:\n{}", failures.len(), failures.join("\n"));
}

// ── the shared vectors ───────────────────────────────────────────────────────

#[test]
fn json_ld_matches_aquafix_goldens() {
	let file = fixture("json-ld.json");
	let now: Timestamp = text(field(&file, "now")).parse().expect("an instant");
	let mut failures = Vec::new();
	for case in cases(&file) {
		let site = site(&text(field(case, "site")));
		let place = place(field(case, "place"));
		let locale = text(field(case, "locale"));
		let page = site.page(&text(field(case, "page"))).expect("a page of the site");
		let copy = field(case, "copy");
		let copy = PageGraphCopy {
			place_name: text(field(copy, "placeName")),
			title: text(field(copy, "title")),
			description: text(field(copy, "description")),
			offers: opt(copy, "offers").map_or_else(Vec::new, |offers| {
				list(offers)
					.iter()
					.map(|o| OfferInput {
						name: text(field(o, "name")),
						price: num(field(o, "price")),
						currency: opt_text(o, "currency"),
					})
					.collect()
			}),
			faq: opt(copy, "faq").map_or_else(Vec::new, |faq| {
				list(faq)
					.iter()
					.map(|qa| QuestionAnswer {
						q: text(field(qa, "q")),
						a: text(field(qa, "a")),
					})
					.collect()
			}),
		};
		let view = PlaceView::new(&site, &place, &locale, mode(field(case, "mode")));
		check(&mut failures, &text(field(case, "name")), &place_graph(&view, page, &copy, now), field(case, "expected"));
	}
	assert_clean(&failures);
}

#[test]
fn metadata_matches_aquafix_goldens() {
	let file = fixture("metadata.json");
	let mut failures = Vec::new();
	for case in cases(&file) {
		let site = site(&text(field(case, "site")));
		let copy = field(case, "copy");
		let meta = match text(field(case, "kind")).as_str() {
			"place" => {
				let place = place(field(case, "place"));
				let locale = text(field(case, "locale"));
				let page = site.page(&text(field(case, "page"))).expect("a page of the site");
				let view = PlaceView::new(&site, &place, &locale, mode(field(case, "mode")));
				place_meta(
					&view,
					page,
					&PageMetaCopy {
						title: text(field(copy, "title")),
						description: text(field(copy, "description")),
					},
				)
			}
			"brand" => brand_meta(
				&site,
				&text(field(case, "locale")),
				&PageMetaCopy {
					title: text(field(copy, "title")),
					description: text(field(copy, "description")),
				},
			),
			"status" => status_meta(&site, &text(field(copy, "title"))),
			other => panic!("unknown metadata kind {other}"),
		};
		check(&mut failures, &text(field(case, "name")), &meta.to_next_metadata(), field(case, "expected"));
	}
	assert_clean(&failures);
}

#[test]
fn sitemap_and_robots_match_aquafix_goldens() {
	let file = fixture("sitemap.json");
	let mut failures = Vec::new();
	for case in cases(&file) {
		let site = site(&text(field(case, "site")));
		let host = text(field(case, "host"));
		let places: Vec<Place> = list(field(case, "places")).iter().map(place).collect();
		let expected = field(case, "expected");
		let name = text(field(case, "name"));
		check(
			&mut failures,
			&format!("{name} (sitemap)"),
			&sitemap_json(&sitemap_for(&site, &host, &places)),
			field(expected, "sitemap"),
		);
		check(&mut failures, &format!("{name} (robots)"), &robots_for(&site, &host).to_json(), field(expected, "robots"));
	}
	assert_clean(&failures);
}

#[test]
fn routing_decisions_match_the_shared_table() {
	let file = fixture("decide.json");
	let mut failures = Vec::new();
	for case in cases(&file) {
		let site = site(&text(field(case, "site")));
		let request = field(case, "request");
		let query = text(field(request, "query"));
		let accept_language = opt_text(request, "acceptLanguage");
		let cookie_lang = opt_text(request, "cookieLang");
		let host = text(field(request, "host"));
		let pathname = text(field(request, "pathname"));
		let facts = RequestFacts {
			host: &host,
			pathname: &pathname,
			query: &query,
			accept_language: accept_language.as_deref(),
			cookie_lang: cookie_lang.as_deref(),
		};
		let decision = field(case, "decision");
		let expected = match text(field(decision, "kind")).as_str() {
			"pass" => Decision::Pass,
			"negotiate" => Decision::Negotiate {
				location: text(field(decision, "location")),
			},
			"choose" => Decision::Choose {
				location: text(field(decision, "location")),
				locale: text(field(decision, "locale")),
			},
			"moved" => Decision::Moved {
				location: text(field(decision, "location")),
			},
			"serve" => Decision::Serve {
				pathname: text(field(decision, "pathname")),
			},
			"gone" => Decision::Gone {
				locale: text(field(decision, "locale")),
				location: opt_text(decision, "location"),
			},
			other => panic!("unknown decision {other}"),
		};
		let actual = decide(&site, &facts);
		if actual != expected {
			failures.push(format!(
				"── {}: {}\n   expected: {expected:?}\n   actual:   {actual:?}",
				text(field(case, "site")),
				text(field(case, "name"))
			));
		}
	}
	assert_clean(&failures);
}

#[test]
fn antispam_matches_the_shared_steps() {
	let file = fixture("antispam.json");
	assert_eq!(num(field(&file, "minFillMs")) as i64, MIN_FILL_MS, "the fixture's fill time is this port's");
	let mut failures = Vec::new();
	for case in cases(&file) {
		let mut limiter = RateLimiter::with_max_keys(num(field(case, "limit")) as u32, num(field(case, "windowMs")) as i64, num(field(case, "maxKeys")) as usize);
		for (i, step) in list(field(case, "steps")).iter().enumerate() {
			let honeypot = opt_text(step, "honeypot");
			let rendered_at = opt_text(step, "renderedAt");
			let client_key = text(field(step, "clientKey"));
			let submission = Submission {
				honeypot: honeypot.as_deref(),
				rendered_at: rendered_at.as_deref(),
				client_key: &client_key,
				now_ms: num(field(step, "now")) as i64,
			};
			let actual = screen(submission, &mut limiter).map_or("ok", SpamVerdict::as_str);
			let expected = text(field(step, "expected"));
			if actual != expected {
				failures.push(format!("── {} step {i}: expected {expected}, got {actual}", text(field(case, "name"))));
			}
		}
	}
	assert_clean(&failures);
}

// ── what the fixtures cannot reach ───────────────────────────────────────────

fn service_area_place() -> Place {
	site("cleaning").baked_place("paris").expect("the one place").clone()
}

#[test]
fn a_service_area_business_says_where_it_goes_and_never_where_it_is() {
	let site = site("cleaning");
	let place = service_area_place();
	let view = PlaceView::new(&site, &place, "fr", LinkMode::Host);
	let copy = PageGraphCopy {
		place_name: "Paris".into(),
		title: "Ménage".into(),
		description: "Ménage à domicile.".into(),
		offers: vec![OfferInput {
			name: "Ménage".into(),
			price: 35.0,
			currency: None,
		}],
		faq: vec![],
	};
	let graph = place_graph(&view, site.home(), &copy, Timestamp::UNIX_EPOCH).to_json();
	for absent in ["\"address\"", "\"geo\"", "\"hasMap\"", "\"image\"", "\"telephone\""] {
		assert!(!graph.contains(absent), "{absent} in {graph}");
	}
	assert!(graph.contains(r#""areaServed":[{"@type":"City","name":"Paris"},{"@type":"City","name":"Boulogne-Billancourt"},{"@type":"GeoCircle","geoMidpoint":{"@type":"GeoCoordinates","latitude":48.8566,"longitude":2.3522},"geoRadius":12000}]"#), "{graph}");
	// The offer is priced for the first commune the zone names.
	assert!(graph.contains(r#""areaServed":{"@type":"City","name":"Paris"}"#), "{graph}");
	assert!(graph.contains(r#""@id":"https://clean.example/#business""#), "{graph}");
	assert!(graph.contains(r#""url":"https://clean.example/fr""#), "{graph}");
}

#[test]
fn a_single_site_lists_its_one_place_on_the_apex_once_published() {
	let site = site("cleaning");
	let place = service_area_place();
	assert!(site.publication_gaps(&place).is_empty());
	let entries = sitemap_for(&site, "clean.example", std::slice::from_ref(&place));
	let urls: Vec<&str> = entries.iter().map(|e| e.url.as_str()).collect();
	assert_eq!(
		urls,
		[
			"https://clean.example/fr",
			"https://clean.example/en",
			"https://clean.example/fr/prices",
			"https://clean.example/en/prices"
		]
	);
	let mut closed = place;
	closed.hours = None;
	assert!(sitemap_for(&site, "clean.example", &[closed]).is_empty());
}

#[test]
fn a_site_without_a_domain_is_closed_to_crawlers() {
	let mut config = site("cleaning").config().clone();
	config.brand.domain = None;
	let site = Site::try_new(config).expect("a valid site");
	let place = service_area_place();
	assert_eq!(robots_for(&site, "anything").to_txt(), "User-agent: *\nDisallow: /\n");
	assert!(sitemap_for(&site, "anything", std::slice::from_ref(&place)).is_empty());
	let view = PlaceView::new(&site, &place, "fr", LinkMode::Host);
	let meta = place_meta(&view, site.home(), &PageMetaCopy::default());
	assert_eq!(meta.robots.map(|r| r.index), Some(false));
	assert_eq!(view.url("/prices"), "/fr/prices");
}

#[test]
fn a_rating_is_shown_only_inside_the_api_window() {
	let mut place = service_area_place();
	let at = |s: &str| -> Timestamp { s.parse().expect("an instant") };
	place.rating = Some(Rating {
		value: 4.8,
		count: 12,
		fetched_at: "2026-09-01".into(),
	});
	assert!(place.fresh_rating(at("2026-09-30T00:00:00Z")).is_some());
	assert!(place.fresh_rating(at("2026-10-01T00:00:01Z")).is_none());
	assert!(place.fresh_rating(at("2026-08-31T23:59:59Z")).is_none(), "a future-dated copy");
	place.rating.as_mut().expect("set above").fetched_at = "last week".into();
	assert!(place.fresh_rating(at("2026-09-02T00:00:00Z")).is_none());
	// No offset: its instant would depend on the server's time zone.
	place.rating.as_mut().expect("set above").fetched_at = "2026-09-01T00:00:00".into();
	assert!(place.fresh_rating(at("2026-09-02T00:00:00Z")).is_none());
	place.rating.as_mut().expect("set above").fetched_at = "2026-09-01T00:00:00+02:00".into();
	assert!(place.fresh_rating(at("2026-09-02T00:00:00Z")).is_some());
}

#[test]
fn a_site_refuses_a_config_the_router_could_not_read() {
	let base = site("cleaning").config().clone();
	let refuse = |edit: &dyn Fn(&mut SiteConfig)| {
		let mut config = base.clone();
		edit(&mut config);
		Site::try_new(config).expect_err("refused").to_string()
	};
	assert!(refuse(&|c| c.pages.retain(|(k, _)| k != "home")).contains("home"));
	assert!(refuse(&|c| c.pages.push(("prices".into(), "/other".into()))).contains("twice"));
	assert!(refuse(&|c| c.pages.push(("faq".into(), "/faq/".into()))).contains("suffix"));
	assert!(refuse(&|c| c.places[0].slug = "_paris".into()).contains("[a-z0-9-]"));
	assert!(
		refuse(&|c| {
			c.places[0].slug = "404".into();
			c.topology = Topology::Single { place: "404".into() };
		})
		.contains("reserved")
	);
	assert!(refuse(&|c| c.pages.push(("faq".into(), "/faq//more".into()))).contains("suffix"));
	assert!(refuse(&|c| c.public_files.push("icon.svg".into())).contains("public file"));
	assert!(refuse(&|c| c.public_files.push("/.well-known/".into())).contains("public file"));
	assert!(refuse(&|c| c.public_files.push("/_next/x.js".into())).contains("public file"));
	assert!(refuse(&|c| c.public_files.push("/fr/menu.pdf".into())).contains("under a locale"));
	assert!(refuse(&|c| c.topology = Topology::Single { place: "lyon".into() }).contains("lyon"));
}

#[test]
fn a_landmark_must_be_written_in_every_locale_the_place_is_named_in() {
	let site = site("aquafix");
	let mut place = site.baked_place("royat").expect("a baked place").clone();
	let landmark = |pairs: &[(&str, &str)]| -> BTreeMap<String, String> { pairs.iter().map(|(l, v)| ((*l).to_owned(), (*v).to_owned())).collect() };
	let cases = [
		(landmark(&[("fr", "En face des thermes"), ("en", "Opposite the spa")]), false),
		(landmark(&[("fr", "En face des thermes")]), true),
		(landmark(&[]), true),
		(landmark(&[("fr", "En face des thermes"), ("en", " ")]), true),
	];
	for (value, missing) in cases {
		let Presence::Storefront(front) = &mut place.presence else {
			panic!("royat is a storefront");
		};
		front.landmark = Some(value.clone());
		assert_eq!(site.publication_gaps(&place).contains(&PublicationField::Landmark), missing, "{value:?}");
	}
}
