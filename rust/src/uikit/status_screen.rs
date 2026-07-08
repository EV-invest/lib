//! The shared 404 / 403 / 500 status surface, ported from site_conductor so every
//! EV app (landing, cabinet) shows the same branded error pages.
//!
//! [`StatusScreen`] is the generic shell; [`NotFound`] / [`Forbidden`] /
//! [`ServerError`] are the ready-made pages with their copy baked in — a host
//! renders those with its own hrefs. Links render as a plain `<a>` (a full
//! document load, which is what you want off an error page); the TS port's
//! `linkComponent` soft-nav affordance has no Dioxus equivalent (see the package
//! README's Rust↔TS notes), matching how site_conductor's `Header` and
//! [`Footer`](crate::uikit::Footer) render their links.

use dioxus::prelude::*;

use crate::cn;

const BTN_BASE: &str = "inline-flex items-center justify-center rounded-md px-6 py-3.5 font-mono-tech text-xs uppercase tracking-widest transition-colors";
/// Accent → token colours. Bound to ev/color tokens; `Blue` is the blueprint
/// accent the design specifies as a raw value (no token equivalent).
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum StatusAccent {
	Teal,
	Gold,
	Red,
	Blue,
}

impl StatusAccent {
	/// Accent text colour — threads through the logo, eyebrow, code and headline.
	fn text(self) -> &'static str {
		match self {
			StatusAccent::Teal => "text-main-accent-t1",
			StatusAccent::Gold => "text-main-accent-t3",
			StatusAccent::Red => "text-destructive",
			StatusAccent::Blue => "text-[#5e9be6]",
		}
	}

	fn filled(self) -> &'static str {
		match self {
			StatusAccent::Teal => "bg-main-accent-t1 text-main-black hover:bg-main-accent-t1/90",
			StatusAccent::Gold => "bg-main-accent-t3 text-main-black hover:bg-main-accent-t3/90",
			StatusAccent::Red => "bg-destructive text-white hover:bg-destructive/90",
			StatusAccent::Blue => "bg-[#5e9be6] text-main-black hover:bg-[#5e9be6]/90",
		}
	}

	fn outline(self) -> &'static str {
		match self {
			StatusAccent::Teal => "border border-main-accent-t1/40 text-main-accent-t1 hover:bg-main-accent-t1/10",
			StatusAccent::Gold => "border border-main-accent-t3/40 text-main-accent-t3 hover:bg-main-accent-t3/10",
			StatusAccent::Red => "border border-destructive/40 text-destructive hover:bg-destructive/10",
			StatusAccent::Blue => "border border-[#5e9be6]/40 text-[#5e9be6] hover:bg-[#5e9be6]/10",
		}
	}
}

/// A status CTA's fill — filled (solid accent) or outline (accent border).
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum StatusButtonVariant {
	Filled,
	Outline,
}

/// Class for a status CTA — shared by the nav links and the 500 retry button.
pub fn status_button_class(accent: StatusAccent, variant: StatusButtonVariant) -> String {
	cn!(
		BTN_BASE,
		match variant {
			StatusButtonVariant::Filled => accent.filled(),
			StatusButtonVariant::Outline => accent.outline(),
		}
	)
}

/// One CTA in a [`StatusScreen`]'s action row.
#[derive(Clone, Debug, PartialEq)]
pub struct StatusLinkData {
	pub label: String,
	pub href: String,
	pub variant: StatusButtonVariant,
	pub leading_arrow: bool,
}

