use dioxus::prelude::*;

use crate::{
	cn,
	uikit::primitives::{Controllable, use_controllable},
};

const MENUBAR: &str = "bg-background flex h-9 items-center gap-1 rounded-md border p-1 shadow-xs";
const TRIGGER: &str = "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent \
                       data-[state=open]:text-accent-foreground flex items-center rounded-sm px-2 py-1 text-sm \
                       font-medium outline-hidden select-none";
const CONTENT: &str = "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:fade-out-0 \
                       data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 \
                       data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 \
                       data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 absolute z-50 \
                       min-w-[12rem] overflow-hidden rounded-md border p-1 shadow-md";
const ITEM: &str = "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive \
                    data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive \
                    data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground \
                    relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden \
                    select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 \
                    [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
const CHECKBOX_ITEM: &str = "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 \
                             rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none \
                             data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none \
                             [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
const RADIO_ITEM: &str = "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 \
                          rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none \
                          data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none \
                          [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
const LABEL: &str = "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8";
const SEPARATOR: &str = "bg-border -mx-1 my-1 h-px";
const SHORTCUT: &str = "text-muted-foreground ml-auto text-xs tracking-widest";
const SUB_TRIGGER: &str = "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent \
                           data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 \
                           text-sm outline-none select-none data-[inset]:pl-8";
const SUB_CONTENT: &str = "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out \
                           data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 \
                           data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 \
                           data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 \
                           data-[side=top]:slide-in-from-bottom-2 absolute z-50 min-w-[8rem] overflow-hidden rounded-md \
                           border p-1 shadow-lg";

/// Item visual tone — the canonical superset mirrors the TS `variant` prop.
#[derive(Clone, Default, PartialEq)]
pub enum MenubarItemVariant {
	#[default]
	Default,
	Destructive,
}

impl MenubarItemVariant {
	fn as_str(&self) -> &'static str {
		match self {
			MenubarItemVariant::Default => "default",
			MenubarItemVariant::Destructive => "destructive",
		}
	}
}

#[component]
pub fn Menubar(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(MENUBAR, class);
	rsx! {
		div { class: cls, "data-slot": "menubar", role: "menubar", {children} }
	}
}

/// One menu in the bar. Owns its open state (the mirror of Radix's per-menu
/// root) and exposes it to its trigger/content via context.
#[component]
pub fn MenubarMenu(open: Option<bool>, #[props(default)] default_open: bool, on_open_change: Option<EventHandler<bool>>, children: Element) -> Element {
	let state = use_controllable(open, default_open, on_open_change);
	use_context_provider(|| MenubarMenuCtx { open: state });
	// dep-light: inline positioning + backdrop; no portal/floating — see README Limitations
	rsx! {
		div { class: "relative", "data-slot": "menubar-menu", {children} }
	}
}

#[component]
pub fn MenubarTrigger(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<MenubarMenuCtx>();
	let open = ctx.open.get();
	let cls = cn!(TRIGGER, class);
	rsx! {
		button {
			r#type: "button",
			class: cls,
			"data-slot": "menubar-trigger",
			"data-state": if open { "open" } else { "closed" },
			onclick: move |_| ctx.open.set(!ctx.open.get()),
			{children}
		}
	}
}

#[component]
pub fn MenubarContent(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<MenubarMenuCtx>();
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
			"data-slot": "menubar-content",
			"data-state": "open",
			role: "menu",
			onkeydown: move |e| if e.key() == Key::Escape { ctx.open.set(false); },
			{children}
		}
	}
}

#[component]
pub fn MenubarGroup(#[props(default)] class: String, children: Element) -> Element {
	rsx! {
		div { class, "data-slot": "menubar-group", role: "group", {children} }
	}
}

#[component]
pub fn MenubarItem(
	#[props(default)] inset: bool,
	#[props(default)] variant: MenubarItemVariant,
	#[props(default)] class: String,
	onclick: Option<EventHandler<MouseEvent>>,
	children: Element,
) -> Element {
	let cls = cn!(ITEM, class);
	rsx! {
		div {
			class: cls,
			"data-slot": "menubar-item",
			"data-inset": inset,
			"data-variant": variant.as_str(),
			role: "menuitem",
			onclick: move |e| { if let Some(h) = onclick { h.call(e); } },
			{children}
		}
	}
}

