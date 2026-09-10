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

use crate::{
	cn,
	uikit::{ButtonVariant, Size, button_classes},
};

/// Which accent rung a surface wears — for a status page, the mark, eyebrow,
/// code, headline and CTAs all take it. Ordered by significance: 404 is a shrug,
/// 403 a warning, 500 an error. See the kit's docs/spec/accents.md.
///
/// The tables spell out every rung because Tailwind scans for literal class
/// names; `bg-accent-{rung}` would compile to nothing.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Accent {
	Trace,
	Debug,
	Info,
	Warn,
	Error,
}

impl Accent {
	/// Accent text colour — threads through the logo, eyebrow, code and headline.
	fn text(self) -> &'static str {
		match self {
			Accent::Trace => "text-accent-trace",
			Accent::Debug => "text-accent-debug",
			Accent::Info => "text-accent-info",
			Accent::Warn => "text-accent-warn",
			Accent::Error => "text-accent-error",
		}
	}

	fn filled(self) -> &'static str {
		match self {
			Accent::Trace => "bg-accent-trace text-on-accent-trace hover:bg-accent-trace/90",
			Accent::Debug => "bg-accent-debug text-background hover:bg-accent-debug/90",
			Accent::Info => "bg-accent-info text-on-accent-info hover:bg-accent-info/90",
			Accent::Warn => "bg-accent-warn text-background hover:bg-accent-warn/90",
			Accent::Error => "bg-accent-error text-on-accent-error hover:bg-accent-error/90",
		}
	}

	fn outline(self) -> &'static str {
		match self {
			Accent::Trace => "border border-accent-trace/40 text-accent-trace hover:bg-accent-trace/10",
			Accent::Debug => "border border-accent-debug/40 text-accent-debug hover:bg-accent-debug/10",
			Accent::Info => "border border-accent-info/40 text-accent-info hover:bg-accent-info/10",
			Accent::Warn => "border border-accent-warn/40 text-accent-warn hover:bg-accent-warn/10",
			Accent::Error => "border border-accent-error/40 text-accent-error hover:bg-accent-error/10",
		}
	}
}

/// One CTA in a [`StatusScreen`]'s action row.
#[derive(Clone, Debug, PartialEq)]
pub struct StatusLinkData {
	pub label: String,
	pub href: String,
	pub variant: ButtonVariant,
	pub leading_arrow: bool,
}
/// Shared skeleton for the 404 / 403 / 500 status pages: a centred hero with the
/// logo mark, a mono eyebrow, a giant Playfair code, a headline whose final clause
/// is an italic accent, supporting copy, and the CTAs. The accent threads through
/// all four marks. Actions render inline (from `links` data, plus an optional
/// `children` leading slot, e.g. the 500 client retry).
#[component]
pub fn StatusScreen(
	accent: Accent,
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
		section { class: "relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-32 text-center",
			div {
				aria_hidden: "true",
				class: cn!(
					"pointer-events-none absolute inset-0 opacity-[0.07] [background:radial-gradient(55%_45%_at_50%_30%,currentColor,transparent_70%)]",
					accent_text
				),
			}
			div { class: "relative z-10 flex w-full max-w-2xl flex-col items-center",
				{logo_mark(cn!("mb-7 h-10 w-auto", accent_text))}
				p { class: cn!("mb-6 font-mono text-[11px] uppercase tracking-[0.34em]", accent_text), {eyebrow} }
				p { class: cn!("font-serif text-[110px] font-medium leading-[0.9] sm:text-[180px]", accent_text), {code} }
				h1 { class: "mt-4 font-serif text-3xl font-light leading-tight text-ink sm:text-5xl",
					{headline_lead}
					span { class: cn!("font-serif italic", accent_text), {headline_accent} }
					{headline_tail}
				}
				p { class: "mx-auto mt-5 max-w-md text-sm leading-relaxed text-ink/60 sm:text-base", {subtext} }
				div { class: "mt-9 flex flex-col items-center gap-3 sm:flex-row",
					{children}
					for link in links.iter() {
						a {
							key: "{link.label}",
							href: link.href.clone(),
							class: status_cta_class(accent, link.variant),
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
			accent: Accent::Debug,
			eyebrow: "Page not found",
			code: "404",
			headline_lead: "You've reached ",
			headline_accent: "open water",
			subtext: "The page you're looking for has drifted off our coastline — moved, renamed, or never charted. Let's get you back to shore.",
			links: vec![
				StatusLinkData {
					label: "Back to home".to_string(),
					href: home_href,
					variant: ButtonVariant::Primary,
					leading_arrow: true,
				},
				StatusLinkData {
					label: "Contact the team".to_string(),
					href: contact_href,
					variant: ButtonVariant::Outline,
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
			accent: Accent::Warn,
			eyebrow: "Access forbidden",
			code: "403",
			headline_lead: "This harbour is ",
			headline_accent: "private",
			subtext: "You don't have the credentials to view this page. If you believe you should, our team can open the right doors.",
			links: vec![
				StatusLinkData {
					label: "Back to home".to_string(),
					href: home_href,
					variant: ButtonVariant::Primary,
					leading_arrow: true,
				},
				StatusLinkData {
					label: "Request access".to_string(),
					href: contact_href,
					variant: ButtonVariant::Outline,
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
			accent: Accent::Error,
			eyebrow: "Server error",
			code: "500",
			headline_lead: "Our systems are ",
			headline_accent: "recalibrating",
			subtext: "Something broke on our end — not yours. We've been alerted and are restoring service. Please try again in a moment.",
			links: vec![
				StatusLinkData {
					label: "Back to home".to_string(),
					href: home_href,
					variant: ButtonVariant::Outline,
					leading_arrow: true,
				},
			],
			button {
				r#type: "button",
				class: status_cta_class(Accent::Error, ButtonVariant::Primary),
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
/// A status CTA is a [`Button`](crate::uikit::Button) at the page's accent: the
/// canonical button string, then the mono/uppercase treatment the error pages
/// wear, then the accent colour.
///
/// Public because a host that renders its own action into [`StatusScreen`]'s
/// slot — a retry button wired to a framework's `reset`, say — has to be able to
/// match the CTAs beside it, and the accent colour maps are ours.
pub fn status_cta_class(accent: Accent, variant: ButtonVariant) -> String {
	cn!(
		button_classes(&variant, Size::Lg, false, ""),
		"font-mono text-xs uppercase tracking-widest",
		match variant {
			ButtonVariant::Outline => accent.outline(),
			_ => accent.filled(),
		}
	)
}

// The EV skyline crown — the rooftop silhouette of the brand logo (Figma uikit
// node 17:3, wordmark omitted), filled with `currentColor` so it takes the accent.
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
					accent: Accent::Debug,
					eyebrow: "Page not found",
					code: "404",
					headline_lead: "You've reached ",
					headline_accent: "open water",
					subtext: "drifted off",
					links: vec![StatusLinkData {
						label: "Back to home".to_string(),
						href: "/".to_string(),
						variant: ButtonVariant::Primary,
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
