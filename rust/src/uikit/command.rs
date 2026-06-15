use dioxus::prelude::*;

use crate::{
	cn,
	uikit::primitives::{Controllable, use_controllable},
};

// dep-light: inline positioning + backdrop; no portal/floating/drag — see README Limitations

#[component]
pub fn Command(
	search: Option<String>,
	#[props(default)] default_search: String,
	on_search_change: Option<EventHandler<String>>,
	#[props(default)] class: String,
	children: Element,
) -> Element {
	let search = use_controllable(search, default_search, on_search_change);
	use_context_provider(|| CommandCtx { search });
	let cls = cn!("bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md", class);
	rsx! {
		div { class: cls, "data-slot": "command", {children} }
	}
}
#[component]
pub fn CommandDialog(open: Option<bool>, #[props(default)] default_open: bool, on_open_change: Option<EventHandler<bool>>, #[props(default)] class: String, children: Element) -> Element {
	let open = use_controllable(open, default_open, on_open_change);
	if !open.get() {
		return rsx! {};
	}
	rsx! {
		div {
			class: "fixed inset-0 z-50 bg-black/50",
			onclick: move |_| open.set(false),
		}
		div {
			role: "dialog",
			class: "fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border p-0 shadow-lg",
			"data-slot": "command-dialog",
			onkeydown: move |e| {
				if e.key() == Key::Escape {
					open.set(false);
				}
			},
			Command { class: "[&_[data-slot=command-input-wrapper]]:h-12 [&_[data-slot=command-input]]:h-12",
				{children}
			}
		}
	}
}
#[component]
pub fn CommandInput(#[props(default)] placeholder: String, #[props(default)] class: String) -> Element {
	let ctx = use_context::<CommandCtx>();
	let value = ctx.search.get();
	let cls = cn!(
		"placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
		class
	);
	rsx! {
		div {
			class: "flex h-9 items-center gap-2 border-b px-3",
			"data-slot": "command-input-wrapper",
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
				class: "size-4 shrink-0 opacity-50",
				circle { cx: "11", cy: "11", r: "8" }
				path { d: "m21 21-4.3-4.3" }
			}
			input {
				r#type: "text",
				role: "combobox",
				class: cls,
				"data-slot": "command-input",
				placeholder,
				value,
				oninput: move |e| ctx.search.set(e.value()),
			}
		}
	}
}
#[component]
pub fn CommandList(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto", class);
	rsx! {
		div { role: "listbox", class: cls, "data-slot": "command-list", {children} }
	}
}
#[component]
pub fn CommandEmpty(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("py-6 text-center text-sm", class);
	rsx! {
		div { class: cls, "data-slot": "command-empty", {children} }
	}
}
#[component]
pub fn CommandGroup(#[props(default)] heading: String, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(
		"text-foreground [&_[data-slot=command-group-heading]]:text-muted-foreground overflow-hidden p-1 [&_[data-slot=command-group-heading]]:px-2 [&_[data-slot=command-group-heading]]:py-1.5 [&_[data-slot=command-group-heading]]:text-xs [&_[data-slot=command-group-heading]]:font-medium",
		class
	);
	rsx! {
		div { role: "group", class: cls, "data-slot": "command-group",
			if !heading.is_empty() {
				div { "data-slot": "command-group-heading", {heading} }
			}
			{children}
		}
	}
}
/// Filters by case-insensitive substring of `value` against the parent
/// `Command` search text; non-matching items render nothing.
#[component]
pub fn CommandItem(value: String, #[props(default)] disabled: bool, on_select: Option<EventHandler<String>>, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<CommandCtx>();
	let search = ctx.search.get().to_lowercase();
	if !search.is_empty() && !value.to_lowercase().contains(&search) {
		return rsx! {};
	}
	let cls = cn!(
		"data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
		class
	);
	let select = {
		let value = value.clone();
		move |_| {
			if !disabled && let Some(h) = &on_select {
				h.call(value.clone());
			}
		}
	};
	rsx! {
		div {
			role: "option",
			class: cls,
			"data-slot": "command-item",
			"data-disabled": if disabled { "true" } else { "false" },
			tabindex: "-1",
			onclick: select,
			{children}
		}
	}
}
#[component]
pub fn CommandSeparator(#[props(default)] class: String) -> Element {
	let cls = cn!("bg-border -mx-1 h-px", class);
	rsx! {
		div { class: cls, "data-slot": "command-separator" }
	}
}
#[component]
pub fn CommandShortcut(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("text-muted-foreground ml-auto text-xs tracking-widest", class);
	rsx! {
		span { class: cls, "data-slot": "command-shortcut", {children} }
	}
}
#[derive(Clone)]
struct CommandCtx {
	search: Controllable<String>,
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn renders_all_items_when_empty_search() {
		fn app() -> Element {
			rsx! {
				Command {
					CommandInput { placeholder: "Search".to_string() }
					CommandList {
						CommandItem { value: "Apple", "Apple" }
						CommandItem { value: "Banana", "Banana" }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("role=\"combobox\""), "{html}");
		assert!(html.contains("Apple"), "{html}");
		assert!(html.contains("Banana"), "{html}");
	}

	#[test]
	fn filters_items_by_substring() {
		fn app() -> Element {
			rsx! {
				Command { default_search: "ban".to_string(),
					CommandList {
						CommandItem { value: "Apple", "Apple" }
						CommandItem { value: "Banana", "Banana" }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("Banana"), "match shown: {html}");
		assert!(!html.contains("Apple"), "non-match hidden: {html}");
	}

	#[test]
	fn group_renders_heading() {
		fn app() -> Element {
			rsx! {
				Command {
					CommandList {
						CommandGroup { heading: "Fruit".to_string(),
							CommandItem { value: "Apple", "Apple" }
						}
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"command-group-heading\""), "{html}");
		assert!(html.contains("Fruit"), "{html}");
	}

	#[test]
	fn dialog_hidden_until_open() {
		fn closed() -> Element {
			rsx! {
				CommandDialog {
					CommandInput { placeholder: "Search".to_string() }
				}
			}
		}
		assert!(!render(closed).contains("command-dialog"), "{}", render(closed));

		fn opened() -> Element {
			rsx! {
				CommandDialog { default_open: true,
					CommandInput { placeholder: "Search".to_string() }
				}
			}
		}
		let html = render(opened);
		assert!(html.contains("role=\"dialog\""), "{html}");
	}
}