#[component]
pub fn MenubarCheckboxItem(#[props(default)] checked: bool, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(CHECKBOX_ITEM, class);
	rsx! {
		div {
			class: cls,
			"data-slot": "menubar-checkbox-item",
			role: "menuitemcheckbox",
			"aria-checked": checked,
			span { class: "pointer-events-none absolute left-2 flex size-3.5 items-center justify-center",
				if checked {
					svg {
						class: "size-4",
						view_box: "0 0 24 24",
						fill: "none",
						stroke: "currentColor",
						stroke_width: "2",
						stroke_linecap: "round",
						stroke_linejoin: "round",
						path { d: "M20 6 9 17l-5-5" }
					}
				}
			}
			{children}
		}
	}
}

/// Wraps a set of [`MenubarRadioItem`]s and publishes the selected value via
/// context, mirroring the TS radio-group state.
#[component]
pub fn MenubarRadioGroup(
	value: Option<String>,
	#[props(default)] default_value: String,
	on_value_change: Option<EventHandler<String>>,
	#[props(default)] class: String,
	children: Element,
) -> Element {
	let state = use_controllable(value, default_value, on_value_change);
	use_context_provider(|| MenubarRadioCtx { value: state });
	rsx! {
		div { class, "data-slot": "menubar-radio-group", role: "group", {children} }
	}
}

#[component]
pub fn MenubarRadioItem(value: String, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<MenubarRadioCtx>();
	let checked = ctx.value.get() == value;
	let cls = cn!(RADIO_ITEM, class);
	let select_value = value.clone();
	rsx! {
		div {
			class: cls,
			"data-slot": "menubar-radio-item",
			role: "menuitemradio",
			"aria-checked": checked,
			onclick: move |_| ctx.value.set(select_value.clone()),
			span { class: "pointer-events-none absolute left-2 flex size-3.5 items-center justify-center",
				if checked {
					svg {
						class: "size-2 fill-current",
						view_box: "0 0 24 24",
						circle { cx: "12", cy: "12", r: "10" }
					}
				}
			}
			{children}
		}
	}
}

#[component]
pub fn MenubarLabel(#[props(default)] inset: bool, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(LABEL, class);
	rsx! {
		div { class: cls, "data-slot": "menubar-label", "data-inset": inset, {children} }
	}
}

#[component]
pub fn MenubarSeparator(#[props(default)] class: String) -> Element {
	let cls = cn!(SEPARATOR, class);
	rsx! {
		div { class: cls, "data-slot": "menubar-separator", role: "separator" }
	}
}

#[component]
pub fn MenubarShortcut(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(SHORTCUT, class);
	rsx! {
		span { class: cls, "data-slot": "menubar-shortcut", {children} }
	}
}

/// A nested sub-menu. Owns its own open state; rendered inline beside its
/// trigger (no separate positioning engine — see README Limitations).
#[component]
pub fn MenubarSub(open: Option<bool>, #[props(default)] default_open: bool, on_open_change: Option<EventHandler<bool>>, children: Element) -> Element {
	let state = use_controllable(open, default_open, on_open_change);
	use_context_provider(|| MenubarSubCtx { open: state });
	// dep-light: inline positioning + backdrop; no portal/floating — see README Limitations
	rsx! {
		div { class: "relative", "data-slot": "menubar-sub", {children} }
	}
}

#[component]
pub fn MenubarSubTrigger(#[props(default)] inset: bool, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<MenubarSubCtx>();
	let open = ctx.open.get();
	let cls = cn!(SUB_TRIGGER, class);
	rsx! {
		div {
			class: cls,
			"data-slot": "menubar-sub-trigger",
			"data-inset": inset,
			"data-state": if open { "open" } else { "closed" },
			role: "menuitem",
			onclick: move |_| ctx.open.set(!ctx.open.get()),
			{children}
			svg {
				class: "ml-auto h-4 w-4",
				view_box: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				stroke_width: "2",
				stroke_linecap: "round",
				stroke_linejoin: "round",
				path { d: "m9 18 6-6-6-6" }
			}
		}
	}
}

