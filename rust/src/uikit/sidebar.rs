use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		SIDEBAR_CONTENT, SIDEBAR_FLAT, SIDEBAR_FOOTER, SIDEBAR_GROUP, SIDEBAR_GROUP_CONTENT, SIDEBAR_GROUP_LABEL, SIDEBAR_HEADER, SIDEBAR_INNER, SIDEBAR_INSET, SIDEBAR_MENU,
		SIDEBAR_MENU_BUTTON_BASE, SIDEBAR_MENU_ITEM, SIDEBAR_RAIL, SIDEBAR_SEPARATOR, SIDEBAR_TRIGGER, SIDEBAR_WRAPPER, SidebarMenuButtonSize, SidebarMenuButtonVariant,
		primitives::{Controllable, use_controllable},
	},
};

// omitted: mobile sheet, cookie, kbd shortcut — see README Limitations

const SIDEBAR_WIDTH: &str = "16rem";
const SIDEBAR_WIDTH_ICON: &str = "3rem";

/// Shared sidebar state, provided by [`SidebarProvider`] and read by the parts.
/// Wraps the `Copy` [`Controllable<bool>`] so the whole context is `Copy`.
#[derive(Clone, Copy)]
pub struct SidebarContext {
	open: Controllable<bool>,
}

impl SidebarContext {
	pub fn open(&self) -> bool {
		self.open.get()
	}

	pub fn set_open(&self, value: bool) {
		self.open.set(value);
	}

	pub fn toggle_sidebar(&self) {
		self.open.set(!self.open.get());
	}

	pub fn state(&self) -> &'static str {
		if self.open.get() { "expanded" } else { "collapsed" }
	}
}

pub fn use_sidebar() -> SidebarContext {
	use_context::<SidebarContext>()
}

#[component]
pub fn SidebarProvider(
	#[props(default = true)] default_open: bool,
	open: Option<bool>,
	on_open_change: Option<EventHandler<bool>>,
	#[props(default)] class: String,
	children: Element,
) -> Element {
	let open = use_controllable(open, default_open, on_open_change);
	use_context_provider(|| SidebarContext { open });
	let cls = cn!(SIDEBAR_WRAPPER, class);
	rsx! {
		div {
			"data-slot": "sidebar-wrapper",
			style: "--sidebar-width: {SIDEBAR_WIDTH}; --sidebar-width-icon: {SIDEBAR_WIDTH_ICON};",
			class: cls,
			{children}
		}
	}
}

#[derive(strum::AsRefStr, Clone, Default, PartialEq)]
#[strum(serialize_all = "kebab-case")]
pub enum SidebarSide {
	#[default]
	Left,
	Right,
}

#[derive(strum::AsRefStr, Clone, Default, PartialEq)]
#[strum(serialize_all = "kebab-case")]
pub enum SidebarVariant {
	#[default]
	Sidebar,
	Floating,
	Inset,
}

#[derive(strum::AsRefStr, Clone, Default, PartialEq)]
#[strum(serialize_all = "kebab-case")]
pub enum SidebarCollapsible {
	#[default]
	Offcanvas,
	Icon,
	None,
}

#[component]
pub fn Sidebar(
	#[props(default)] side: SidebarSide,
	#[props(default)] variant: SidebarVariant,
	#[props(default)] collapsible: SidebarCollapsible,
	#[props(default)] class: String,
	children: Element,
) -> Element {
	let ctx = use_sidebar();

	if collapsible == SidebarCollapsible::None {
		let cls = cn!(SIDEBAR_FLAT, class);
		return rsx! {
			div { class: cls, "data-slot": "sidebar", {children} }
		};
	}

	let state = ctx.state();
	let data_collapsible = if state == "collapsed" { collapsible.as_ref() } else { "" };
	let inner = cn!(SIDEBAR_INNER, class);
	rsx! {
		div {
			class: "group peer text-sidebar-foreground hidden md:block",
			"data-state": state,
			"data-collapsible": data_collapsible,
			"data-variant": variant.as_ref(),
			"data-side": side.as_ref(),
			"data-slot": "sidebar",
			div { class: inner, "data-slot": "sidebar-inner", {children} }
		}
	}
}

#[component]
pub fn SidebarTrigger(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_sidebar();
	let cls = cn!(SIDEBAR_TRIGGER, class);
	rsx! {
		button {
			r#type: "button",
			"data-sidebar": "trigger",
			"data-slot": "sidebar-trigger",
			"aria-label": "Toggle Sidebar",
			class: cls,
			onclick: move |_| ctx.toggle_sidebar(),
			{children}
			span { class: "sr-only", "Toggle Sidebar" }
		}
	}
}

#[component]
pub fn SidebarRail(#[props(default)] class: String) -> Element {
	let ctx = use_sidebar();
	let cls = cn!(SIDEBAR_RAIL, class);
	rsx! {
		button {
			r#type: "button",
			"data-sidebar": "rail",
			"data-slot": "sidebar-rail",
			"aria-label": "Toggle Sidebar",
			tabindex: "-1",
			title: "Toggle Sidebar",
			class: cls,
			onclick: move |_| ctx.toggle_sidebar(),
		}
	}
}

#[component]
pub fn SidebarInset(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(SIDEBAR_INSET, class);
	rsx! {
		main { class: cls, "data-slot": "sidebar-inset", {children} }
	}
}

#[component]
pub fn SidebarHeader(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(SIDEBAR_HEADER, class);
	rsx! {
		div { class: cls, "data-slot": "sidebar-header", "data-sidebar": "header", {children} }
	}
}

#[component]
pub fn SidebarFooter(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(SIDEBAR_FOOTER, class);
	rsx! {
		div { class: cls, "data-slot": "sidebar-footer", "data-sidebar": "footer", {children} }
	}
}

