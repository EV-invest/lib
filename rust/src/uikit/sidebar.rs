use dioxus::prelude::*;

use crate::{
	cn,
	uikit::primitives::{Controllable, use_controllable},
};

// omitted: mobile sheet, cookie, kbd shortcut — see README Limitations

const SIDEBAR_WIDTH: &str = "16rem";
const SIDEBAR_WIDTH_ICON: &str = "3rem";

const SIDEBAR_MENU_BUTTON_BASE: &str = "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm \
                                        outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent \
                                        hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent \
                                        active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 \
                                        group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none \
                                        aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium \
                                        data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent \
                                        data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! \
                                        group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0";
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
	let cls = cn!("group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full", class);
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
		let cls = cn!("bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col", class);
		return rsx! {
			div { class: cls, "data-slot": "sidebar", {children} }
		};
	}

	let state = ctx.state();
	let data_collapsible = if state == "collapsed" { collapsible.as_ref() } else { "" };
	let inner = cn!(
		"bg-sidebar group-data-[variant=floating]:border-sidebar-border flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm",
		class
	);
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
	let cls = cn!("inline-flex size-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground", class);
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
	let cls = cn!(
		"hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex",
		class
	);
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
	let cls = cn!(
		"bg-background relative flex w-full flex-1 flex-col md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
		class
	);
	rsx! {
		main { class: cls, "data-slot": "sidebar-inset", {children} }
	}
}

#[component]
pub fn SidebarHeader(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("flex flex-col gap-2 p-2", class);
	rsx! {
		div { class: cls, "data-slot": "sidebar-header", "data-sidebar": "header", {children} }
	}
}

#[component]
pub fn SidebarFooter(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("flex flex-col gap-2 p-2", class);
	rsx! {
		div { class: cls, "data-slot": "sidebar-footer", "data-sidebar": "footer", {children} }
	}
}

#[component]
pub fn SidebarSeparator(#[props(default)] class: String) -> Element {
	let cls = cn!("bg-sidebar-border mx-2 h-px w-auto shrink-0", class);
	rsx! {
		div { role: "separator", class: cls, "data-slot": "sidebar-separator", "data-sidebar": "separator" }
	}
}

#[component]
pub fn SidebarContent(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden", class);
	rsx! {
		div { class: cls, "data-slot": "sidebar-content", "data-sidebar": "content", {children} }
	}
}

#[component]
pub fn SidebarGroup(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("relative flex w-full min-w-0 flex-col p-2", class);
	rsx! {
		div { class: cls, "data-slot": "sidebar-group", "data-sidebar": "group", {children} }
	}
}

#[component]
pub fn SidebarGroupLabel(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(
		"text-sidebar-foreground/70 ring-sidebar-ring flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0 group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
		class
	);
	rsx! {
		div { class: cls, "data-slot": "sidebar-group-label", "data-sidebar": "group-label", {children} }
	}
}

#[component]
pub fn SidebarGroupContent(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("w-full text-sm", class);
	rsx! {
		div { class: cls, "data-slot": "sidebar-group-content", "data-sidebar": "group-content", {children} }
	}
}

#[component]
pub fn SidebarMenu(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("flex w-full min-w-0 flex-col gap-1", class);
	rsx! {
		ul { class: cls, "data-slot": "sidebar-menu", "data-sidebar": "menu", {children} }
	}
}

#[component]
pub fn SidebarMenuItem(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("group/menu-item relative", class);
	rsx! {
		li { class: cls, "data-slot": "sidebar-menu-item", "data-sidebar": "menu-item", {children} }
	}
}

#[derive(Clone, Default, PartialEq)]
pub enum SidebarMenuButtonVariant {
	#[default]
	Default,
	Outline,
}

impl SidebarMenuButtonVariant {
	fn class(&self) -> &'static str {
		match self {
			SidebarMenuButtonVariant::Default => "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
			SidebarMenuButtonVariant::Outline =>
				"bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
		}
	}
}

#[derive(strum::AsRefStr, Clone, Default, PartialEq)]
#[strum(serialize_all = "kebab-case")]
pub enum SidebarMenuButtonSize {
	#[default]
	Default,
	Sm,
	Lg,
}

impl SidebarMenuButtonSize {
	fn class(&self) -> &'static str {
		match self {
			SidebarMenuButtonSize::Default => "h-8 text-sm",
			SidebarMenuButtonSize::Sm => "h-7 text-xs",
			SidebarMenuButtonSize::Lg => "h-12 text-sm group-data-[collapsible=icon]:p-0!",
		}
	}
}

#[component]
pub fn SidebarMenuButton(
	#[props(default)] variant: SidebarMenuButtonVariant,
	#[props(default)] size: SidebarMenuButtonSize,
	#[props(default)] is_active: bool,
	#[props(default)] class: String,
	children: Element,
) -> Element {
	let cls = cn!(SIDEBAR_MENU_BUTTON_BASE, variant.class(), size.class(), class);
	rsx! {
		button {
			r#type: "button",
			"data-slot": "sidebar-menu-button",
			"data-sidebar": "menu-button",
			"data-size": size.as_ref(),
			"data-active": is_active,
			class: cls,
			{children}
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

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