#[component]
pub fn MenubarSubContent(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<MenubarSubCtx>();
	if !ctx.open.get() {
		return rsx! {};
	}
	let cls = cn!(SUB_CONTENT, class);
	// dep-light: inline positioning + backdrop; no portal/floating — see README Limitations
	rsx! {
		div {
			class: cls,
			"data-slot": "menubar-sub-content",
			"data-state": "open",
			role: "menu",
			onkeydown: move |e| if e.key() == Key::Escape { ctx.open.set(false); },
			{children}
		}
	}
}

#[derive(Clone, Copy)]
struct MenubarMenuCtx {
	open: Controllable<bool>,
}
#[derive(Clone, Copy)]
struct MenubarRadioCtx {
	value: Controllable<String>,
}
#[derive(Clone, Copy)]
struct MenubarSubCtx {
	open: Controllable<bool>,
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn bar_renders_role_and_slot() {
		fn app() -> Element {
			rsx! {
				Menubar {
					MenubarMenu {
						MenubarTrigger { "File" }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("role=\"menubar\""), "{html}");
		assert!(html.contains("data-slot=\"menubar\""), "{html}");
		assert!(html.contains("data-slot=\"menubar-trigger\""), "{html}");
	}

	#[test]
	fn closed_menu_hides_content() {
		fn app() -> Element {
			rsx! {
				Menubar {
					MenubarMenu {
						MenubarTrigger { "File" }
						MenubarContent {
							MenubarItem { "New" }
						}
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-state=\"closed\""), "{html}");
		assert!(!html.contains("data-slot=\"menubar-content\""), "closed content hidden: {html}");
	}

	#[test]
	fn open_menu_shows_content_with_backdrop() {
		fn app() -> Element {
			rsx! {
				Menubar {
					MenubarMenu { default_open: true,
						MenubarTrigger { "File" }
						MenubarContent {
							MenubarItem { "New" }
							MenubarSeparator {}
							MenubarShortcut { "⌘N" }
						}
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-state=\"open\""), "{html}");
		assert!(html.contains("role=\"menu\""), "{html}");
		assert!(html.contains("fixed inset-0 z-40"), "backdrop: {html}");
		assert!(html.contains("data-slot=\"menubar-item\""), "{html}");
		assert!(html.contains("New"), "{html}");
	}

	#[test]
	fn checkbox_item_shows_check_when_checked() {
		fn app() -> Element {
			rsx! {
				Menubar {
					MenubarMenu { default_open: true,
						MenubarTrigger { "View" }
						MenubarContent {
							MenubarCheckboxItem { checked: true, "Status Bar" }
						}
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"menubar-checkbox-item\""), "{html}");
		assert!(html.contains("aria-checked=true"), "{html}");
		assert!(html.contains("M20 6 9 17l-5-5"), "check icon: {html}");
	}

	#[test]
	fn radio_item_marks_selected() {
		fn app() -> Element {
			rsx! {
				Menubar {
					MenubarMenu { default_open: true,
						MenubarTrigger { "Profile" }
						MenubarContent {
							MenubarRadioGroup { default_value: "a",
								MenubarRadioItem { value: "a", "Andy" }
								MenubarRadioItem { value: "b", "Ben" }
							}
						}
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"menubar-radio-item\""), "{html}");
		assert_eq!(html.matches("size-2 fill-current").count(), 1, "one selected: {html}");
	}

	#[test]
	fn sub_trigger_has_chevron_and_inset() {
		fn app() -> Element {
			rsx! {
				Menubar {
					MenubarMenu { default_open: true,
						MenubarTrigger { "File" }
						MenubarContent {
							MenubarSub { default_open: true,
								MenubarSubTrigger { inset: true, "Share" }
								MenubarSubContent {
									MenubarItem { "Email" }
								}
							}
						}
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"menubar-sub-trigger\""), "{html}");
		assert!(html.contains("m9 18 6-6-6-6"), "chevron-right: {html}");
		assert!(html.contains("data-slot=\"menubar-sub-content\""), "{html}");
	}

	#[test]
	fn item_class_override_merges() {
		fn app() -> Element {
			rsx! {
				Menubar {
					MenubarMenu { default_open: true,
						MenubarTrigger { "File" }
						MenubarContent {
							MenubarItem { class: "px-6", "New" }
						}
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("px-6"), "{html}");
		// the item's own base `px-2 py-1.5` is dropped by the override (the bar
		// trigger keeps its independent `px-2`).
		assert!(!html.contains("px-2 py-1.5"), "override should drop item base px-2: {html}");
	}
}
