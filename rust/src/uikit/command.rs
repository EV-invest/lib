use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		COMMAND_DIALOG_COMMAND, COMMAND_DIALOG_CONTENT, COMMAND_DIALOG_OVERLAY, COMMAND_EMPTY, COMMAND_GROUP, COMMAND_INPUT, COMMAND_INPUT_WRAPPER, COMMAND_ITEM, COMMAND_LIST, COMMAND_ROOT,
		COMMAND_SEPARATOR, COMMAND_SHORTCUT,
		primitives::{Controllable, use_controllable},
	},
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
	let cls = cn!(COMMAND_ROOT, class);
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
			class: COMMAND_DIALOG_OVERLAY,
			onclick: move |_| open.set(false),
		}
		div {
			role: "dialog",
			class: COMMAND_DIALOG_CONTENT,
			"data-slot": "command-dialog",
			onkeydown: move |e| {
				if e.key() == Key::Escape {
					open.set(false);
				}
			},
			Command { class: COMMAND_DIALOG_COMMAND,
				{children}
			}
		}
	}
}
#[component]
pub fn CommandInput(#[props(default)] placeholder: String, #[props(default)] class: String) -> Element {
	let ctx = use_context::<CommandCtx>();
	let value = ctx.search.get();
	let cls = cn!(COMMAND_INPUT, class);
	rsx! {
		div {
			class: COMMAND_INPUT_WRAPPER,
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
	let cls = cn!(COMMAND_LIST, class);
	rsx! {
		div { role: "listbox", class: cls, "data-slot": "command-list", {children} }
	}
}
/// Renders nothing until the parent `Command` has a non-blank search query, so
/// the empty-state cannot sit next to the unfiltered list.
#[component]
pub fn CommandEmpty(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<CommandCtx>();
	if ctx.search.get().trim().is_empty() {
		return rsx! {};
	}
	let cls = cn!(COMMAND_EMPTY, class);
	rsx! {
		div { class: cls, "data-slot": "command-empty", {children} }
	}
}
#[component]
pub fn CommandGroup(#[props(default)] heading: String, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(COMMAND_GROUP, class);
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
	let cls = cn!(COMMAND_ITEM, class);
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
	let cls = cn!(COMMAND_SEPARATOR, class);
	rsx! {
		div { class: cls, "data-slot": "command-separator" }
	}
}
#[component]
pub fn CommandShortcut(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(COMMAND_SHORTCUT, class);
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
	fn empty_state_hidden_until_a_query_is_typed() {
		fn no_query() -> Element {
			rsx! {
				Command {
					CommandList {
						CommandEmpty { "No results found." }
						CommandItem { value: "Apple", "Apple" }
					}
				}
			}
		}
		let html = render(no_query);
		assert!(!html.contains("command-empty"), "empty-state must not show next to the unfiltered list: {html}");
		assert!(html.contains("Apple"), "{html}");

		// Blank input is not a query (mirrors the TS port's `search.trim() !== ""`).
		fn blank_query() -> Element {
			rsx! {
				Command { default_search: "   ".to_string(),
					CommandList {
						CommandEmpty { "No results found." }
					}
				}
			}
		}
		assert!(!render(blank_query).contains("command-empty"), "{}", render(blank_query));

		fn with_query() -> Element {
			rsx! {
				Command { default_search: "zzz".to_string(),
					CommandList {
						CommandEmpty { "No results found." }
						CommandItem { value: "Apple", "Apple" }
					}
				}
			}
		}
		let html = render(with_query);
		assert!(html.contains("command-empty"), "a query with no match should show the empty-state: {html}");
		assert!(html.contains("No results found."), "{html}");
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
