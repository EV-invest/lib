use dioxus::prelude::*;

use crate::uikit::{Container, Logo};

const HEADING: &str = "font-mono-tech text-xs text-white uppercase tracking-widest mb-6";

const DEFAULT_DESCRIPTION: &str =
	"EV Investment is a registered real estate advisory and investment management fund specializing in premium coastal developments in Quy Nhon, Binh Dinh province, Vietnam.";
/// A footer sitemap link.
#[derive(Clone, Debug, PartialEq)]
pub struct FooterLink {
	pub label: String,
	pub href: String,
}

/// A footer sitemap column: a heading over its links. Each renders `lg:col-span-2`.
#[derive(Clone, Debug, PartialEq)]
pub struct FooterLinkGroup {
	pub heading: String,
	pub links: Vec<FooterLink>,
}

/// An office entry in the footer's Offices column.
#[derive(Clone, Debug, PartialEq)]
pub struct FooterOffice {
	pub name: String,
	pub address: String,
}

/// The EV brand chrome footer, ported from site_conductor: a 12-col grid —
/// brand 3 | sitemap groups 2 each | Offices 3 | Newsletter 2 — over the dark
/// field, with the legal links and copyright line. On mobile the sitemap columns
/// sit side by side. All copy is parameterized with the EV defaults so a bare
/// `Footer { nav }` matches the site; only the sitemap groups (and the
/// newsletter form, when wanted) come from the app. `children` render right
/// after the `<footer>` tag — the slot for app-side extras like the
/// build-version easter egg.
#[component]
pub fn Footer(
	nav: Vec<FooterLinkGroup>,
	#[props(default = DEFAULT_DESCRIPTION.to_string())] description: String,
	#[props(default = default_offices())] offices: Vec<FooterOffice>,
	#[props(default = default_legal_links())] legal_links: Vec<FooterLink>,
	newsletter: Option<Element>,
	#[props(default = "Subscribe, to receive our macro reports".to_string())] newsletter_blurb: String,
	version: Option<String>,
	commit_href: Option<String>,
	#[props(default = "Quy Nhon Fund".to_string())] tagline: String,
	children: Element,
) -> Element {
	rsx! {
		footer { class: "bg-main-black border-t border-main-mist/10 py-16", "data-slot": "footer",
			{children}
			Container {
				div { class: "grid grid-cols-2 gap-x-8 gap-y-8 lg:grid-cols-12 mb-12",
					div { class: "col-span-2 lg:col-span-3",
						div { class: "flex items-center gap-3 mb-6",
							Logo { class: "w-8 h-8 text-white" }
							div { class: "flex flex-col",
								span { class: "font-serif-display font-bold text-base tracking-wider text-white", "EV INVESTMENT" }
								span { class: "text-[8px] font-mono-tech tracking-[0.3em] text-main-accent-t1 uppercase", {tagline} }
							}
						}
						p { class: "text-main-mist/40 text-xs font-light max-w-sm leading-relaxed mb-6", {description} }
						div { class: "flex gap-4 text-xs font-mono-tech text-main-accent-t1",
							for (i , link) in legal_links.iter().enumerate() {
								if i > 0 {
									span { class: "text-main-mist/20", "|" }
								}
								a { href: link.href.clone(), class: "hover:underline", {link.label.clone()} }
							}
						}
					}

					for group in nav.iter() {
						nav {
							key: "{group.heading}",
							aria_label: "Footer {group.heading} links",
							class: "lg:col-span-2",
							h4 { class: HEADING, {group.heading.clone()} }
							ul { class: "space-y-3",
								for link in group.links.iter() {
									li { key: "{link.href}",
										a {
											href: link.href.clone(),
											class: "text-xs font-light text-main-mist/70 hover:text-main-accent-t1 transition-colors",
											{link.label.clone()}
										}
									}
								}
							}
						}
					}

					div { class: "col-span-2 lg:col-span-3",
						h4 { class: HEADING, "Offices" }
						ul { class: "space-y-4 text-xs text-main-mist/70 font-light leading-relaxed",
							for office in offices.iter() {
								li { key: "{office.name}",
									strong { class: "text-white block font-mono-tech text-[10px] uppercase tracking-wider mb-1", {office.name.clone()} }
									{office.address.clone()}
								}
							}
						}
					}

					if newsletter.is_some() {
						div { class: "col-span-2 lg:col-span-2",
							h4 { class: HEADING, "Newsletter" }
							// What the source's `<Tier tier="alt"><Text>` emits: the alt body
							// size + the info variant, then the mb-4 the caller adds.
							p { class: "text-sm sm:text-xs font-light leading-relaxed text-main-mist/70 mb-4", {newsletter_blurb} }
							{newsletter}
						}
					}
				}

				div { class: "border-t border-main-mist/10 pt-8 text-[10px] font-mono-tech text-main-mist/40",
					p {
						"© 2026 EV Investment. All rights reserved."
						if let Some(v) = version {
							" "
							a { href: commit_href, class: "text-main-mist/30", {v} }
						}
					}
				}
			}
		}
	}
}
fn default_offices() -> Vec<FooterOffice> {
	vec![
		FooterOffice {
			name: "Quy Nhon Head Office".to_string(),
			address: "102 An Duong Vuong St, Nguyen Van Cu Ward, Quy Nhon City, Vietnam".to_string(),
		},
		FooterOffice {
			name: "Ho Chi Minh Representative".to_string(),
			address: "Deutsches Haus, 33 Le Duan Blvd, District 1, Ho Chi Minh City, Vietnam".to_string(),
		},
	]
}

