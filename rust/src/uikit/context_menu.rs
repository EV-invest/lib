use dioxus::prelude::*;

use crate::{
	cn,
	uikit::primitives::{Controllable, use_controllable},
};

// Canonical menu-surface and item classes, the context-menu twins of the
// dropdown set (same shape, `--radix-context-menu-*` transform origin).
const CONTENT: &str = "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out \
                       data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 \
                       data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 \
                       data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] \
                       origin-(--radix-context-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md \
                       border p-1 shadow-md";
const SUB_CONTENT: &str = "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out \
                           data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 \
                           data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 \
                           data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] \
                           origin-(--radix-context-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg";
const ITEM: &str = "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive \
                    data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive \
                    data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground \
                    relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none \
                    data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none \
                    [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
const CHECK_ITEM: &str = "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm \
                          py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none \
                          data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
const SUB_TRIGGER: &str = "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent \
                           data-[state=open]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground flex \
                           cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none \
                           data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

/// Default vs destructive item styling; mirrors the TS `variant` union.
#[derive(Clone, Copy, Default, PartialEq)]
pub enum ContextMenuItemVariant {
	#[default]
	Default,
	Destructive,
}

impl ContextMenuItemVariant {
	fn as_str(&self) -> &'static str {
		match self {
			ContextMenuItemVariant::Default => "default",
			ContextMenuItemVariant::Destructive => "destructive",
		}
	}
}

