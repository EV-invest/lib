use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{Container, Logo},
};

const HEADER_BASE: &str = "fixed top-0 left-0 w-full z-[60] border-b";
// Marketing chrome: the scroll-aware transition, layered over the top/scrolled
// state. Compact omits it — a fixed-height bar has nothing to animate.
const HEADER_MARKETING: &str = "transition-all duration-500";
const HEADER_SCROLLED: &str = "bg-main-black/90 backdrop-blur-md border-main-mist/10 py-4";
const HEADER_TOP: &str = "bg-transparent border-transparent py-6";
// Compact chrome: a fixed 4rem opaque bar for app surfaces (e.g. the cabinet)
// whose content sits directly beneath it — opaque by default so nothing bleeds
// through, and a known height a sticky sidebar can butt flush against.
const HEADER_COMPACT: &str = "h-16 bg-main-black/90 backdrop-blur-md border-main-mist/10";

/// Mirrors the landing's `window.scrollY > 50` listener; only flips are sent so
/// scrolling doesn't flood a liveview channel. On renderers without a document
/// (e.g. SSR) `document::eval` is a no-op and the header stays in its top state.
const SCROLL_JS: &str = "let last = null; \
                         const update = () => { const s = window.scrollY > 50; if (s !== last) { last = s; dioxus.send(s); } }; \
                         window.addEventListener('scroll', update, { passive: true }); \
                         update();";

/// The mobile overlay's side effects, alive from open until the first close
/// signal: lock body scroll, close on Escape, and close when any `<a>`/`<button>`
/// inside the overlay is activated (event delegation — the app-side CTA needs no
/// wiring). Every close path runs through `done`, which restores the body scroll
/// and detaches both listeners before signalling Rust.
const OVERLAY_JS: &str = "document.body.style.overflow = 'hidden'; \
                          const done = () => { document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); document.removeEventListener('click', onClick); dioxus.send(true); }; \
                          const onKey = (e) => { if (e.key === 'Escape') done(); }; \
                          const onClick = (e) => { if (e.target.closest && e.target.closest('[data-slot=header-mobile-overlay]') && e.target.closest('a,button')) done(); }; \
                          document.addEventListener('keydown', onKey); \
                          document.addEventListener('click', onClick);";

/// A header navigation entry. Nav items stay app-side — the kit owns only the chrome.
#[derive(Clone, Debug, PartialEq)]
pub struct HeaderNavItem {
	pub label: String,
	pub href: String,
}

/// Chrome density preset — see the `variant` prop on [`Header`].
///
/// - [`Marketing`](HeaderVariant::Marketing) (default): the scroll-aware bar,
///   tall and transparent over a hero, condensing to an opaque blurred bar past
///   50px.
/// - [`Compact`](HeaderVariant::Compact): a fixed short opaque bar for app
///   surfaces whose content sits directly beneath it — no scroll growth, so a
///   sticky sidebar can butt flush against a known 4rem height.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub enum HeaderVariant {
	#[default]
	Marketing,
	Compact,
}

