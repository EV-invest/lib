use std::{
	collections::BTreeMap,
	rc::Rc,
	sync::atomic::{AtomicUsize, Ordering},
};

use dioxus::{
	html::{ScrollBehavior, ScrollLogicalPosition, ScrollToOptions},
	prelude::*,
};

use crate::{
	cn,
	uikit::{
		COMMAND_DIALOG_COMMAND, COMMAND_DIALOG_CONTENT, COMMAND_DIALOG_OVERLAY, COMMAND_EMPTY, COMMAND_GROUP, COMMAND_INPUT, COMMAND_INPUT_WRAPPER, COMMAND_ITEM, COMMAND_LIST, COMMAND_ROOT,
		COMMAND_SEPARATOR, COMMAND_SHORTCUT,
		primitives::{Controllable, use_controllable, use_stable_id},
	},
};

// dep-light: inline positioning + backdrop; no portal/floating/drag — see README Limitations

#[component]
pub fn Command(
	search: Option<String>,
	#[props(default)] default_search: String,
	on_search_change: Option<EventHandler<String>>,
	/// `false` hands filtering to the caller (e.g. rows that are a server
	/// response to the query): every mounted item renders, in the caller's
	/// order, and `CommandEmpty` counts mounted items.
	#[props(default = true)]
	should_filter: bool,
	#[props(default)] class: String,
	children: Element,
) -> Element {
	let search = use_controllable(search, default_search, on_search_change);
	let mut filter = use_signal(|| should_filter);
	if *filter.peek() != should_filter {
		filter.set(should_filter);
	}
	let items = use_signal(BTreeMap::<usize, CommandEntry>::new);
	let els = use_signal(BTreeMap::new);
	let moved = use_signal(|| None::<(usize, String)>);
	// Until the user moves the highlight it tracks the first row, so results
	// that arrive after the keystroke (or reorder under it) put Enter on the top
	// hit. Once moved, it sticks while that row stays and the query is the one
	// it was moved under.
	let highlighted = use_memo(move || {
		let query = query_of(&search.get());
		let should_filter = *filter.read();
		let items = items.read();
		let mut reachable = items.iter().filter(|(_, e)| !e.disabled && matches(&query, should_filter, &e.value)).map(|(id, _)| *id);
		match &*moved.read() {
			Some((id, under)) if *under == query && reachable.clone().any(|r| r == *id) => Some(*id),
			_ => reachable.next(),
		}
	});
	let id = use_stable_id("command-list");
	let list_id = use_signal(move || id);
	use_context_provider(|| CommandCtx {
		search,
		filter,
		items,
		els,
		moved,
		highlighted,
		list_id,
	});
	let cls = cn!(COMMAND_ROOT, class);
	rsx! {
		div { class: cls, "data-slot": "command", {children} }
	}
}
#[component]
pub fn CommandDialog(
	open: Option<bool>,
	#[props(default)] default_open: bool,
	on_open_change: Option<EventHandler<bool>>,
	/// See [`Command`]'s `should_filter`.
	#[props(default = true)]
	should_filter: bool,
	#[props(default)] class: String,
	children: Element,
) -> Element {
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
			"aria-modal": "true",
			class: COMMAND_DIALOG_CONTENT,
			"data-slot": "command-dialog",
			onkeydown: move |e| {
				if e.key() == Key::Escape {
					open.set(false);
				}
			},
			Command { class: COMMAND_DIALOG_COMMAND, should_filter,
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
				"aria-hidden": "true",
				circle { cx: "11", cy: "11", r: "8" }
				path { d: "m21 21-4.3-4.3" }
			}
			input {
				r#type: "text",
				role: "combobox",
				class: cls,
				"data-slot": "command-input",
				// Focus stays here and points at the highlighted row (the ARIA
				// combobox pattern), so the rows never need to be tabbable.
				"aria-autocomplete": "list",
				"aria-expanded": "true",
				"aria-controls": ctx.list_id.read().clone(),
				"aria-activedescendant": ctx.highlighted_dom_id(),
				autocomplete: "off",
				placeholder,
				value,
				oninput: move |e| ctx.search.set(e.value()),
				onkeydown: move |e| ctx.on_input_key(&e),
			}
		}
	}
}
#[component]
pub fn CommandList(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<CommandCtx>();
	let cls = cn!(COMMAND_LIST, class);
	rsx! {
		div {
			role: "listbox",
			id: ctx.list_id.read().clone(),
			class: cls,
			"data-slot": "command-list",
			{children}
		}
	}
}
/// Renders only when a search is under way and no item matched it — never next
/// to results, and never before the user has typed.
#[component]
pub fn CommandEmpty(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<CommandCtx>();
	if ctx.query().is_empty() || ctx.has_matches() {
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
/// `Command` search text (unless the `Command` has `should_filter: false`);
/// non-matching items render nothing.
#[component]
pub fn CommandItem(value: String, #[props(default)] disabled: bool, on_select: Option<EventHandler<String>>, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<CommandCtx>();
	let id = use_hook(|| NEXT_ITEM_ID.fetch_add(1, Ordering::Relaxed));
	let dom_id = use_stable_id("command-item");
	// Registered whether or not this item survives the filter below, so
	// `CommandEmpty` gates on the search, not on who happens to be mounted.
	// `use_reactive` re-runs it if the value or `disabled` prop changes.
	let registered_id = dom_id.clone();
	use_effect(use_reactive!(|value, disabled| {
		let mut items = ctx.items;
		items.write().insert(
			id,
			CommandEntry {
				value,
				disabled,
				dom_id: registered_id.clone(),
				on_select,
			},
		);
	}));
	use_drop(move || {
		let mut items = ctx.items;
		items.write().remove(&id);
		let mut els = ctx.els;
		els.write().remove(&id);
	});

	if !ctx.matches(&value) {
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
	let selected = ctx.highlighted.read().is_some_and(|h| h == id);
	rsx! {
		div {
			role: "option",
			id: dom_id,
			class: cls,
			"data-slot": "command-item",
			"data-disabled": if disabled { "true" } else { "false" },
			"data-selected": if selected { "true" } else { "false" },
			"aria-selected": if selected { "true" } else { "false" },
			"aria-disabled": disabled.then_some("true"),
			tabindex: "-1",
			onmounted: move |e| {
				let mut els = ctx.els;
				els.write().insert(id, e.data());
			},
			onpointermove: move |_| {
				if !disabled && !selected {
					ctx.activate(id);
				}
			},
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
#[derive(Clone, Copy)]
struct CommandCtx {
	search: Controllable<String>,
	/// `should_filter`, as a signal so the highlight follows it.
	filter: Signal<bool>,
	/// Every mounted [`CommandItem`], by id in render order — including the ones
	/// filtering themselves out, so [`CommandEmpty`] can tell "nothing matched"
	/// from "nothing is here". Items register through an effect, so this is
	/// populated one render after mount.
	items: Signal<BTreeMap<usize, CommandEntry>>,
	/// The rendered rows' elements, for scrolling the highlight into view.
	els: Signal<BTreeMap<usize, Rc<MountedData>>>,
	/// The row the user moved the highlight to, and the query it was moved under.
	moved: Signal<Option<(usize, String)>>,
	/// The highlighted row: Enter's target and the input's `aria-activedescendant`.
	highlighted: Memo<Option<usize>>,
	/// The listbox's id, for the input's `aria-controls`.
	list_id: Signal<String>,
}

impl CommandCtx {
	fn query(&self) -> String {
		query_of(&self.search.get())
	}

	fn matches(&self, value: &str) -> bool {
		matches(&self.query(), *self.filter.read(), value)
	}

	fn has_matches(&self) -> bool {
		self.items.read().values().any(|e| self.matches(&e.value))
	}

	fn dom_id_of(&self, id: usize) -> Option<String> {
		self.items.read().get(&id).map(|e| e.dom_id.clone())
	}

	fn highlighted_dom_id(&self) -> Option<String> {
		(*self.highlighted.read()).and_then(|id| self.dom_id_of(id))
	}

	fn activate(&self, id: usize) {
		let mut moved = self.moved;
		moved.set(Some((id, self.query())));
	}

	/// The search field drives the list: ArrowUp/ArrowDown move the highlight
	/// (stopping at the ends), Enter selects it. Home and End stay the caret's —
	/// the field is editable (ARIA APG editable combobox).
	fn on_input_key(&self, e: &KeyboardEvent) {
		if e.is_composing() {
			return;
		}
		let reachable: Vec<usize> = {
			let items = self.items.peek();
			let query = self.query();
			let should_filter = *self.filter.peek();
			items.iter().filter(|(_, e)| !e.disabled && matches(&query, should_filter, &e.value)).map(|(id, _)| *id).collect()
		};
		let Some(last) = reachable.len().checked_sub(1) else { return };
		let current = (*self.highlighted.peek()).and_then(|h| reachable.iter().position(|r| *r == h));
		let next = match e.key() {
			Key::ArrowDown => current.map_or(0, |at| (at + 1).min(last)),
			Key::ArrowUp => current.map_or(last, |at| at.saturating_sub(1)),
			Key::Enter => {
				let Some(at) = current else { return };
				let entry = self.items.peek().get(&reachable[at]).map(|e| (e.value.clone(), e.on_select));
				if let Some((value, on_select)) = entry {
					e.prevent_default();
					if let Some(handler) = on_select {
						handler.call(value);
					}
				}
				return;
			}
			_ => return,
		};
		e.prevent_default();
		let target = reachable[next];
		self.activate(target);
		if let Some(el) = self.els.peek().get(&target).cloned() {
			// Best-effort, like focus: a row that unmounted meanwhile just
			// doesn't scroll, which is why the result is dropped.
			spawn(async move {
				let _ = el
					.scroll_to_with_options(ScrollToOptions {
						behavior: ScrollBehavior::Instant,
						vertical: ScrollLogicalPosition::Nearest,
						horizontal: ScrollLogicalPosition::Nearest,
					})
					.await;
			});
		}
	}
}

struct CommandEntry {
	value: String,
	disabled: bool,
	/// What the input's `aria-activedescendant` names while this row is highlighted.
	dom_id: String,
	on_select: Option<EventHandler<String>>,
}

/// The active query: trimmed, so blank input is not a search, and lowercased
/// for the case-insensitive compare. Shared by the item filter, the highlight
/// and the empty-state gate so they can never disagree.
fn query_of(search: &str) -> String {
	search.trim().to_lowercase()
}

/// With `should_filter` off every row matches: the caller's rows are the results.
fn matches(query: &str, should_filter: bool, value: &str) -> bool {
	!should_filter || query.is_empty() || value.to_lowercase().contains(query)
}

static NEXT_ITEM_ID: AtomicUsize = AtomicUsize::new(0);

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::{render, render_after_settled_keys, render_with_effects};

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
		let html = render_with_effects(no_query);
		assert!(!html.contains("command-empty"), "empty-state must not show next to the unfiltered list: {html}");
		assert!(html.contains("Apple"), "{html}");

		// Blank input is not a query (mirrors the TS port's `search.trim()`).
		fn blank_query() -> Element {
			rsx! {
				Command { default_search: "   ".to_string(),
					CommandList {
						CommandEmpty { "No results found." }
					}
				}
			}
		}
		let html = render_with_effects(blank_query);
		assert!(!html.contains("command-empty"), "{html}");
	}

	#[test]
	fn empty_state_shows_only_when_the_query_matches_nothing() {
		// The bug: "ban" matches Banana, yet the empty-state rendered anyway.
		fn matching_query() -> Element {
			rsx! {
				Command { default_search: "ban".to_string(),
					CommandList {
						CommandEmpty { "No results found." }
						CommandItem { value: "Apple", "Apple" }
						CommandItem { value: "Banana", "Banana" }
					}
				}
			}
		}
		let html = render_with_effects(matching_query);
		assert!(html.contains("Banana"), "the match still renders: {html}");
		assert!(!html.contains("command-empty"), "the empty-state must not sit next to a match: {html}");

		fn unmatched_query() -> Element {
			rsx! {
				Command { default_search: "zzz".to_string(),
					CommandList {
						CommandEmpty { "No results found." }
						CommandItem { value: "Apple", "Apple" }
						CommandItem { value: "Banana", "Banana" }
					}
				}
			}
		}
		let html = render_with_effects(unmatched_query);
		assert!(html.contains("No results found."), "nothing matched, so the empty-state shows: {html}");
		assert!(!html.contains(">Apple<"), "{html}");
	}

	#[test]
	fn empty_state_shows_when_a_query_has_no_items_at_all() {
		fn app() -> Element {
			rsx! {
				Command { default_search: "zzz".to_string(),
					CommandList {
						CommandEmpty { "No results found." }
					}
				}
			}
		}
		let html = render_with_effects(app);
		assert!(html.contains("No results found."), "an itemless list is still 'no results': {html}");
	}

	#[test]
	fn a_match_inside_a_group_also_suppresses_the_empty_state() {
		// Items register through context, so nesting must not hide them from
		// `CommandEmpty` the way a sibling-only check would.
		fn app() -> Element {
			rsx! {
				Command { default_search: "set".to_string(),
					CommandList {
						CommandEmpty { "No results found." }
						CommandGroup { heading: "Pages",
							CommandItem { value: "settings", "Settings" }
						}
					}
				}
			}
		}
		let html = render_with_effects(app);
		assert!(html.contains("Settings"), "{html}");
		assert!(!html.contains("command-empty"), "a match nested in a group still counts: {html}");
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

	#[test]
	fn open_dialog_is_modal() {
		fn app() -> Element {
			rsx! {
				CommandDialog { default_open: true,
					CommandInput { placeholder: "Search".to_string() }
				}
			}
		}
		let html = render(app);
		let at = html.find("data-slot=\"command-dialog\"").expect("dialog rendered");
		let tag = &html[html[..at].rfind('<').expect("opening tag")..at];
		assert!(tag.contains("role=\"dialog\""), "{tag}");
		assert!(tag.contains("aria-modal=\"true\""), "{tag}");
	}

	/// The value of the row marked highlighted, read off its text.
	fn highlighted(html: &str) -> Vec<&str> {
		html.match_indices("data-selected=\"true\"")
			.map(|(at, _)| {
				let start = at + html[at..].find('>').expect("tag end") + 1;
				&html[start..start + html[start..].find('<').expect("text end")]
			})
			.collect()
	}

	fn picked(html: &str) -> &str {
		let start = html.find("picked:").expect("the picked marker") + "picked:".len();
		&html[start..start + html[start..].find('<').expect("marker end")]
	}

	fn fruit() -> Element {
		let mut picked = use_signal(String::new);
		rsx! {
			span { "picked:{picked}" }
			Command {
				CommandInput { placeholder: "Search".to_string() }
				CommandList {
					CommandItem { value: "Apple", on_select: move |v| picked.set(v), "Apple" }
					CommandItem { value: "Banana", disabled: true, on_select: move |v| picked.set(v), "Banana" }
					CommandItem { value: "Cherry", on_select: move |v| picked.set(v), "Cherry" }
					CommandItem { value: "Date", on_select: move |v| picked.set(v), "Date" }
				}
			}
		}
	}

	#[test]
	fn input_is_a_combobox_that_controls_the_list() {
		let html = render_with_effects(fruit);
		let at = html.find("aria-controls=\"").expect("aria-controls on the input") + "aria-controls=\"".len();
		let id = &html[at..at + html[at..].find('"').unwrap_or(0)];
		assert!(!id.is_empty(), "{html}");
		assert!(html.contains(&format!("role=\"listbox\" id=\"{id}\"")), "{html}");
		assert!(html.contains("aria-expanded=\"true\""), "{html}");
		assert!(html.contains("aria-autocomplete=\"list\""), "{html}");
	}

	#[test]
	fn the_first_row_is_highlighted_and_named_by_the_input() {
		let html = render_with_effects(fruit);
		assert_eq!(highlighted(&html), ["Apple"], "{html}");
		let at = html.find("aria-activedescendant=\"").expect("an active descendant") + "aria-activedescendant=\"".len();
		let id = &html[at..at + html[at..].find('"').unwrap_or(0)];
		assert!(html.contains(&format!("role=\"option\" id=\"{id}\"")), "it names a row: {html}");
		assert!(html.contains("aria-disabled=\"true\""), "{html}");
	}

	#[test]
	fn arrows_move_the_highlight_past_disabled_rows_without_wrapping() {
		let html = render_after_settled_keys(fruit, &[Key::ArrowDown]);
		assert_eq!(highlighted(&html), ["Cherry"], "the disabled Banana is skipped: {html}");
		let html = render_after_settled_keys(fruit, &[Key::ArrowDown, Key::ArrowDown, Key::ArrowDown]);
		assert_eq!(highlighted(&html), ["Date"], "the last row holds: {html}");
		let html = render_after_settled_keys(fruit, &[Key::ArrowUp]);
		assert_eq!(highlighted(&html), ["Apple"], "the first row holds: {html}");
	}

	#[test]
	fn home_and_end_stay_with_the_caret() {
		for key in [Key::End, Key::Home] {
			let html = render_after_settled_keys(fruit, &[Key::ArrowDown, key]);
			assert_eq!(highlighted(&html), ["Cherry"], "{html}");
		}
	}

	#[test]
	fn enter_selects_the_highlighted_row() {
		let html = render_after_settled_keys(fruit, &[Key::Enter]);
		assert_eq!(picked(&html), "Apple", "{html}");
		let html = render_after_settled_keys(fruit, &[Key::ArrowDown, Key::Enter]);
		assert_eq!(picked(&html), "Cherry", "{html}");
	}

	#[test]
	fn the_highlight_follows_the_filter() {
		fn app() -> Element {
			rsx! {
				Command { default_search: "an".to_string(),
					CommandInput {}
					CommandList {
						CommandItem { value: "Apple", "Apple" }
						CommandItem { value: "Banana", "Banana" }
						CommandItem { value: "Mango", "Mango" }
					}
				}
			}
		}
		let html = render_after_settled_keys(app, &[Key::ArrowDown]);
		assert_eq!(highlighted(&html), ["Mango"], "only the rows the filter kept: {html}");
	}

	#[test]
	fn should_filter_false_leaves_every_row_to_the_caller() {
		fn app() -> Element {
			rsx! {
				Command { default_search: "zzz".to_string(), should_filter: false,
					CommandInput {}
					CommandList {
						CommandEmpty { "No results found." }
						CommandItem { value: "Apple", "Apple" }
						CommandItem { value: "Banana", "Banana" }
					}
				}
			}
		}
		let html = render_with_effects(app);
		assert!(html.contains(">Apple<") && html.contains(">Banana<"), "{html}");
		assert!(!html.contains("command-empty"), "mounted rows are the results: {html}");
		assert_eq!(highlighted(&html), ["Apple"], "{html}");

		fn nothing_mounted() -> Element {
			rsx! {
				Command { default_search: "zzz".to_string(), should_filter: false,
					CommandList {
						CommandEmpty { "No results found." }
					}
				}
			}
		}
		assert!(render_with_effects(nothing_mounted).contains("No results found."));
	}
}
