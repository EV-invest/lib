use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		NAVIGATION_MENU, NAVIGATION_MENU_CONTENT, NAVIGATION_MENU_INDICATOR, NAVIGATION_MENU_ITEM, NAVIGATION_MENU_LINK, NAVIGATION_MENU_LIST, NAVIGATION_MENU_TRIGGER_STYLE,
		NAVIGATION_MENU_VIEWPORT,
		primitives::{Controllable, use_controllable},
	},
};

/// Canonical class for a navigation-menu trigger, the mirror of the TS
/// `navigationMenuTriggerStyle` helper so callers can style a plain link the
/// same way without rendering a [`NavigationMenuTrigger`].
pub fn navigation_menu_trigger_style() -> &'static str {
	NAVIGATION_MENU_TRIGGER_STYLE
}

#[component]
pub fn NavigationMenu(#[props(default = true)] viewport: bool, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(NAVIGATION_MENU, class);
	rsx! {
		nav {
			class: cls,
			"data-slot": "navigation-menu",
			"data-viewport": viewport,
			role: "navigation",
			{children}
		}
	}
}

#[component]
pub fn NavigationMenuList(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(NAVIGATION_MENU_LIST, class);
	rsx! {
		ul { class: cls, "data-slot": "navigation-menu-list", role: "list", {children} }
	}
}

/// One navigation item. Owns the open state of its panel and exposes it to its
/// trigger and content via context — the mirror of Radix's per-item root.
#[component]
pub fn NavigationMenuItem(
	open: Option<bool>,
	#[props(default)] default_open: bool,
	on_open_change: Option<EventHandler<bool>>,
	#[props(default)] class: String,
	children: Element,
) -> Element {
	let state = use_controllable(open, default_open, on_open_change);
	use_context_provider(|| NavigationMenuItemCtx { open: state });
	let cls = cn!(NAVIGATION_MENU_ITEM, class);
	rsx! {
		li { class: cls, "data-slot": "navigation-menu-item", {children} }
	}
}

#[component]
pub fn NavigationMenuTrigger(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<NavigationMenuItemCtx>();
	let open = ctx.open.get();
	let cls = cn!(NAVIGATION_MENU_TRIGGER_STYLE, "group", class);
	rsx! {
		button {
			r#type: "button",
			class: cls,
			"data-slot": "navigation-menu-trigger",
			"data-state": if open { "open" } else { "closed" },
			onclick: move |_| ctx.open.set(!ctx.open.get()),
			{children}
			" "
			svg {
				class: "relative top-[1px] ml-1 size-3 transition duration-300 group-data-[state=open]:rotate-180",
				view_box: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				stroke_width: "2",
				stroke_linecap: "round",
				stroke_linejoin: "round",
				"aria-hidden": "true",
				path { d: "m6 9 6 6 6-6" }
			}
		}
	}
}

#[component]
pub fn NavigationMenuContent(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<NavigationMenuItemCtx>();
	if !ctx.open.get() {
		return rsx! {};
	}
	let cls = cn!(NAVIGATION_MENU_CONTENT, class);
	// dep-light: inline positioning + backdrop; no portal/floating — see README Limitations
	rsx! {
		div {
			class: "fixed inset-0 z-40",
			onclick: move |_| ctx.open.set(false),
		}
		div {
			class: cls,
			"data-slot": "navigation-menu-content",
			"data-state": "open",
			onkeydown: move |e| if e.key() == Key::Escape { ctx.open.set(false); },
			{children}
		}
	}
}

#[component]
pub fn NavigationMenuLink(#[props(default)] active: bool, #[props(default)] href: String, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(NAVIGATION_MENU_LINK, class);
	rsx! {
		a {
			class: cls,
			"data-slot": "navigation-menu-link",
			"data-active": active,
			href,
			{children}
		}
	}
}

/// Visual arrow pointing at the active trigger. Animation is simplified — it
/// renders statically (no measured position; see README Limitations).
#[component]
pub fn NavigationMenuIndicator(#[props(default)] class: String) -> Element {
	let cls = cn!(NAVIGATION_MENU_INDICATOR, class);
	rsx! {
		div { class: cls, "data-slot": "navigation-menu-indicator",
			div { class: "bg-border relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm shadow-md" }
		}
	}
}

/// Shared surface the open panels animate into. Animation/measured sizing is
/// simplified to a static container (see README Limitations).
#[component]
pub fn NavigationMenuViewport(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(NAVIGATION_MENU_VIEWPORT, class);
	rsx! {
		div { class: "absolute top-full left-0 isolate z-50 flex justify-center",
			div { class: cls, "data-slot": "navigation-menu-viewport", {children} }
		}
	}
}

#[derive(Clone, Copy)]
struct NavigationMenuItemCtx {
	open: Controllable<bool>,
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn root_renders_nav_role_and_slot() {
		fn app() -> Element {
			rsx! {
				NavigationMenu {
					NavigationMenuList {
						NavigationMenuItem {
							NavigationMenuTrigger { "Docs" }
						}
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("role=\"navigation\""), "{html}");
		assert!(html.contains("data-slot=\"navigation-menu\""), "{html}");
		assert!(html.contains("role=\"list\""), "{html}");
		assert!(html.contains("data-viewport=true"), "{html}");
	}

	#[test]
	fn trigger_has_chevron_down() {
		fn app() -> Element {
			rsx! {
				NavigationMenu {
					NavigationMenuList {
						NavigationMenuItem {
							NavigationMenuTrigger { "Docs" }
						}
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"navigation-menu-trigger\""), "{html}");
		assert!(html.contains("m6 9 6 6 6-6"), "chevron-down: {html}");
		assert!(html.contains("data-state=\"closed\""), "{html}");
	}

	#[test]
	fn open_item_renders_content_panel() {
		fn app() -> Element {
			rsx! {
				NavigationMenu {
					NavigationMenuList {
						NavigationMenuItem { default_open: true,
							NavigationMenuTrigger { "Docs" }
							NavigationMenuContent {
								NavigationMenuLink { href: "/intro", "Intro" }
							}
						}
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-state=\"open\""), "{html}");
		assert!(html.contains("data-slot=\"navigation-menu-content\""), "{html}");
		assert!(html.contains("data-slot=\"navigation-menu-link\""), "{html}");
		assert!(html.contains("href=\"/intro\""), "{html}");
		assert!(html.contains("fixed inset-0 z-40"), "backdrop: {html}");
	}

	#[test]
	fn closed_item_hides_content() {
		fn app() -> Element {
			rsx! {
				NavigationMenu {
					NavigationMenuList {
						NavigationMenuItem {
							NavigationMenuTrigger { "Docs" }
							NavigationMenuContent {
								NavigationMenuLink { href: "/intro", "Intro" }
							}
						}
					}
				}
			}
		}
		let html = render(app);
		assert!(!html.contains("data-slot=\"navigation-menu-content\""), "closed content hidden: {html}");
	}

	#[test]
	fn active_link_carries_data_active() {
		fn app() -> Element {
			rsx! {
				NavigationMenu {
					NavigationMenuList {
						NavigationMenuItem { default_open: true,
							NavigationMenuTrigger { "Docs" }
							NavigationMenuContent {
								NavigationMenuLink { href: "/intro", active: true, "Intro" }
							}
						}
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-active=true"), "{html}");
	}
}