/// The EV brand chrome header, ported from site_conductor: a fixed, scroll-aware
/// bar (transparent over the hero, blurred dark once scrolled past 50px) with the
/// brand lockup, a desktop nav and a built-in below-`lg` full-screen menu. The
/// `cta` slot renders at the right of the bar and again at the mobile menu's
/// bottom; the consumer styles it.
///
/// `variant` picks the chrome density ([`HeaderVariant`]): `Marketing` (default)
/// is the scroll-aware bar; `Compact` is a fixed short opaque bar for app
/// surfaces. `hide_nav` drops the nav — the desktop row and the mobile menu —
/// keeping only the lockup and CTA (the lockup still links home).
#[component]
pub fn Header(
	nav: Vec<HeaderNavItem>,
	cta: Option<Element>,
	/// Overlay-specific CTA (e.g. full-width variant); falls back to `cta`.
	mobile_cta: Option<Element>,
	#[props(default = "Quy Nhon Fund".to_string())] tagline: String,
	#[props(default = "/".to_string())] home_href: String,
	#[props(default)] class: String,
	/// Chrome density, per host surface. See [`HeaderVariant`]. A per-surface
	/// preset — fixed for the Header's lifetime: the scroll wiring is decided once
	/// at mount, so (unlike the TS port's `[compact]` effect) it is not
	/// re-subscribed if `variant` flips at runtime.
	#[props(default)]
	variant: HeaderVariant,
	/// Drop the primary nav (desktop row + mobile menu), keeping the lockup + CTA.
	#[props(default)]
	hide_nav: bool,
) -> Element {
	let mut scrolled = use_signal(|| false);
	let mut menu_open = use_signal(|| false);
	let compact = variant == HeaderVariant::Compact;

	use_future(move || async move {
		// Compact keeps a fixed height, so it never needs the scroll position.
		if compact {
			return;
		}
		let mut scroll_flips = document::eval(SCROLL_JS);
		while let Ok(s) = scroll_flips.recv::<bool>().await {
			scrolled.set(s);
		}
	});

	// The overlay closes only through the OVERLAY_JS channel (Escape / delegated
	// click), so its listeners and the body-scroll lock always unwind together.
	// Where eval is unsupported the recv errors immediately and the menu simply
	// re-closes instead of trapping the user behind an undismissable overlay.
	use_effect(move || {
		if menu_open() {
			spawn(async move {
				let mut closed = document::eval(OVERLAY_JS);
				let _ = closed.recv::<bool>().await;
				menu_open.set(false);
			});
		}
	});

	// TS restores the body-scroll lock in its effect cleanup; mirror that on
	// unmount so a Header torn down while the overlay is open can't leave the page
	// unscrollable. Escape / delegated-click still unwind through OVERLAY_JS's
	// `done`; this only guards the unmount-while-open path (SSR: eval is a no-op).
	use_drop(move || {
		let _ = document::eval("document.body.style.overflow = '';");
	});

	rsx! {
		header {
			class: cn!(
				HEADER_BASE,
				if compact {
					HEADER_COMPACT.to_string()
				} else {
					cn!(HEADER_MARKETING, if scrolled() { HEADER_SCROLLED } else { HEADER_TOP })
				},
				class
			),
			"data-slot": "header",
			"data-variant": if compact { "compact" } else { "marketing" },
			Container { class: "flex h-full items-center justify-between gap-4",
				a { href: home_href, class: "flex items-center gap-3", aria_label: "EV Investment — home",
					Logo { class: "w-10 h-10 text-white" }
					div { class: "flex flex-col",
						span { class: "font-serif-display font-bold text-lg tracking-wider text-white", "EV INVESTMENT" }
						span { class: "text-[9px] font-mono-tech tracking-[0.3em] text-main-accent-t1 uppercase", {tagline} }
					}
				}
				if !hide_nav {
					nav { class: "hidden lg:flex items-center gap-6 font-mono-tech text-xs tracking-widest uppercase",
						for item in nav.iter() {
							a {
								key: "{item.href}",
								href: item.href.clone(),
								class: "text-main-mist/80 hover:text-main-accent-t1 transition-colors",
								{item.label.clone()}
							}
						}
					}
				}
				div { class: "flex items-center gap-3",
					{cta.clone()}
					if !hide_nav {
						div { class: "lg:hidden",
							button {
								r#type: "button",
								aria_label: "Open menu",
								"aria-expanded": if menu_open() { "true" } else { "false" },
								"aria-haspopup": "menu",
								class: "flex size-10 items-center justify-center text-white",
								onclick: move |_| menu_open.set(true),
								svg {
									xmlns: "http://www.w3.org/2000/svg",
									class: "size-6",
									view_box: "0 0 24 24",
									fill: "none",
									stroke: "currentColor",
									stroke_width: "2",
									stroke_linecap: "round",
									stroke_linejoin: "round",
									path { d: "M4 6h16M4 12h16M4 18h16" }
								}
							}
						}
					}
				}
			}
		}
		// A sibling of the <header> ON PURPOSE (the source portals to document.body):
		// once scrolled, the header gains `backdrop-blur`, which makes it the
		// containing block for any `position: fixed` descendant — that would clamp
		// `inset-0` to the header box and let the page bleed through.
		if menu_open() {
			div {
				class: "fixed inset-0 z-[70] flex flex-col bg-main-black px-6 pb-10 duration-200 animate-in fade-in lg:hidden",
				"data-slot": "header-mobile-overlay",
				div { class: "flex h-20 shrink-0 items-center justify-end",
					button {
						r#type: "button",
						aria_label: "Close menu",
						class: "flex size-10 items-center justify-center text-white",
						svg {
							xmlns: "http://www.w3.org/2000/svg",
							class: "size-6",
							view_box: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							stroke_width: "2",
							stroke_linecap: "round",
							stroke_linejoin: "round",
							path { d: "M18 6 6 18M6 6l12 12" }
						}
					}
				}
				nav { class: "flex flex-col font-mono-tech text-sm uppercase tracking-widest duration-300 ease-out animate-in fade-in slide-in-from-top-4",
					for item in nav.iter() {
						a {
							key: "{item.href}",
							href: item.href.clone(),
							class: "border-b border-main-mist/10 py-4 text-main-mist/80 transition-colors hover:text-main-accent-t1",
							{item.label.clone()}
						}
					}
				}
				if mobile_cta.is_some() || cta.is_some() {
					div { class: "mt-8 w-full block", {mobile_cta.clone().or_else(|| cta.clone())} }
				}
			}
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	fn nav() -> Vec<HeaderNavItem> {
		vec![HeaderNavItem {
			label: "Team".to_string(),
			href: "/team".to_string(),
		}]
	}

	#[test]
	fn renders_lockup_nav_and_menu_trigger() {
		fn app() -> Element {
			rsx! {
				Header { nav: nav() }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"header\""), "{html}");
		assert!(html.contains("EV INVESTMENT"), "{html}");
		assert!(html.contains("Quy Nhon Fund"), "default tagline: {html}");
		assert!(html.contains("aria-label=\"EV Investment — home\""), "{html}");
		assert!(html.contains("href=\"/team\""), "{html}");
		assert!(html.contains("Team"), "{html}");
		assert!(html.contains("aria-label=\"Open menu\""), "{html}");
		assert!(html.contains("bg-transparent"), "unscrolled by default: {html}");
		assert!(!html.contains("header-mobile-overlay"), "menu closed by default: {html}");
	}

	#[test]
	fn cta_slot_and_overrides_render() {
		fn app() -> Element {
			rsx! {
				Header {
					nav: nav(),
					tagline: "Custom Fund",
					home_href: "/home",
					cta: rsx! {
						button { "Investor Portal" }
					},
				}
			}
		}
		let html = render(app);
		assert!(html.contains("Investor Portal"), "{html}");
		assert!(html.contains("Custom Fund"), "{html}");
		assert!(!html.contains("Quy Nhon Fund"), "{html}");
		assert!(html.contains("href=\"/home\""), "{html}");
	}

	#[test]
	fn compact_variant_is_fixed_opaque_bar() {
		fn app() -> Element {
			rsx! {
				Header { nav: nav(), variant: HeaderVariant::Compact }
			}
		}
		let html = render(app);
		assert!(html.contains("data-variant=\"compact\""), "{html}");
		assert!(html.contains("h-16"), "fixed 4rem bar: {html}");
		assert!(html.contains("bg-main-black/90"), "opaque by default: {html}");
		assert!(!html.contains("bg-transparent"), "compact never goes transparent: {html}");
	}

	#[test]
	fn hide_nav_drops_nav_and_menu_trigger() {
		fn app() -> Element {
			rsx! {
				Header { nav: nav(), hide_nav: true }
			}
		}
		let html = render(app);
		assert!(html.contains("EV INVESTMENT"), "lockup stays: {html}");
		assert!(!html.contains("href=\"/team\""), "desktop nav dropped: {html}");
		assert!(!html.contains("aria-label=\"Open menu\""), "mobile trigger dropped: {html}");
	}
}
