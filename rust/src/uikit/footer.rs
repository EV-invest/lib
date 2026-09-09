use dioxus::prelude::*;

use crate::uikit::Container;

const HEADING: &str = "font-mono text-xs text-ink uppercase tracking-widest mb-6";

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

/// An office entry in the footer's offices column.
#[derive(Clone, Debug, PartialEq)]
pub struct FooterOffice {
	pub name: String,
	pub address: String,
}

/// A 12-col footer grid — brand 3 | sitemap groups 2 each | offices 3 |
/// newsletter 2 — with the legal links and copyright line. On mobile the sitemap
/// columns sit side by side. Every string is the caller's; the `offices` and
/// `newsletter` columns are omitted when empty. `children` render right after the
/// `<footer>` tag — the slot for app-side extras like a build-version easter egg.
#[component]
pub fn Footer(
	brand: String,
	description: String,
	copyright: String,
	nav: Vec<FooterLinkGroup>,
	/// The mark beside the brand name. Sized by the caller.
	mark: Option<Element>,
	tagline: Option<String>,
	#[props(default)] offices: Vec<FooterOffice>,
	#[props(default = "Offices".to_string())] offices_heading: String,
	#[props(default)] legal_links: Vec<FooterLink>,
	newsletter: Option<Element>,
	#[props(default = "Newsletter".to_string())] newsletter_heading: String,
	#[props(default)] newsletter_blurb: String,
	version: Option<String>,
	commit_href: Option<String>,
	children: Element,
) -> Element {
	rsx! {
		footer { class: "bg-background border-t border-ink/10 py-16", "data-slot": "footer",
			{children}
			Container {
				div { class: "grid grid-cols-2 gap-x-8 gap-y-8 lg:grid-cols-12 mb-12",
					div { class: "col-span-2 lg:col-span-3",
						div { class: "flex items-center gap-3 mb-6",
							{mark}
							div { class: "flex flex-col",
								span { class: "font-serif font-bold text-base tracking-wider text-ink", {brand} }
								if let Some(tagline) = tagline {
									span { class: "text-[8px] font-mono tracking-[0.3em] text-accent-debug uppercase", {tagline} }
								}
							}
						}
						p { class: "text-ink/40 text-xs font-light max-w-sm leading-relaxed mb-6", {description} }
						div { class: "flex gap-4 text-xs font-mono text-accent-debug",
							for (i , link) in legal_links.iter().enumerate() {
								if i > 0 {
									span { class: "text-ink/20", "|" }
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
											class: "text-xs font-light text-ink/70 hover:text-accent-debug transition-colors",
											{link.label.clone()}
										}
									}
								}
							}
						}
					}

					if !offices.is_empty() {
						div { class: "col-span-2 lg:col-span-3",
							h4 { class: HEADING, {offices_heading} }
							ul { class: "space-y-4 text-xs text-ink/70 font-light leading-relaxed",
								for office in offices.iter() {
									li { key: "{office.name}",
										strong { class: "text-ink block font-mono text-[10px] uppercase tracking-wider mb-1", {office.name.clone()} }
										{office.address.clone()}
									}
								}
							}
						}
					}

					if newsletter.is_some() {
						div { class: "col-span-2 lg:col-span-2",
							h4 { class: HEADING, {newsletter_heading} }
							// What the source's `<Tier tier="alt"><Text>` emits: the alt body
							// size + the info variant, then the mb-4 the caller adds.
							p { class: "text-sm sm:text-xs font-light leading-relaxed text-ink/70 mb-4", {newsletter_blurb} }
							{newsletter}
						}
					}
				}

				div { class: "border-t border-ink/10 pt-8 text-[10px] font-mono text-ink/40",
					p {
						{copyright}
						if let Some(v) = version {
							" "
							a { href: commit_href, class: "text-ink/30", {v} }
						}
					}
				}
			}
		}
	}
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
	fn renders_the_callers_copy_and_omits_the_empty_columns() {
		fn app() -> Element {
			rsx! {
				Footer {
					brand: "ACME",
					description: "We do a thing.",
					copyright: "© 2026 ACME",
					nav: nav(),
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"footer\""), "{html}");
		assert!(html.contains("ACME"), "{html}");
		assert!(html.contains("aria-label=\"Footer Company links\""), "{html}");
		assert!(html.contains("href=\"/team\""), "{html}");
		assert!(html.contains("© 2026 ACME"), "{html}");
		assert!(!html.contains("Offices"), "no offices column without offices: {html}");
		assert!(!html.contains("Newsletter"), "no newsletter column without the slot: {html}");
		assert!(!html.contains("text-ink/30"), "no version link without version: {html}");
	}

	#[test]
	fn offices_and_newsletter_columns_render_with_their_data() {
		fn app() -> Element {
			rsx! {
				Footer {
					brand: "ACME",
					description: "We do a thing.",
					copyright: "© 2026 ACME",
					nav: nav(),
					offices: vec![
						FooterOffice {
							name: "Head Office".to_string(),
							address: "1 Main St".to_string(),
						},
					],
					newsletter_blurb: "Subscribe.",
					newsletter: rsx! {
						form { input {} }
					},
				}
			}
		}
		let html = render(app);
		assert!(html.contains("Head Office"), "{html}");
		assert!(html.contains("1 Main St"), "{html}");
		assert!(html.contains("Newsletter"), "{html}");
		assert!(html.contains("Subscribe."), "{html}");
		assert!(html.contains("<form"), "{html}");
	}

	#[test]
	fn version_link_renders_when_given() {
		fn app() -> Element {
			rsx! {
				Footer {
					brand: "ACME",
					description: "We do a thing.",
					copyright: "© 2026 ACME",
					nav: nav(),
					version: "v1.2.3",
					commit_href: "https://example.com/commit/abc",
				}
			}
		}
		let html = render(app);
		assert!(html.contains("v1.2.3"), "{html}");
		assert!(html.contains("https://example.com/commit/abc"), "{html}");
		assert!(html.contains("text-ink/30"), "{html}");
	}
}