#[component]
pub fn ContextMenu(open: Option<bool>, #[props(default)] default_open: bool, on_open_change: Option<EventHandler<bool>>, children: Element) -> Element {
	let state = use_controllable(open, default_open, on_open_change);
	let point = use_signal(|| (0, 0));
	use_context_provider(|| ContextMenuCtx { open: state, point });
	rsx! {
		div { "data-slot": "context-menu", {children} }
	}
}
#[component]
pub fn ContextMenuTrigger(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<ContextMenuCtx>();
	let mut point = ctx.point;
	rsx! {
		div {
			class,
			"data-slot": "context-menu-trigger",
			oncontextmenu: move |e| {
				e.prevent_default();
				let c = e.client_coordinates();
				point.set((c.x as i32, c.y as i32));
				ctx.open.set(true);
			},
			{children}
		}
	}
}
#[component]
pub fn ContextMenuContent(#[props(default)] class: String, children: Element) -> Element {
	// dep-light: fixed coords from the contextmenu event + backdrop; no portal/floating — see README Limitations
	let ctx = use_context::<ContextMenuCtx>();
	if !ctx.open.get() {
		return rsx! {};
	}
	let (x, y) = *ctx.point.read();
	let cls = cn!(CONTENT, class);
	rsx! {
		div {
			class: "fixed inset-0 z-40",
			onclick: move |_| ctx.open.set(false),
		}
		div {
			class: cls,
			role: "menu",
			tabindex: "-1",
			style: "position: fixed; left: {x}px; top: {y}px;",
			"data-slot": "context-menu-content",
			"data-state": "open",
			"data-side": "bottom",
			onkeydown: move |e| {
				if e.key() == Key::Escape {
					ctx.open.set(false);
				}
			},
			{children}
		}
	}
}
#[component]
pub fn ContextMenuGroup(#[props(default)] class: String, children: Element) -> Element {
	rsx! {
		div { class, role: "group", "data-slot": "context-menu-group", {children} }
	}
}
#[component]
pub fn ContextMenuItem(
	#[props(default)] variant: ContextMenuItemVariant,
	#[props(default)] inset: bool,
	#[props(default)] disabled: bool,
	onclick: Option<EventHandler<MouseEvent>>,
	#[props(default)] class: String,
	children: Element,
) -> Element {
	let ctx = use_context::<ContextMenuCtx>();
	let cls = cn!(ITEM, class);
	rsx! {
		div {
			class: cls,
			role: "menuitem",
			tabindex: "-1",
			"data-slot": "context-menu-item",
			"data-variant": variant.as_str(),
			"data-inset": inset,
			"data-disabled": disabled,
			onclick: move |e| {
				if disabled {
					return;
				}
				if let Some(h) = onclick {
					h.call(e);
				}
				ctx.open.set(false);
			},
			{children}
		}
	}
}
#[component]
pub fn ContextMenuCheckboxItem(
	#[props(default)] checked: bool,
	#[props(default)] disabled: bool,
	onclick: Option<EventHandler<MouseEvent>>,
	#[props(default)] class: String,
	children: Element,
) -> Element {
	let ctx = use_context::<ContextMenuCtx>();
	let cls = cn!(CHECK_ITEM, class);
	rsx! {
		div {
			class: cls,
			role: "menuitemcheckbox",
			tabindex: "-1",
			"data-slot": "context-menu-checkbox-item",
			"data-state": if checked { "checked" } else { "unchecked" },
			"data-disabled": disabled,
			"aria-checked": if checked { "true" } else { "false" },
			onclick: move |e| {
				if disabled {
					return;
				}
				if let Some(h) = onclick {
					h.call(e);
				}
				ctx.open.set(false);
			},
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
						"aria-hidden": "true",
						path { d: "M20 6 9 17l-5-5" }
					}
				}
			}
			{children}
		}
	}
}
#[component]
pub fn ContextMenuRadioGroup(
	value: Option<String>,
	#[props(default)] default_value: String,
	on_value_change: Option<EventHandler<String>>,
	#[props(default)] class: String,
	children: Element,
) -> Element {
	let state = use_controllable(value, default_value, on_value_change);
	use_context_provider(|| ContextMenuRadioCtx { value: state });
	rsx! {
		div { class, role: "group", "data-slot": "context-menu-radio-group", {children} }
	}
}
#[component]
pub fn ContextMenuRadioItem(value: String, #[props(default)] disabled: bool, #[props(default)] class: String, children: Element) -> Element {
	let menu = use_context::<ContextMenuCtx>();
	let radio = use_context::<ContextMenuRadioCtx>();
	let checked = radio.value.get() == value;
	let cls = cn!(CHECK_ITEM, class);
	rsx! {
		div {
			class: cls,
			role: "menuitemradio",
			tabindex: "-1",
			"data-slot": "context-menu-radio-item",
			"data-state": if checked { "checked" } else { "unchecked" },
			"data-disabled": disabled,
			"aria-checked": if checked { "true" } else { "false" },
			onclick: move |_| {
				if disabled {
					return;
				}
				radio.value.set(value.clone());
				menu.open.set(false);
			},
			span { class: "pointer-events-none absolute left-2 flex size-3.5 items-center justify-center",
				if checked {
					svg { class: "size-2 fill-current", view_box: "0 0 24 24", "aria-hidden": "true",
						circle { cx: "12", cy: "12", r: "10" }
					}
				}
			}
			{children}
		}
	}
}
#[component]
pub fn ContextMenuLabel(#[props(default)] inset: bool, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("text-foreground px-2 py-1.5 text-sm font-medium data-[inset]:pl-8", class);
	rsx! {
		div { class: cls, "data-slot": "context-menu-label", "data-inset": inset, {children} }
	}
}
#[component]
pub fn ContextMenuSeparator(#[props(default)] class: String) -> Element {
	let cls = cn!("bg-border -mx-1 my-1 h-px", class);
	rsx! {
		div { class: cls, role: "separator", "data-slot": "context-menu-separator" }
	}
}
#[component]
pub fn ContextMenuShortcut(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("text-muted-foreground ml-auto text-xs tracking-widest", class);
	rsx! {
		span { class: cls, "data-slot": "context-menu-shortcut", {children} }
	}
}
/// Sub-menus open inline (nested) rather than in a separate floating layer; the
/// sub-content is revealed in place when its trigger toggles. Keyboard roving is
/// simplified to the browser's native focus order.
#[component]
pub fn ContextMenuSub(open: Option<bool>, #[props(default)] default_open: bool, on_open_change: Option<EventHandler<bool>>, children: Element) -> Element {
	let state = use_controllable(open, default_open, on_open_change);
	use_context_provider(|| ContextMenuSubCtx { open: state });
	rsx! {
		div { "data-slot": "context-menu-sub", {children} }
	}
}
#[component]
pub fn ContextMenuSubTrigger(#[props(default)] inset: bool, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<ContextMenuSubCtx>();
	let open = ctx.open.get();
	let cls = cn!(SUB_TRIGGER, class);
	rsx! {
		div {
			class: cls,
			role: "menuitem",
			tabindex: "-1",
			"data-slot": "context-menu-sub-trigger",
			"data-state": if open { "open" } else { "closed" },
			"data-inset": inset,
			"aria-haspopup": "menu",
			"aria-expanded": if open { "true" } else { "false" },
			onclick: move |_| ctx.open.set(!ctx.open.get()),
			{children}
			svg {
				class: "ml-auto",
				view_box: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				stroke_width: "2",
				stroke_linecap: "round",
				stroke_linejoin: "round",
				"aria-hidden": "true",
				path { d: "m9 18 6-6-6-6" }
			}
		}
	}
}
#[component]
pub fn ContextMenuSubContent(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<ContextMenuSubCtx>();
	if !ctx.open.get() {
		return rsx! {};
	}
	let cls = cn!(SUB_CONTENT, class);
	rsx! {
		div { class: cls, role: "menu", "data-slot": "context-menu-sub-content", "data-state": "open", {children} }
	}
}
#[derive(Clone, Copy)]
struct ContextMenuCtx {
	open: Controllable<bool>,
	point: Signal<(i32, i32)>,
}
#[derive(Clone, Copy)]
struct ContextMenuRadioCtx {
	value: Controllable<String>,
}
#[derive(Clone, Copy)]
struct ContextMenuSubCtx {
	open: Controllable<bool>,
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn closed_by_default_hides_content() {
		fn app() -> Element {
			rsx! {
				ContextMenu {
					ContextMenuTrigger { "area" }
					ContextMenuContent {
						ContextMenuItem { "Back" }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"context-menu-trigger\""), "{html}");
		assert!(!html.contains("Back"), "content hidden while closed: {html}");
	}

	#[test]
	fn default_open_reveals_menu_item() {
		fn app() -> Element {
			rsx! {
				ContextMenu { default_open: true,
					ContextMenuTrigger { "area" }
					ContextMenuContent {
						ContextMenuItem { "Back" }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"context-menu-content\""), "{html}");
		assert!(html.contains("role=\"menu\""), "{html}");
		assert!(html.contains("Back"), "{html}");
		assert!(html.contains("data-state=\"open\""), "{html}");
	}

	#[test]
	fn radio_item_marks_selected_value() {
		fn app() -> Element {
			rsx! {
				ContextMenu { default_open: true,
					ContextMenuContent {
						ContextMenuRadioGroup { default_value: "a".to_string(),
							ContextMenuRadioItem { value: "a", "Apple" }
							ContextMenuRadioItem { value: "b", "Banana" }
						}
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("role=\"menuitemradio\""), "{html}");
		assert!(html.contains("aria-checked=\"true\""), "{html}");
	}
}
