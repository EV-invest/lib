use dioxus::prelude::*;

use crate::{
	cn,
	uikit::primitives::{Controllable, use_controllable},
};

// dep-light: inline positioning + backdrop; no portal/floating/drag — see README Limitations

/// Trigger size; `Sm` mirrors the landing `size="sm"` variant.
#[derive(Clone, Copy, Default, PartialEq)]
pub enum SelectTriggerSize {
	#[default]
	Default,
	Sm,
}

impl SelectTriggerSize {
	fn as_str(&self) -> &'static str {
		match self {
			SelectTriggerSize::Default => "default",
			SelectTriggerSize::Sm => "sm",
		}
	}
}

#[component]
pub fn Select(
	value: Option<String>,
	#[props(default)] default_value: String,
	on_value_change: Option<EventHandler<String>>,
	open: Option<bool>,
	#[props(default)] default_open: bool,
	on_open_change: Option<EventHandler<bool>>,
	#[props(default)] class: String,
	children: Element,
) -> Element {
	let value = use_controllable(value, default_value, on_value_change);
	let open = use_controllable(open, default_open, on_open_change);
	use_context_provider(|| SelectCtx { value, open });
	let cls = cn!("relative", class);
	rsx! {
		div { class: cls, "data-slot": "select", {children} }
	}
}
#[component]
pub fn SelectTrigger(#[props(default)] size: SelectTriggerSize, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<SelectCtx>();
	let open = ctx.open.get();
	let data_state = if open { "open" } else { "closed" };
	let cls = cn!(
		"border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground \
		 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive \
		 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs \
		 transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 \
		 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex \
		 *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 \
		 [&_svg:not([class*='size-'])]:size-4",
		class
	);
	rsx! {
		button {
			r#type: "button",
			role: "combobox",
			class: cls,
			"data-slot": "select-trigger",
			"data-size": size.as_str(),
			"data-state": data_state,
			"aria-expanded": if open { "true" } else { "false" },
			onclick: move |_| ctx.open.set(!ctx.open.get()),
			{children}
			svg {
				xmlns: "http://www.w3.org/2000/svg",
				width: "24",
				height: "24",
				view_box: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				stroke_width: "2",
				stroke_linecap: "round",
				stroke_linejoin: "round",
				class: "size-4 opacity-50",
				path { d: "m6 9 6 6 6-6" }
			}
		}
	}
}
#[component]
pub fn SelectValue(#[props(default)] placeholder: String, #[props(default)] class: String) -> Element {
	let ctx = use_context::<SelectCtx>();
	let value = ctx.value.get();
	let is_empty = value.is_empty();
	let label = if is_empty { placeholder } else { value };
	rsx! {
		span {
			class,
			"data-slot": "select-value",
			"data-placeholder": if is_empty { Some("true") } else { None },
			{label}
		}
	}
}
#[component]
pub fn SelectContent(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<SelectCtx>();
	if !ctx.open.get() {
		return rsx! {};
	}
	let cls = cn!(
		"bg-popover text-popover-foreground relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] \
		 origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md",
		class
	);
	rsx! {
		div {
			class: "fixed inset-0 z-40",
			onclick: move |_| ctx.open.set(false),
		}
		div {
			role: "listbox",
			class: cls,
			"data-slot": "select-content",
			"data-state": "open",
			tabindex: "-1",
			onkeydown: move |e| {
				if e.key() == Key::Escape {
					ctx.open.set(false);
				}
			},
			div { class: "p-1", {children} }
		}
	}
}
#[component]
pub fn SelectItem(value: String, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<SelectCtx>();
	let selected = ctx.value.get() == value;
	let cls = cn!(
		"focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full \
		 cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none \
		 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 \
		 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
		class
	);
	let select_value = {
		let value = value.clone();
		move |_| {
			ctx.value.set(value.clone());
			ctx.open.set(false);
		}
	};
	rsx! {
		div {
			role: "option",
			class: cls,
			"data-slot": "select-item",
			"aria-selected": if selected { "true" } else { "false" },
			tabindex: "-1",
			onclick: select_value,
			if selected {
				span { class: "absolute right-2 flex size-3.5 items-center justify-center",
					svg {
						xmlns: "http://www.w3.org/2000/svg",
						width: "24",
						height: "24",
						view_box: "0 0 24 24",
						fill: "none",
						stroke: "currentColor",
						stroke_width: "2",
						stroke_linecap: "round",
						stroke_linejoin: "round",
						class: "size-4",
						path { d: "M20 6 9 17l-5-5" }
					}
				}
			}
			span { {children} }
		}
	}
}
#[component]
pub fn SelectGroup(#[props(default)] class: String, children: Element) -> Element {
	rsx! {
		div { role: "group", class, "data-slot": "select-group", {children} }
	}
}
#[component]
pub fn SelectLabel(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("text-muted-foreground px-2 py-1.5 text-xs", class);
	rsx! {
		div { class: cls, "data-slot": "select-label", {children} }
	}
}
#[component]
pub fn SelectSeparator(#[props(default)] class: String) -> Element {
	let cls = cn!("bg-border pointer-events-none -mx-1 my-1 h-px", class);
	rsx! {
		div { class: cls, "data-slot": "select-separator" }
	}
}
#[derive(Clone)]
struct SelectCtx {
	value: Controllable<String>,
	open: Controllable<bool>,
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn closed_hides_content() {
		fn app() -> Element {
			rsx! {
				Select {
					SelectTrigger {
						SelectValue { placeholder: "Pick".to_string() }
					}
					SelectContent {
						SelectItem { value: "a", "Apple" }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("role=\"combobox\""), "{html}");
		assert!(html.contains("Pick"), "placeholder shown: {html}");
		assert!(!html.contains("Apple"), "options hidden while closed: {html}");
	}

	#[test]
	fn open_shows_listbox_and_options() {
		fn app() -> Element {
			rsx! {
				Select { default_open: true,
					SelectTrigger {
						SelectValue { placeholder: "Pick".to_string() }
					}
					SelectContent {
						SelectItem { value: "a", "Apple" }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("role=\"listbox\""), "{html}");
		assert!(html.contains("role=\"option\""), "{html}");
		assert!(html.contains("Apple"), "{html}");
	}

	#[test]
	fn selected_value_replaces_placeholder() {
		fn app() -> Element {
			rsx! {
				Select { default_value: "a".to_string(), default_open: true,
					SelectTrigger {
						SelectValue { placeholder: "Pick".to_string() }
					}
					SelectContent {
						SelectItem { value: "a", "Apple" }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("aria-selected=\"true\""), "{html}");
		assert!(!html.contains("data-placeholder"), "value replaces placeholder: {html}");
	}

	#[test]
	fn trigger_size_sm() {
		fn app() -> Element {
			rsx! {
				Select {
					SelectTrigger { size: SelectTriggerSize::Sm, "x" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-size=\"sm\""), "{html}");
	}
}
