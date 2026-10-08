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
		primitives::{Controllable, sort_into_document_order, use_controllable, use_stable_id},
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
	let layout = use_signal(|| 0_u64);
	let handlers = use_hook(|| CopyValue::new(BTreeMap::new()));
	let layout_pending = use_hook(|| CopyValue::new(None::<usize>));
	// Until the user moves the highlight it tracks the first row, so results
	// that arrive after the keystroke (or reorder under it) put Enter on the top
	// hit. Once moved, it sticks while that row stays and the query is the one
	// it was moved under.
	let highlighted = use_memo(move || {
		// Read for the dependency only: bumped once the rows' DOM has settled
		// after a render, so a keyed re-sort is seen in its new order.
		let _ = layout.read();
		let query = query_of(&search.get());
		let reachable = reachable_rows(&items.read(), &els.read(), &query, *filter.read());
		highlight_in(&reachable, moved.read().as_ref(), &query)
	});
	let id = use_stable_id("command-list");
	let list_id = use_signal(move || id);
	use_context_provider(|| CommandCtx {
		search,
		filter,
		items,
		els,
		moved,
		layout,
		layout_pending,
		handlers,
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
	use_context_provider(|| CommandGroupId(dioxus::dioxus_core::current_scope_id().0));
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
/// Fuzzy-matched (fzf v1) by `value` against the parent `Command` search text
/// and ranked through CSS `order` (unless the `Command` has `should_filter:
/// false`); non-matching items render nothing.
#[component]
pub fn CommandItem(value: String, #[props(default)] disabled: bool, on_select: Option<EventHandler<String>>, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<CommandCtx>();
	let id = use_hook(|| NEXT_ITEM_ID.fetch_add(1, Ordering::Relaxed));
	let dom_id = use_stable_id("command-item");
	let group = try_use_context::<CommandGroupId>().map(|g| g.0);
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
				group,
			},
		);
	}));
	// Read at Enter, not frozen at registration: a handler the caller wires up
	// (or drops) after mount must be the one that fires.
	{
		let mut handlers = ctx.handlers;
		handlers.write().insert(id, on_select);
	}
	use_drop(move || {
		let mut items = ctx.items;
		items.write().remove(&id);
		let mut els = ctx.els;
		els.write().remove(&id);
		let mut handlers = ctx.handlers;
		handlers.write().remove(&id);
		ctx.row_dropped(id);
	});

	ctx.relayout_after_render(id);
	let Some(rank) = ctx.order(&value) else {
		// Unmounted by the filter: a stale element must not be placed in the document order.
		let mut els = ctx.els;
		if els.peek().contains_key(&id) {
			els.write().remove(&id);
		}
		return rsx! {};
	};
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
			style: "order: {rank}",
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
	/// Bumped after a render of the rows, once the DOM has their new order.
	layout: Signal<u64>,
	/// Every row's `on_select`, refreshed on each of its renders. Not a signal:
	/// only Enter reads it.
	handlers: CopyValue<BTreeMap<usize, Option<EventHandler<String>>>>,
	/// The row whose effect will bump `layout` after this render, if one is queued.
	/// An effect dies with its row, so a row unmounting with it queued clears this.
	layout_pending: CopyValue<Option<usize>>,
	/// The highlighted row: Enter's target and the input's `aria-activedescendant`.
	highlighted: Memo<Option<usize>>,
	/// The listbox's id, for the input's `aria-controls`.
	list_id: Signal<String>,
}

impl CommandCtx {
	fn query(&self) -> String {
		query_of(&self.search.get())
	}

	fn order(&self, value: &str) -> Option<i64> {
		order(&self.query(), *self.filter.read(), value)
	}

	fn has_matches(&self) -> bool {
		self.items.read().values().any(|e| self.order(&e.value).is_some())
	}

	fn dom_id_of(&self, id: usize) -> Option<String> {
		self.items.read().get(&id).map(|e| e.dom_id.clone())
	}

	fn highlighted_dom_id(&self) -> Option<String> {
		(*self.highlighted.read()).and_then(|id| self.dom_id_of(id))
	}