fn default_legal_links() -> Vec<FooterLink> {
	vec![
		FooterLink {
			label: "Privacy Policy".to_string(),
			href: "#hero".to_string(),
		},
		FooterLink {
			label: "Terms of Service".to_string(),
			href: "#hero".to_string(),
		},
	]
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	fn nav() -> Vec<FooterLinkGroup> {
		vec![FooterLinkGroup {
			heading: "Company".to_string(),
			links: vec![FooterLink {
				label: "Team".to_string(),
				href: "/team".to_string(),
			}],
		}]
	}

	#[test]
	fn renders_brand_groups_offices_and_legal_defaults() {
		fn app() -> Element {
			rsx! {
				Footer { nav: nav() }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"footer\""), "{html}");
		assert!(html.contains("EV INVESTMENT"), "{html}");
		assert!(html.contains("Quy Nhon Fund"), "default tagline: {html}");
		assert!(html.contains("aria-label=\"Footer Company links\""), "{html}");
		assert!(html.contains("href=\"/team\""), "{html}");
		assert!(html.contains("Quy Nhon Head Office"), "{html}");
		assert!(html.contains("Deutsches Haus, 33 Le Duan Blvd, District 1, Ho Chi Minh City, Vietnam"), "{html}");
		assert!(html.contains("Privacy Policy"), "{html}");
		assert!(html.contains("Terms of Service"), "{html}");
		assert!(html.contains("premium coastal developments"), "default description: {html}");
		assert!(html.contains("© 2026 EV Investment. All rights reserved."), "{html}");
		assert!(!html.contains("Newsletter"), "no newsletter column without the slot: {html}");
		assert!(!html.contains("text-main-mist/30"), "no version link without version: {html}");
	}

	#[test]
	fn newsletter_column_renders_with_slot() {
		fn app() -> Element {
			rsx! {
				Footer {
					nav: nav(),
					newsletter: rsx! {
						form { input {} }
					},
				}
			}
		}
		let html = render(app);
		assert!(html.contains("Newsletter"), "{html}");
		assert!(html.contains("Subscribe, to receive our macro reports"), "{html}");
		assert!(html.contains("<form"), "{html}");
	}

	#[test]
	fn version_link_renders_when_given() {
		fn app() -> Element {
			rsx! {
				Footer {
					nav: nav(),
					version: "v1.2.3",
					commit_href: "https://github.com/EV-invest/site_conductor/commit/abc",
				}
			}
		}
		let html = render(app);
		assert!(html.contains("v1.2.3"), "{html}");
		assert!(html.contains("https://github.com/EV-invest/site_conductor/commit/abc"), "{html}");
		assert!(html.contains("text-main-mist/30"), "{html}");
	}
}
