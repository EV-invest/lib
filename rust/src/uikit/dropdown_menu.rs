use dioxus::prelude::*;

use crate::{
	cn,
	uikit::primitives::{Controllable, Side, use_controllable},
};

// Canonical menu-surface and item classes, shared by dropdown and context menus.
const CONTENT: &str = "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out \
                       data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 \
                       data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 \
                       data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] \
                       origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md \
                       border p-1 shadow-md";
const SUB_CONTENT: &str = "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out \
                           data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 \
                           data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 \
                           data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] \
                           origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg";
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
                           cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none \
                           data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

/// Default vs destructive item styling; mirrors the TS `variant` union.
#[derive(strum::AsRefStr, Clone, Copy, Default, PartialEq)]
#[strum(serialize_all = "kebab-case")]
pub enum DropdownMenuItemVariant {
	#[default]
	Default,
	Destructive,
}

#[component]
pub fn DropdownMenu(open: Option<bool>, #[props(default)] default_open: bool, on_open_change: Option<EventHandler<bool>>, children: Element) -> Element {
	let state = use_controllable(open, default_open, on_open_change);
	use_context_provider(|| DropdownMenuCtx { open: state });
	rsx! {
		div { class: "relative inline-block", "data-slot": "dropdown-menu", {children} }
	}
}
#[component]
pub fn DropdownMenuTrigger(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<DropdownMenuCtx>();
	let open = ctx.open.get();
	let data_state = if open { "open" } else { "closed" };
	rsx! {
		button {
			r#type: "button",
			class,
			"data-slot": "dropdown-menu-trigger",
			"data-state": data_state,
			"aria-haspopup": "menu",
			"aria-expanded": if open { "true" } else { "false" },
			onclick: move |_| ctx.open.set(!ctx.open.get()),
			{children}
		}
	}
}
#[component]
pub fn DropdownMenuContent(#[props(default)] side: Side, #[props(default)] class: String, children: Element) -> Element {
	// dep-light: inline positioning + backdrop; no portal/floating — see README Limitations
	let ctx = use_context::<DropdownMenuCtx>();
	if !ctx.open.get() {
		return rsx! {};
	}
	let cls = cn!("absolute left-0 mt-1", CONTENT, class);
	rsx! {
		div {
			class: "fixed inset-0 z-40",
			onclick: move |_| ctx.open.set(false),
		}
		div {
			class: cls,
			role: "menu",
			tabindex: "-1",
			"data-slot": "dropdown-menu-content",
			"data-state": "open",
			"data-side": side.as_ref(),
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
pub fn DropdownMenuGroup(#[props(default)] class: String, children: Element) -> Element {
	rsx! {
		div { class, role: "group", "data-slot": "dropdown-menu-group", {children} }
	}
}
#[component]
pub fn DropdownMenuItem(
	#[props(default)] variant: DropdownMenuItemVariant,
	#[props(default)] inset: bool,
	#[props(default)] disabled: bool,
	onclick: Option<EventHandler<MouseEvent>>,
	#[props(default)] class: String,
	children: Element,
) -> Element {
	let ctx = use_context::<DropdownMenuCtx>();
	let cls = cn!(ITEM, class);
	rsx! {
		div {
			class: cls,
			role: "menuitem",
			tabindex: "-1",
			"data-slot": "dropdown-menu-item",
			"data-variant": variant.as_ref(),
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
pub fn DropdownMenuCheckboxItem(
	#[props(default)] checked: bool,
	#[props(default)] disabled: bool,
	onclick: Option<EventHandler<MouseEvent>>,
	#[props(default)] class: String,
	children: Element,
) -> Element {
	let ctx = use_context::<DropdownMenuCtx>();
	let cls = cn!(CHECK_ITEM, class);
	rsx! {
		div {
			class: cls,
			role: "menuitemcheckbox",
			tabindex: "-1",
			"data-slot": "dropdown-menu-checkbox-item",
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
pub fn DropdownMenuRadioGroup(
	value: Option<String>,
	#[props(default)] default_value: String,
	on_value_change: Option<EventHandler<String>>,
	#[props(default)] class: String,
	children: Element,
) -> Element {
	let state = use_controllable(value, default_value, on_value_change);
	use_context_provider(|| DropdownMenuRadioCtx { value: state });
	rsx! {
		div { class, role: "group", "data-slot": "dropdown-menu-radio-group", {children} }
	}
}
#[component]
pub fn DropdownMenuRadioItem(value: String, #[props(default)] disabled: bool, #[props(default)] class: String, children: Element) -> Element {
	let menu = use_context::<DropdownMenuCtx>();
	let radio = use_context::<DropdownMenuRadioCtx>();
	let checked = radio.value.get() == value;
	let cls = cn!(CHECK_ITEM, class);
	rsx! {
		div {
			class: cls,
			role: "menuitemradio",
			tabindex: "-1",
			"data-slot": "dropdown-menu-radio-item",
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
pub fn DropdownMenuLabel(#[props(default)] inset: bool, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("px-2 py-1.5 text-sm font-medium data-[inset]:pl-8", class);
	rsx! {
		div { class: cls, "data-slot": "dropdown-menu-label", "data-inset": inset, {children} }
	}
}
#[component]
pub fn DropdownMenuSeparator(#[props(default)] class: String) -> Element {
	let cls = cn!("bg-border -mx-1 my-1 h-px", class);
	rsx! {
		div { class: cls, role: "separator", "data-slot": "dropdown-menu-separator" }
	}
}
#[component]
pub fn DropdownMenuShortcut(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("text-muted-foreground ml-auto text-xs tracking-widest", class);
	rsx! {
		span { class: cls, "data-slot": "dropdown-menu-shortcut", {children} }
	}
}
/// Sub-menus open inline (nested) rather than in a separate floating layer:
/// the sub-content is revealed in place when its trigger toggles, dropping the
/// nested portal Radix renders per level. Keyboard roving is simplified to the
/// browser's native focus order.
#[component]
pub fn DropdownMenuSub(open: Option<bool>, #[props(default)] default_open: bool, on_open_change: Option<EventHandler<bool>>, children: Element) -> Element {
	let state = use_controllable(open, default_open, on_open_change);
	use_context_provider(|| DropdownMenuSubCtx { open: state });
	rsx! {
		div { "data-slot": "dropdown-menu-sub", {children} }
	}
}
#[component]
pub fn DropdownMenuSubTrigger(#[props(default)] inset: bool, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<DropdownMenuSubCtx>();
	let open = ctx.open.get();
	let cls = cn!(SUB_TRIGGER, class);
	rsx! {
		div {
			class: cls,
			role: "menuitem",
			tabindex: "-1",
			"data-slot": "dropdown-menu-sub-trigger",
			"data-state": if open { "open" } else { "closed" },
			"data-inset": inset,
			"aria-haspopup": "menu",
			"aria-expanded": if open { "true" } else { "false" },
			onclick: move |_| ctx.open.set(!ctx.open.get()),
			{children}
			svg {
				class: "ml-auto size-4",
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
pub fn DropdownMenuSubContent(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<DropdownMenuSubCtx>();
	if !ctx.open.get() {
		return rsx! {};
	}
	let cls = cn!(SUB_CONTENT, class);
	rsx! {
		div { class: cls, role: "menu", "data-slot": "dropdown-menu-sub-content", "data-state": "open", {children} }
	}
}
#[derive(Clone, Copy)]
struct DropdownMenuCtx {
	open: Controllable<bool>,
}
#[derive(Clone, Copy)]
struct DropdownMenuRadioCtx {
	value: Controllable<String>,
}
#[derive(Clone, Copy)]
struct DropdownMenuSubCtx {
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
				DropdownMenu {
					DropdownMenuTrigger { "open" }
					DropdownMenuContent {
						DropdownMenuItem { "Profile" }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"dropdown-menu-trigger\""), "{html}");
		assert!(!html.contains("Profile"), "content hidden while closed: {html}");
	}

	#[test]
	fn default_open_reveals_menu_item() {
		fn app() -> Element {
			rsx! {
				DropdownMenu { default_open: true,
					DropdownMenuTrigger { "open" }
					DropdownMenuContent {
						DropdownMenuItem { "Profile" }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"dropdown-menu-content\""), "{html}");
		assert!(html.contains("role=\"menu\""), "{html}");
		assert!(html.contains("Profile"), "{html}");
		assert!(html.contains("data-state=\"open\""), "{html}");
	}

	#[test]
	fn checkbox_item_renders_check_when_checked() {
		fn app() -> Element {
			rsx! {
				DropdownMenu { default_open: true,
					DropdownMenuContent {
						DropdownMenuCheckboxItem { checked: true, "Show grid" }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("role=\"menuitemcheckbox\""), "{html}");
		assert!(html.contains("M20 6 9 17l-5-5"), "{html}");
		assert!(html.contains("aria-checked=\"true\""), "{html}");
	}
}