// The EV skyline crown — the rooftop silhouette of the brand logo (Figma uikit
// node 17:3, wordmark omitted), filled with `currentColor` so it takes the accent.
/// Shared skeleton for the 404 / 403 / 500 status pages: a centred hero with the
/// logo mark, a mono eyebrow, a giant Playfair code, a headline whose final clause
/// is an italic accent, supporting copy, and the CTAs. The accent threads through
/// all four marks. Actions render inline (from `links` data, plus an optional
/// `children` leading slot, e.g. the 500 client retry).
#[component]
pub fn StatusScreen(
	accent: StatusAccent,
	eyebrow: String,
	code: String,
	headline_lead: String,
	headline_accent: String,
	#[props(default = ".".to_string())] headline_tail: String,
	subtext: String,
	#[props(default)] links: Vec<StatusLinkData>,
	/// Leading action slot, rendered before `links` (e.g. the 500 client retry).
	children: Element,
) -> Element {
	let accent_text = accent.text();
	rsx! {
		section { class: "relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-main-black px-6 py-32 text-center",
			div {
				aria_hidden: "true",
				class: cn!(
					"pointer-events-none absolute inset-0 opacity-[0.07] [background:radial-gradient(55%_45%_at_50%_30%,currentColor,transparent_70%)]",
					accent_text
				),
			}
			div { class: "relative z-10 flex w-full max-w-2xl flex-col items-center",
				{logo_mark(cn!("mb-7 h-10 w-auto", accent_text))}
				p { class: cn!("mb-6 font-mono-tech text-[11px] uppercase tracking-[0.34em]", accent_text), {eyebrow} }
				p { class: cn!("font-serif-display text-[110px] font-medium leading-[0.9] sm:text-[180px]", accent_text), {code} }
				h1 { class: "mt-4 font-serif-display text-3xl font-light leading-tight text-white sm:text-5xl",
					{headline_lead}
					span { class: cn!("font-serif italic", accent_text), {headline_accent} }
					{headline_tail}
				}
				p { class: "mx-auto mt-5 max-w-md text-sm leading-relaxed text-main-mist/60 sm:text-base", {subtext} }
				div { class: "mt-9 flex flex-col items-center gap-3 sm:flex-row",
					{children}
					for link in links.iter() {
						a {
							key: "{link.label}",
							href: link.href.clone(),
							class: status_button_class(accent, link.variant),
							if link.leading_arrow {
								{arrow_left_icon()}
							}
							{link.label.clone()}
						}
					}
				}
			}
		}
	}
}
/// 404 — page not found.
#[component]
pub fn NotFound(#[props(default = "/".to_string())] home_href: String, #[props(default = "/contact".to_string())] contact_href: String) -> Element {
	rsx! {
		StatusScreen {
			accent: StatusAccent::Teal,
			eyebrow: "Page not found",
			code: "404",
			headline_lead: "You've reached ",
			headline_accent: "open water",
			subtext: "The page you're looking for has drifted off our coastline — moved, renamed, or never charted. Let's get you back to shore.",
			links: vec![
				StatusLinkData {
					label: "Back to home".to_string(),
					href: home_href,
					variant: StatusButtonVariant::Filled,
					leading_arrow: true,
				},
				StatusLinkData {
					label: "Contact the team".to_string(),
					href: contact_href,
					variant: StatusButtonVariant::Outline,
					leading_arrow: false,
				},
			],
		}
	}
}
/// 403 — access forbidden.
#[component]
pub fn Forbidden(#[props(default = "/".to_string())] home_href: String, #[props(default = "/contact".to_string())] contact_href: String) -> Element {
	rsx! {
		StatusScreen {
			accent: StatusAccent::Gold,
			eyebrow: "Access forbidden",
			code: "403",
			headline_lead: "This harbour is ",
			headline_accent: "private",
			subtext: "You don't have the credentials to view this page. If you believe you should, our team can open the right doors.",
			links: vec![
				StatusLinkData {
					label: "Back to home".to_string(),
					href: home_href,
					variant: StatusButtonVariant::Filled,
					leading_arrow: true,
				},
				StatusLinkData {
					label: "Request access".to_string(),
					href: contact_href,
					variant: StatusButtonVariant::Outline,
					leading_arrow: false,
				},
			],
		}
	}
}
/// 500 — server error. The "Try again" button runs `reset` or reloads the page.
#[component]
pub fn ServerError(#[props(default = "/".to_string())] home_href: String, reset: Option<EventHandler<()>>) -> Element {
	rsx! {
		StatusScreen {
			accent: StatusAccent::Red,
			eyebrow: "Server error",
			code: "500",
			headline_lead: "Our systems are ",
			headline_accent: "recalibrating",
			subtext: "Something broke on our end — not yours. We've been alerted and are restoring service. Please try again in a moment.",
			links: vec![
				StatusLinkData {
					label: "Back to home".to_string(),
					href: home_href,
					variant: StatusButtonVariant::Outline,
					leading_arrow: true,
				},
			],
			button {
				r#type: "button",
				class: status_button_class(StatusAccent::Red, StatusButtonVariant::Filled),
				onclick: move |_| {
					if let Some(cb) = reset {
						cb.call(());
					} else {
						let _ = document::eval("window.location.reload();");
					}
				},
				"Try again"
			}
		}
	}
}
fn logo_mark(class: String) -> Element {
	rsx! {
		svg {
			xmlns: "http://www.w3.org/2000/svg",
			view_box: "0 0 140 48",
			class,
			"aria-hidden": "true",
			g { fill: "currentColor",
				path { d: "M0.0437012 47.3326L50.9499 40.5805V22.3378L56.4881 23.6408V37.9071L59.1984 37.5005V24.1147L64.6189 25.1808V37.0269L67.2113 36.553V22.1009L56.606 17.481L43.408 21.864V36.553L0.0437012 47.3326Z" }
				path { d: "M77.2277 40.5804L85.9478 41.4099L85.8299 0.304321L73.1033 7.17499V26.3654L77.2277 28.2608V40.5804Z" }
				path { d: "M87.126 0.304321L99.9705 7.29343V42.5943L94.3141 41.8835V9.54417L87.126 5.75347V0.304321Z" }
				path { d: "M103.034 42.9496L139.682 46.0296L110.104 39.7513V26.8393L103.034 23.0486V42.9496Z" }
			}
		}
	}
}

