use dioxus::prelude::*;

use crate::{
	cn,
	uikit::primitives::{Controllable, use_controllable},
};

const ROOT: &str = "group/navigation-menu relative flex max-w-max flex-1 items-center justify-center";
const LIST: &str = "group flex flex-1 list-none items-center justify-center gap-1";
const TRIGGER_STYLE: &str = "group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 \
                             text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:bg-accent \
                             focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 \
                             data-[state=open]:hover:bg-accent data-[state=open]:text-accent-foreground \
                             data-[state=open]:focus:bg-accent data-[state=open]:bg-accent/50 focus-visible:ring-ring/50 \
                             outline-none transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1";
const CONTENT: &str = "data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out data-[motion^=from-]:fade-in \
                       data-[motion^=to-]:fade-out data-[motion=from-end]:slide-in-from-right-52 \
                       data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 \
                       data-[motion=to-start]:slide-out-to-left-52 top-0 left-0 w-full p-2 pr-2.5 md:absolute md:w-auto \
                       group-data-[viewport=false]/navigation-menu:bg-popover \
                       group-data-[viewport=false]/navigation-menu:text-popover-foreground \
                       group-data-[viewport=false]/navigation-menu:data-[state=open]:animate-in \
                       group-data-[viewport=false]/navigation-menu:data-[state=closed]:animate-out \
                       group-data-[viewport=false]/navigation-menu:data-[state=closed]:zoom-out-95 \
                       group-data-[viewport=false]/navigation-menu:data-[state=open]:zoom-in-95 \
                       group-data-[viewport=false]/navigation-menu:data-[state=open]:fade-in-0 \
                       group-data-[viewport=false]/navigation-menu:data-[state=closed]:fade-out-0 \
                       group-data-[viewport=false]/navigation-menu:top-full \
                       group-data-[viewport=false]/navigation-menu:mt-1.5 \
                       group-data-[viewport=false]/navigation-menu:overflow-hidden \
                       group-data-[viewport=false]/navigation-menu:rounded-md \
                       group-data-[viewport=false]/navigation-menu:border \
                       group-data-[viewport=false]/navigation-menu:shadow \
                       group-data-[viewport=false]/navigation-menu:duration-200 \
                       **:data-[slot=navigation-menu-link]:focus:ring-0 \
                       **:data-[slot=navigation-menu-link]:focus:outline-none";
const LINK: &str = "data-[active=true]:focus:bg-accent data-[active=true]:hover:bg-accent data-[active=true]:bg-accent/50 \
                    data-[active=true]:text-accent-foreground hover:bg-accent hover:text-accent-foreground \
                    focus:bg-accent focus:text-accent-foreground focus-visible:ring-ring/50 \
                    [&_svg:not([class*='text-'])]:text-muted-foreground flex flex-col gap-1 rounded-sm p-2 text-sm \
                    transition-all outline-none focus-visible:ring-[3px] focus-visible:outline-1 \
                    [&_svg:not([class*='size-'])]:size-4";
const INDICATOR: &str = "data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out \
                         data-[state=visible]:fade-in top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden";
const VIEWPORT_INNER: &str = "origin-top-center bg-popover text-popover-foreground data-[state=open]:animate-in \
                              data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-90 \
                              relative mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden \
                              rounded-md border shadow md:w-[var(--radix-navigation-menu-viewport-width)]";

/// Canonical class for a navigation-menu trigger, the mirror of the TS
/// `navigationMenuTriggerStyle` helper so callers can style a plain link the
/// same way without rendering a [`NavigationMenuTrigger`].
pub fn navigation_menu_trigger_style() -> &'static str {
	TRIGGER_STYLE
}

#[component]
pub fn NavigationMenu(#[props(default = true)] viewport: bool, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(ROOT, class);
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
	let cls = cn!(LIST, class);
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
	let cls = cn!("relative", class);
	rsx! {
		li { class: cls, "data-slot": "navigation-menu-item", {children} }
	}
}

#[component]
pub fn NavigationMenuTrigger(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<NavigationMenuItemCtx>();
	let open = ctx.open.get();
	let cls = cn!(TRIGGER_STYLE, "group", class);
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
	let cls = cn!(CONTENT, class);
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
	let cls = cn!(LINK, class);
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
	let cls = cn!(INDICATOR, class);
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
	let cls = cn!(VIEWPORT_INNER, class);
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