#[component]
pub fn SidebarSeparator(#[props(default)] class: String) -> Element {
	let cls = cn!(SIDEBAR_SEPARATOR, class);
	rsx! {
		div { role: "separator", class: cls, "data-slot": "sidebar-separator", "data-sidebar": "separator" }
	}
}

#[component]
pub fn SidebarContent(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(SIDEBAR_CONTENT, class);
	rsx! {
		div { class: cls, "data-slot": "sidebar-content", "data-sidebar": "content", {children} }
	}
}

#[component]
pub fn SidebarGroup(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(SIDEBAR_GROUP, class);
	rsx! {
		div { class: cls, "data-slot": "sidebar-group", "data-sidebar": "group", {children} }
	}
}

#[component]
pub fn SidebarGroupLabel(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(SIDEBAR_GROUP_LABEL, class);
	rsx! {
		div { class: cls, "data-slot": "sidebar-group-label", "data-sidebar": "group-label", {children} }
	}
}

#[component]
pub fn SidebarGroupContent(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(SIDEBAR_GROUP_CONTENT, class);
	rsx! {
		div { class: cls, "data-slot": "sidebar-group-content", "data-sidebar": "group-content", {children} }
	}
}

#[component]
pub fn SidebarMenu(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(SIDEBAR_MENU, class);
	rsx! {
		ul { class: cls, "data-slot": "sidebar-menu", "data-sidebar": "menu", {children} }
	}
}

#[component]
pub fn SidebarMenuItem(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(SIDEBAR_MENU_ITEM, class);
	rsx! {
		li { class: cls, "data-slot": "sidebar-menu-item", "data-sidebar": "menu-item", {children} }
	}
}

/// A menu entry: runs `onclick` — the consumer's navigation or action.
///
/// The TS port reaches an `<a>` through `asChild`; this port has no `Slot`, so
/// route from the handler (`navigator().push(..)`) rather than nesting a `Link`,
/// which would put an `<a>` inside this `<button>`.
#[component]
pub fn SidebarMenuButton(
	#[props(default)] variant: SidebarMenuButtonVariant,
	#[props(default)] size: SidebarMenuButtonSize,
	#[props(default)] is_active: bool,
	onclick: Option<EventHandler<MouseEvent>>,
	#[props(default)] class: String,
	children: Element,
) -> Element {
	let cls = cn!(SIDEBAR_MENU_BUTTON_BASE, variant.as_class(), size.as_class(), class);
	rsx! {
		button {
			r#type: "button",
			"data-slot": "sidebar-menu-button",
			"data-sidebar": "menu-button",
			"data-size": size.as_ref(),
			"data-active": is_active,
			class: cls,
			onclick: move |e| {
				if let Some(h) = onclick {
					h.call(e);
				}
			},
			{children}
		}
	}
}

#[cfg(test)]
mod tests {
	use std::sync::atomic::{AtomicUsize, Ordering};

	use super::*;
	use crate::uikit::test_util::{click_every_element, render};

	#[test]
	fn provider_seeds_expanded_state_and_width_vars() {
		fn app() -> Element {
			rsx! {
				SidebarProvider { Sidebar { "body" } }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"sidebar-wrapper\""), "{html}");
		assert!(html.contains("--sidebar-width"), "{html}");
		assert!(html.contains("data-state=\"expanded\""), "{html}");
		assert!(html.contains("data-slot=\"sidebar\""), "{html}");
		assert!(html.contains("body"));
	}

	#[test]
	fn controlled_closed_reports_collapsed() {
		fn app() -> Element {
			rsx! {
				SidebarProvider { open: false, Sidebar { "x" } }
			}
		}
		let html = render(app);
		assert!(html.contains("data-state=\"collapsed\""), "{html}");
		assert!(html.contains("data-collapsible=\"offcanvas\""), "{html}");
	}

	#[test]
	fn trigger_renders_slot_and_sr_label() {
		fn app() -> Element {
			rsx! {
				SidebarProvider { SidebarTrigger {} }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"sidebar-trigger\""), "{html}");
		assert!(html.contains("Toggle Sidebar"), "{html}");
	}

	#[test]
	fn menu_button_carries_variant_size_and_active() {
		fn app() -> Element {
			rsx! {
				SidebarProvider {
					SidebarMenuButton {
						variant: SidebarMenuButtonVariant::Outline,
						size: SidebarMenuButtonSize::Lg,
						is_active: true,
						"go"
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"sidebar-menu-button\""), "{html}");
		assert!(html.contains("data-size=\"lg\""), "{html}");
		assert!(html.contains("data-active=true"), "{html}");
		assert!(html.contains("h-12"), "{html}");
	}

	#[test]
	fn menu_button_runs_the_consumer_handler() {
		static CLICKED: AtomicUsize = AtomicUsize::new(0);

		fn app() -> Element {
			rsx! {
				SidebarProvider {
					SidebarMenu {
						SidebarMenuItem {
							SidebarMenuButton {
								onclick: move |_| {
									CLICKED.fetch_add(1, Ordering::SeqCst);
								},
								"Portfolio"
							}
						}
					}
				}
			}
		}
		click_every_element(app);
		assert_eq!(CLICKED.load(Ordering::SeqCst), 1, "the handler must run when the menu button is clicked");
	}

	#[test]
	fn collapsible_none_renders_flat_container() {
		fn app() -> Element {
			rsx! {
				SidebarProvider {
					Sidebar { collapsible: SidebarCollapsible::None, "y" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("w-(--sidebar-width)"), "{html}");
		assert!(!html.contains("data-state"), "flat container has no data-state: {html}");
	}
}