// lucide `arrow-left`, inlined so the kit keeps its zero-icon-dep footprint.
fn arrow_left_icon() -> Element {
	rsx! {
		svg {
			xmlns: "http://www.w3.org/2000/svg",
			class: "mr-2 h-4 w-4",
			view_box: "0 0 24 24",
			fill: "none",
			stroke: "currentColor",
			stroke_width: "2",
			stroke_linecap: "round",
			stroke_linejoin: "round",
			"aria-hidden": "true",
			path { d: "m12 19-7-7 7-7" }
			path { d: "M19 12H5" }
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn status_screen_renders_code_eyebrow_headline_and_link() {
		fn app() -> Element {
			rsx! {
				StatusScreen {
					accent: StatusAccent::Teal,
					eyebrow: "Page not found",
					code: "404",
					headline_lead: "You've reached ",
					headline_accent: "open water",
					subtext: "drifted off",
					links: vec![StatusLinkData {
						label: "Back to home".to_string(),
						href: "/".to_string(),
						variant: StatusButtonVariant::Filled,
						leading_arrow: true,
					}],
				}
			}
		}
		let html = render(app);
		assert!(html.contains("404"), "{html}");
		assert!(html.contains("Page not found"), "{html}");
		assert!(html.contains("open water"), "{html}");
		assert!(html.contains("<a"), "CTA is a plain anchor: {html}");
		assert!(html.contains("href=\"/\""), "{html}");
	}

	#[test]
	fn ready_made_pages_bake_in_code_and_hrefs() {
		fn not_found() -> Element {
			rsx! {
				NotFound { home_href: "/", contact_href: "/contact" }
			}
		}
		let html = render(not_found);
		assert!(html.contains("404"), "{html}");
		assert!(html.contains("Back to home"), "{html}");
		assert!(html.contains("href=\"/contact\""), "{html}");
		assert!(html.contains("Contact the team"), "{html}");

		fn forbidden() -> Element {
			rsx! {
				Forbidden {}
			}
		}
		let html = render(forbidden);
		assert!(html.contains("403"), "{html}");
		assert!(html.contains("Request access"), "{html}");
	}

	#[test]
	fn server_error_shows_500_and_retry_button() {
		fn app() -> Element {
			rsx! {
				ServerError {}
			}
		}
		let html = render(app);
		assert!(html.contains("500"), "{html}");
		assert!(html.contains("Try again"), "{html}");
		assert!(html.contains("<button"), "retry is a button: {html}");
	}
}