	/// Queues one re-read of the rows' order for after this render — a keyed
	/// re-sort moves rows without remounting them, so nothing else would tell
	/// the highlight. Effects run once the edits are in the DOM.
	///
	/// The effect is queued on the calling row, `row`; dioxus drops a scope's
	/// queued effects with the scope, so [`CommandCtx::row_dropped`] takes the
	/// job back when that row unmounts first.
	fn relayout_after_render(&self, row: usize) {
		let mut pending = self.layout_pending;
		if pending.peek().is_some() {
			return;
		}
		pending.set(Some(row));
		let layout = self.layout;
		dioxus::dioxus_core::queue_effect(move || {
			pending.set(None);
			bump(layout);
		});
	}

	/// A row unmounting: if the re-read it queued has not run, it never will,
	/// so re-read now — the rows that stay are already in the DOM — and free
	/// the next render to queue its own.
	fn row_dropped(&self, row: usize) {
		let mut pending = self.layout_pending;
		if *pending.peek() == Some(row) {
			pending.set(None);
			bump(self.layout);
		}
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
		// Read from the DOM at the key, not from the memo: the memo may not have
		// seen a re-sort that the screen already shows.
		let query = self.query();
		let reachable = reachable_rows(&self.items.peek(), &self.els.peek(), &query, *self.filter.peek());
		let Some(last) = reachable.len().checked_sub(1) else { return };
		let current = highlight_in(&reachable, self.moved.peek().as_ref(), &query).and_then(|h| reachable.iter().position(|r| *r == h));
		let next = match e.key() {
			Key::ArrowDown => current.map_or(0, |at| (at + 1).min(last)),
			Key::ArrowUp => current.map_or(last, |at| at.saturating_sub(1)),
			Key::Enter => {
				let Some(at) = current else { return };
				let row = reachable[at];
				let on_select = self.handlers.peek().get(&row).copied().flatten();
				let entry = self.items.peek().get(&row).map(|e| (e.value.clone(), on_select));
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
	/// The [`CommandGroup`] it renders in; rows ranked by `order` share it.
	group: Option<usize>,
}

/// Provided by [`CommandGroup`]: `order` only reorders siblings, so keyboard order is per group.
#[derive(Clone, Copy)]
struct CommandGroupId(usize);

fn bump(mut layout: Signal<u64>) {
	layout.with_mut(|n| *n = n.wrapping_add(1));
}

/// The active query: trimmed, so blank input is not a search, and lowercased
/// for the case-insensitive compare. Shared by the item filter, the highlight
/// and the empty-state gate so they can never disagree.
fn query_of(search: &str) -> String {
	search.trim().to_lowercase()
}

/// The ids of the rows the keys can reach — rendered and not disabled — in the
/// order on screen: each group's rows by their CSS `order`, then document order.
fn reachable_rows(items: &BTreeMap<usize, CommandEntry>, els: &BTreeMap<usize, Rc<MountedData>>, query: &str, should_filter: bool) -> Vec<usize> {
	let mut placed: Vec<_> = items
		.iter()
		.filter(|(_, e)| !e.disabled)
		.filter_map(|(id, e)| order(query, should_filter, &e.value).map(|rank| (*id, e.group, rank, els.get(id).cloned())))
		.collect();
	sort_into_document_order(&mut placed, |(.., el)| el.as_ref());
	let mut groups: Vec<Option<usize>> = Vec::new();
	for (_, group, ..) in &placed {
		if !groups.contains(group) {
			groups.push(*group);
		}
	}
	placed.sort_by_key(|(_, group, rank, _)| (groups.iter().position(|g| g == group).expect("collected from `placed`"), *rank));
	placed.into_iter().map(|(id, ..)| id).collect()
}

/// The highlighted row among `reachable` (in screen order): the one the user
/// moved to, while it stays and the query is the one it was moved under; else
/// the top row.
fn highlight_in(reachable: &[usize], moved: Option<&(usize, String)>, query: &str) -> Option<usize> {
	match moved {
		Some((id, under)) if under == query && reachable.contains(id) => Some(*id),
		_ => reachable.first().copied(),
	}
}

/// A row's CSS `order` (`-score`, so the best match is on top), `None` when it is
/// filtered out. With `should_filter` off every row stays, in the caller's order.
fn order(query: &str, should_filter: bool, value: &str) -> Option<i64> {
	if !should_filter || query.is_empty() {
		return Some(0);
	}
	fuzzy_score(value, query).map(|score| -score)
}

/// fzf v1, as the TS port's `fuzzyScore`: per whitespace-separated term, the
/// shortest window ending at the first full subsequence match, scored for word
/// starts and runs, charged for gaps. `None` when a term does not match.
fn fuzzy_score(value: &str, query: &str) -> Option<i64> {
	let hay: Vec<char> = value.to_lowercase().chars().collect();
	let mut total = 0;
	for term in query.split_whitespace() {
		let needle: Vec<char> = term.chars().collect();
		let mut k = 0;
		let end = hay.iter().position(|c| {
			if *c == needle[k] {
				k += 1;
			}
			k == needle.len()
		})?;
		let mut start = end;
		let mut j = needle.len();
		for i in (0..=end).rev() {
			if hay[i] == needle[j - 1] {
				start = i;
				j -= 1;
				if j == 0 {
					break;
				}
			}
		}
		let mut prev = None;
		let mut j = 0;
		for i in start..=end {
			if hay[i] != needle[j] {
				continue;
			}
			total += 16;
			if i == 0 || !hay[i - 1].is_alphanumeric() {
				total += 8;
			}
			if let Some(p) = prev {
				total += if i == p + 1 { 4 } else { -(3 + (i - p - 2) as i64) };
			}
			prev = Some(i);
			j += 1;
			if j == needle.len() {
				break;
			}
		}
	}
	Some(total)
}

static NEXT_ITEM_ID: AtomicUsize = AtomicUsize::new(0);

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::{
		primitives::sort_by_position,
		test_util::{render, render_after_keys_on_queued_effects, render_after_settled_keys, render_with_effects},
	};

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

	thread_local! {
		static CASE: std::cell::RefCell<(Vec<&'static str>, &'static str)> = const { std::cell::RefCell::new((Vec::new(), "")) };
	}

	/// The rows `query` leaves among `values`, in the order the arrows walk them.
	fn check(values: &[&'static str], query: &'static str, expected: &[&str]) {
		fn app() -> Element {
			let (values, query) = CASE.with_borrow(Clone::clone);
			rsx! {
				Command { default_search: query.to_string(),
					CommandInput {}
					CommandList {
						for v in values {
							CommandItem { key: "{v}", value: v, {v} }
						}
					}
				}
			}
		}
		CASE.set((values.to_vec(), query));
		let html = render_with_effects(app);
		assert_eq!(html.matches("role=\"option\"").count(), expected.len(), "{html}");
		let walked: Vec<String> = (0..expected.len())
			.map(|k| {
				let html = render_after_settled_keys(app, &vec![Key::ArrowDown; k]);
				highlighted(&html).concat()
			})
			.collect();
		assert_eq!(walked, expected, "{query:?} over {values:?}");
	}

	#[test]
	fn fuzzy_matching_ranked_as_fzf_ranks() {
		check(&["Apple", "Banana"], "bna", &["Banana"]);
		check(&["Apple", "Banana"], "pe", &["Apple"]);
		check(&["Apple", "Banana"], "ea", &[]);
		check(&["gary.lee.nnn@xa.com", "glennamonitti@gmail.com"], "glenna", &["glennamonitti@gmail.com", "gary.lee.nnn@xa.com"]);
		check(&["xmonx@a.com", "bob.mon@a.com"], "mon", &["bob.mon@a.com", "xmonx@a.com"]);
		check(&["ann@gmail.com", "ann@proton.me", "bo@gmail.com"], "ann gm", &["ann@gmail.com"]);
		check(&["b@a.com", "a@a.com"], "@a", &["b@a.com", "a@a.com"]);
	}

	#[test]
	fn ranking_stays_within_each_group() {
		fn app() -> Element {
			rsx! {
				Command { default_search: "mon".to_string(),
					CommandInput {}
					CommandList {
						CommandGroup { heading: "A",
							CommandItem { value: "xmonx", "xmonx" }
						}
						CommandGroup { heading: "B",
							CommandItem { value: "xxmonxx", "xxmonxx" }
							CommandItem { value: "mon", "mon" }
						}
					}
				}
			}
		}
		let walked: Vec<String> = (0..3).map(|k| highlighted(&render_after_settled_keys(app, &vec![Key::ArrowDown; k])).concat()).collect();
		assert_eq!(walked, ["xmonx", "mon", "xxmonxx"]);
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

	/// `(registration id, place on screen)`; the sort sees only the place.
	fn on_screen(rows: &mut [(usize, usize)]) -> Vec<usize> {
		sort_by_position(rows, |_| true, |a, b| a.1 < b.1);
		rows.iter().map(|r| r.0).collect()
	}

	#[test]
	fn an_on_select_given_after_mount_is_what_enter_fires() {
		fn app() -> Element {
			let mut armed = use_signal(|| false);
			let mut picked = use_signal(String::new);
			let on_select = armed().then(|| EventHandler::new(move |v: String| picked.set(v)));
			rsx! {
				span { "picked:{picked}" }
				// Stands in for the caller wiring the handler up later.
				div {
					onkeydown: move |e| {
						if e.key() == Key::F2 {
							armed.set(true);
						}
					},
				}
				Command {
					CommandInput {}
					CommandList {
						CommandItem { value: "Apple", on_select, "Apple" }
					}
				}
			}
		}
		let html = render_after_settled_keys(app, &[Key::F2, Key::Enter]);
		assert_eq!(picked(&html), "Apple", "{html}");
	}

	#[test]
	fn a_row_unmounted_before_its_relayout_ran_does_not_freeze_the_order() {
		/// Shows whether a re-read of the rows' order is still queued, re-rendering on each re-read.
		#[component]
		fn Probe() -> Element {
			let ctx = use_context::<CommandCtx>();
			let _ = ctx.layout.read();
			let pending = ctx.layout_pending.peek().is_some();
			rsx! { "pending:{pending}" }
		}
		fn app() -> Element {
			let mut rows = use_signal(|| vec!["Apple", "Banana"]);
			rsx! {
				div {
					onkeydown: move |e| {
						if e.key() == Key::F2 {
							rows.set(vec!["Banana"]);
						}
					},
				}
				Command {
					CommandInput {}
					CommandList {
						for row in rows() {
							CommandItem { key: "{row}", value: row, {row} }
						}
					}
					Probe {}
				}
			}
		}
		// Apple queued the first re-read; F2 unmounts it before that ran, and the
		// highlight moving to Banana then asks for another.
		let html = render_after_keys_on_queued_effects(app, &[Key::F2, Key::ArrowDown]);
		assert!(html.contains("pending:false"), "{html}");
	}

	#[test]
	fn a_keyed_resort_moves_the_default_highlight_and_the_arrows() {
		// Registered Apple (0), Apricot (1); the server re-sorts Apricot on top.
		let reachable = on_screen(&mut [(0, 1), (1, 0)]);
		assert_eq!(reachable, [1, 0]);
		assert_eq!(highlight_in(&reachable, None, "ap"), Some(1), "Enter goes to the top row on screen");
		assert_eq!(highlight_in(&reachable, Some(&(0, "ap".to_string())), "ap"), Some(0), "a moved highlight stays on its row");
	}

	#[test]
	fn a_row_inserted_above_the_mounted_ones_comes_first() {
		let reachable = on_screen(&mut [(0, 1), (1, 2), (2, 0)]);
		assert_eq!(reachable, [2, 0, 1]);
		assert_eq!(highlight_in(&reachable, None, ""), Some(2));
	}

	#[test]
	fn a_moved_highlight_resets_with_the_query_or_its_row() {
		let moved = (1, "a".to_string());
		assert_eq!(highlight_in(&[0, 1], Some(&moved), "ab"), Some(0), "a new query starts at the top");
		assert_eq!(highlight_in(&[0, 2], Some(&moved), "a"), Some(0), "a gone row hands back to the top");
	}
}
