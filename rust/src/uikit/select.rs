use std::{
	collections::BTreeMap,
	rc::Rc,
	sync::atomic::{AtomicUsize, Ordering},
};

use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		SELECT_CONTENT_BOUNDS, SELECT_ITEM, Size,
		primitives::{Controllable, DismissReason, sort_into_document_order, text_of, use_controllable, use_dismissable_layer, use_stable_id},
		select_trigger_size_class,
	},
};

// dep-light: inline positioning + backdrop; no portal/floating/drag — see README Limitations

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
	let id = use_stable_id("select-content");
	let content_id = use_signal(move || id);
	let trigger = use_signal(|| None);
	let options = use_signal(BTreeMap::new);
	let active = use_signal(|| None);
	let typed = use_signal(Typeahead::default);
	use_context_provider(|| SelectCtx {
		value,
		open,
		content_id,
		trigger,
		options,
		active,
		typed,
	});
	let cls = cn!("relative", class);
	rsx! {
		div { class: cls, "data-slot": "select", {children} }
	}
}
#[component]
pub fn SelectTrigger(#[props(default)] size: Size, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<SelectCtx>();
	let open = ctx.open.get();
	let data_state = if open { "open" } else { "closed" };
	// The placeholder mark is on `SelectValue`'s span, not on this button.
	let cls = cn!(
		"border-input [&_[data-placeholder]]:text-ink-soft [&_svg:not([class*='text-'])]:text-ink-soft \
		 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-accent-error/20 aria-invalid:border-accent-error \
		 flex w-fit items-center justify-between gap-2 rounded-[var(--control-radius)] border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs \
		 transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 \
		 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex \
		 *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 \
		 [&_svg:not([class*='size-'])]:size-4",
		select_trigger_size_class(size),
		class
	);
	rsx! {
		button {
			r#type: "button",
			role: "combobox",
			class: cls,
			"data-slot": "select-trigger",
			"data-size": size.as_ref(),
			"data-state": data_state,
			"aria-haspopup": "listbox",
			"aria-expanded": if open { "true" } else { "false" },
			"aria-controls": open.then(|| ctx.content_id.read().clone()),
			onmounted: move |e| {
				let mut trigger = ctx.trigger;
				trigger.set(Some(e.data()));
			},
			onclick: move |_| if ctx.open.get() { ctx.close(true) } else { ctx.open.set(true) },
			onkeydown: move |e| {
				// A native select opens on the arrows too; Enter and Space already click the button.
				if !ctx.open.get() && matches!(e.key(), Key::ArrowDown | Key::ArrowUp) {
					e.prevent_default();
					ctx.open.set(true);
				}
			},
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
	let open = ctx.open.get();
	// Focus goes back to the trigger after a key, never after a click elsewhere,
	// where it would land on the trigger for a moment and fire its blur on the way out.
	let layer = use_dismissable_layer(open, move |reason| ctx.close(reason == DismissReason::Escape));
	if !open {
		// A caller's controlled `open: false` closes the list without
		// `SelectCtx::close`; an option left active would stop the next open
		// from landing, and focus would stay on the trigger.
		let mut active = ctx.active;
		if active.peek().is_some() {
			active.set(None);
		}
		return rsx! {};
	}
	let cls = cn!(
		"bg-popover text-ink absolute top-full left-0 z-50 mt-1 overflow-x-hidden overflow-y-auto rounded-md border border-border shadow-md",
		SELECT_CONTENT_BOUNDS,
		class
	);
	let backdrop_layer = layer.clone();
	rsx! {
		div {
			class: "fixed inset-0 z-40",
			onclick: move |_| backdrop_layer.on_outside(),
		}
		div {
			role: "listbox",
			id: ctx.content_id.read().clone(),
			class: cls,
			"data-slot": "select-content",
			"data-state": "open",
			tabindex: "-1",
			onkeydown: move |e| {
				if !layer.on_keydown(&e) {
					ctx.on_list_key(&e);
				}
			},
			div { class: "p-1", {children} }
		}
	}
}
#[component]
pub fn SelectItem(
	value: String,
	/// What type-ahead matches; defaults to the text of `children`.
	text_value: Option<String>,
	#[props(default)] disabled: bool,
	#[props(default)] class: String,
	children: Element,
) -> Element {
	let ctx = use_context::<SelectCtx>();
	let selected = ctx.value.get() == value;
	let label = text_value.unwrap_or_else(|| text_of(&children).trim().to_string());
	let id = use_select_option(
		ctx,
		SelectOption {
			value: value.clone(),
			label,
			disabled,
			el: None,
		},
	);
	let cls = cn!(SELECT_ITEM, class);
	let choose = {
		let value = value.clone();
		move |_| {
			if !disabled {
				ctx.choose(value.clone());
			}
		}
	};
	let on_focus = {
		let value = value.clone();
		move |_| {
			// A disabled row takes focus from a click too: it becomes active, so
			// the arrows go on from it, and Enter or Space on it does nothing.
			let mut active = ctx.active;
			if active.peek().as_deref() != Some(value.as_str()) {
				active.set(Some(value.clone()));
			}
		}
	};
	rsx! {
		div {
			role: "option",
			class: cls,
			"data-slot": "select-item",
			"aria-selected": if selected { "true" } else { "false" },
			"aria-disabled": disabled.then_some("true"),
			"data-disabled": disabled.then_some(""),
			tabindex: "-1",
			onmounted: move |e| ctx.mounted(id, e.data()),
			onfocus: on_focus,
			onclick: choose,
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
						"aria-hidden": "true",
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
	let cls = cn!("text-ink-soft px-2 py-1.5 text-xs", class);
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
#[derive(Clone, Copy)]
struct SelectCtx {
	value: Controllable<String>,
	open: Controllable<bool>,
	/// The listbox's id, for the trigger's `aria-controls`.
	content_id: Signal<String>,
	/// Where focus goes back to once the list closes on a key or a choice.
	trigger: Signal<Option<Rc<MountedData>>>,
	/// The mounted options in render order, keyed by registration — read from
	/// handlers only, so rendering never subscribes to it.
	options: Signal<BTreeMap<usize, SelectOption>>,
	/// The option holding focus while the list is open; `None` before the list
	/// has landed on one, when the arrows walk from where it would land.
	active: Signal<Option<String>>,
	typed: Signal<Typeahead>,
}
impl SelectCtx {
	fn choose(&self, value: String) {
		self.value.set(value);
		self.close(true);
	}

	/// `restore_focus`: hand focus back to the trigger — after a key or a
	/// choice, never after a click elsewhere.
	fn close(&self, restore_focus: bool) {
		self.open.set(false);
		let mut active = self.active;
		active.set(None);
		if restore_focus && let Some(el) = self.trigger.peek().clone() {
			focus(el);
		}
	}

	/// The options the keys can reach, as `(value, lowercased label)`, in the
	/// order on screen.
	fn reachable(&self) -> Vec<(String, String)> {
		self.on_screen().into_iter().filter(|o| !o.disabled).map(|o| (o.value, o.label)).collect()
	}

	/// Every option, disabled ones too, in the order on screen; labels lowercased.
	fn on_screen(&self) -> Vec<ListedOption> {
		let options = self.options.peek();
		let mut all: Vec<&SelectOption> = options.values().collect();
		sort_into_document_order(&mut all, |o| o.el.as_ref());
		all.into_iter()
			.map(|o| ListedOption {
				value: o.value.clone(),
				label: o.label.to_lowercase(),
				disabled: o.disabled,
			})
			.collect()
	}

	fn enabled(&self) -> Vec<String> {
		self.reachable().into_iter().map(|(value, _)| value).collect()
	}

	/// Where opening lands: the chosen option, else the first, as a native
	/// select does.
	fn landing(&self) -> Option<String> {
		let enabled = self.enabled();
		let chosen = self.value.get();
		enabled.iter().find(|v| **v == chosen).or(enabled.first()).cloned()
	}

	fn mounted(&self, id: usize, el: Rc<MountedData>) {
		let value = {
			let mut options = self.options;
			let mut options = options.write();
			let Some(option) = options.get_mut(&id) else { return };
			option.el = Some(el);
			option.value.clone()
		};
		if self.active.peek().is_some() {
			return;
		}
		// Decide without the document-order sort while options are still
		// mounting: one sort per mount would cost ~n² DOM calls on opening a long
		// list. A reachable chosen option is found by value alone; with none, the
		// first option on screen is known once every option has mounted.
		let chosen = self.value.get();
		let chosen_reachable = self.options.peek().values().any(|o| !o.disabled && o.value == chosen);
		if chosen_reachable {
			if value == chosen {
				self.move_to(value);
			}
			return;
		}
		if self.options.peek().values().all(|o| o.el.is_some())
			&& let Some(first) = self.landing()
		{
			self.move_to(first);
		}
	}

	fn move_to(&self, value: String) {
		let el = self.options.peek().values().find(|o| o.value == value).and_then(|o| o.el.clone());
		let mut active = self.active;
		active.set(Some(value));
		if let Some(el) = el {
			focus(el);
		}
	}

	/// Arrows, Home, End, Enter, Space, Tab and type-ahead on the open list.
	fn on_list_key(&self, e: &KeyboardEvent) {
		let key = e.key();
		let all = self.on_screen();
		let (enabled, labels): (Vec<String>, Vec<String>) = all.iter().filter(|o| !o.disabled).map(|o| (o.value.clone(), o.label.clone())).unzip();
		let current = self.active.peek().clone().or_else(|| self.landing());
		let at = current.as_ref().and_then(|c| enabled.iter().position(|v| v == c));
		// On a focused disabled option: how many reachable options come before it,
		// so the arrows and the type-ahead go on from where it sits.
		let before = match (at, &current) {
			(None, Some(c)) => all.iter().position(|o| o.value == *c).map(|i| all[..i].iter().filter(|o| !o.disabled).count()),
			_ => None,
		};
		// Only an option the keys can reach is chosen — never a disabled one,
		// not even the previous active one behind it.
		let chosen = at.map(|at| enabled[at].clone());
		let now = now_ms();
		let typing = self.typed.peek().is_typing(now);
		let last = enabled.len().checked_sub(1);
		let to = match (&key, last) {
			(Key::ArrowDown, Some(last)) => Some(match (at, before) {
				(Some(at), _) =>
					if at == last {
						0
					} else {
						at + 1
					},
				(None, Some(before)) =>
					if before > last {
						0
					} else {
						before
					},
				(None, None) => 0,
			}),
			(Key::ArrowUp, Some(last)) => Some(match (at, before) {
				(Some(at), _) =>
					if at == 0 {
						last
					} else {
						at - 1
					},
				(None, Some(before)) =>
					if before == 0 {
						last
					} else {
						before - 1
					},
				(None, None) => last,
			}),
			(Key::Home, Some(_)) => Some(0),
			(Key::End, Some(last)) => Some(last),
			(Key::Enter, _) => {
				e.prevent_default();
				if let Some(value) = chosen {
					self.choose(value);
				}
				return;
			}
			// Mid-query a space is part of the name ("united s"), as in Radix.
			(Key::Character(c), _) if c == " " && !typing => {
				e.prevent_default();
				if let Some(value) = chosen {
					self.choose(value);
				}
				return;
			}
			// Without a portal the list sits right after its trigger, so the
			// browser's own Tab already goes on from there: close, keep focus moving.
			(Key::Tab, _) => {
				self.close(false);
				return;
			}
			(Key::Character(c), _) => {
				let mut chars = c.chars();
				let (Some(ch), None) = (chars.next(), chars.next()) else { return };
				let mods = e.modifiers();
				if mods.ctrl() || mods.meta() || mods.alt() {
					return;
				}
				e.prevent_default();
				let mut typed = self.typed;
				let query = typed.write().push(ch, now);
				typeahead_match(&labels, at.or_else(|| before.and_then(|b| b.checked_sub(1))), &query)
			}
			_ => return,
		};
		if let Some(to) = to {
			e.prevent_default();
			self.move_to(enabled[to].clone());
		}
	}
}

struct ListedOption {
	value: String,
	label: String,
	disabled: bool,
}

struct SelectOption {
	value: String,
	/// Lowercased by the type-ahead, not here: the label is the caller's text.
	label: String,
	disabled: bool,
	/// Set on mount, so it stays `None` under SSR and on non-web renderers.
	el: Option<Rc<MountedData>>,
}

/// Registers the calling item with its list, in render order, returning the id
/// its `onmounted` hands back. Registration happens during render, so the keys
/// already know the order before anything has mounted.
fn use_select_option(ctx: SelectCtx, option: SelectOption) -> usize {
	let id = use_hook(|| NEXT_OPTION_ID.fetch_add(1, Ordering::Relaxed));
	let mut options = ctx.options;
	// `peek` and a guarded write: no component renders from the registry, and a
	// write on every render would still dirty the signal for nothing.
	let stale = options
		.peek()
		.get(&id)
		.is_none_or(|o| o.value != option.value || o.label != option.label || o.disabled != option.disabled);
	if stale {
		let mut options = options.write();
		let el = options.remove(&id).and_then(|o| o.el);
		options.insert(id, SelectOption { el, ..option });
	}
	use_drop(move || {
		options.write().remove(&id);
	});
	id
}
static NEXT_OPTION_ID: AtomicUsize = AtomicUsize::new(0);

/// Best-effort focus: a detached element just leaves focus where it was, which
/// is why the result is dropped rather than surfaced.
fn focus(el: Rc<MountedData>) {
	spawn(async move {
		let _ = el.set_focus(true).await;
	});
}

/// Keys typed within this long of each other build one type-ahead query.
const TYPEAHEAD_MS: f64 = 500.0;

#[derive(Default)]
struct Typeahead {
	text: String,
	at: Option<f64>,
}
impl Typeahead {
	/// Whether a query is under way: something typed, within the window.
	fn is_typing(&self, now: Option<f64>) -> bool {
		!self.text.is_empty() && matches!((now, self.at), (Some(now), Some(at)) if now - at <= TYPEAHEAD_MS)
	}

	/// Adds `ch` to the query, starting a new one after a pause — or on every
	/// key where there is no clock, which still leaves a repeated letter cycling.
	fn push(&mut self, ch: char, now: Option<f64>) -> String {
		let fresh = match (now, self.at) {
			(Some(now), Some(at)) => now - at > TYPEAHEAD_MS,
			_ => true,
		};
		if fresh {
			self.text.clear();
		}
		self.text.extend(ch.to_lowercase());
		self.at = now;
		self.text.clone()
	}
}

/// The option the type-ahead `typed` lands on, from the option at `current`.
/// One letter repeated cycles through the options that start with it; a word
/// stays on the current option while it still matches. `labels` are lowercased.
fn typeahead_match(labels: &[String], current: Option<usize>, typed: &str) -> Option<usize> {
	let first = typed.chars().next()?;
	let repeated = typed.chars().all(|c| c == first);
	let query = if repeated { first.to_string() } else { typed.to_string() };
	let from = match current {
		Some(at) if repeated => at + 1,
		Some(at) => at,
		None => 0,
	};
	(0..labels.len()).map(|i| (from + i) % labels.len()).find(|&i| labels[i].trim_start().starts_with(&query))
}

/// Milliseconds on some monotonic-enough clock; `None` on bare `wasm32`
/// without `wasm`, where `SystemTime::now` panics.
fn now_ms() -> Option<f64> {
	#[cfg(all(target_arch = "wasm32", feature = "wasm"))]
	{
		Some(web_sys::js_sys::Date::now())
	}
	#[cfg(not(target_arch = "wasm32"))]
	{
		std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs_f64() * 1000.0)
	}
	#[cfg(all(target_arch = "wasm32", not(feature = "wasm")))]
	{
		None
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::{
		Dialog, DialogContent,
		test_util::{Step, render, render_after_click, render_after_keydown, render_after_keys, render_after_steps},
	};

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
	fn open_content_overlays_and_caps_height() {
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
		assert!(html.contains("absolute"), "content floats out of flow: {html}");
		assert!(html.contains("max-h-[min(24rem,calc(100dvh-2rem))]"), "height capped so overflow-y-auto engages: {html}");
		assert!(html.contains("max-w-[min(24rem,calc(100vw-2rem))]"), "width capped inside the viewport: {html}");
		assert!(html.contains("[overflow-wrap:anywhere]"), "a long option wraps: {html}");
		assert!(!html.contains("--radix-"), "no dead Radix vars: {html}");
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
		// The attribute, not the substring: the trigger's class names `[data-placeholder]` too.
		assert!(!html.contains("data-placeholder="), "value replaces placeholder: {html}");
		assert!(!html.contains(">Pick<"), "value replaces placeholder: {html}");
	}

	#[test]
	fn trigger_size_sm() {
		fn app() -> Element {
			rsx! {
				Select {
					SelectTrigger { size: Size::Sm, "x" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("h-8"), "{html}");
	}

	#[test]
	fn trigger_size_lg_matches_the_large_input() {
		fn app() -> Element {
			rsx! {
				Select {
					SelectTrigger { size: Size::Lg, "x" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("h-12"), "{html}");
		assert!(html.contains("text-base"), "{html}");
		assert!(!html.contains("text-sm"), "lg replaces the md type: {html}");
		assert!(html.contains("rounded-[var(--control-radius)]"), "{html}");
	}

	fn ch(c: &str) -> Key {
		Key::Character(c.to_string())
	}

	/// The value the trigger shows, i.e. what the keys chose.
	fn shown(html: &str) -> &str {
		let from = html.find("data-slot=\"select-value\"").expect("a select value");
		let start = from + html[from..].find('>').expect("closed tag") + 1;
		let end = start + html[start..].find('<').expect("text end");
		&html[start..end]
	}

	fn fruit() -> Element {
		rsx! {
			Select {
				SelectTrigger {
					SelectValue { placeholder: "Pick".to_string() }
				}
				SelectContent {
					SelectItem { value: "apple", "Apple" }
					SelectItem { value: "banana", "Banana" }
					SelectItem { value: "blueberry", "Blueberry" }
					SelectItem { value: "cherry", disabled: true, "Cherry" }
					SelectItem { value: "date", "Date" }
				}
			}
		}
	}

	fn fruit_open_on_banana() -> Element {
		rsx! {
			Select { default_value: "banana".to_string(), default_open: true,
				SelectTrigger {
					SelectValue { placeholder: "Pick".to_string() }
				}
				SelectContent {
					SelectItem { value: "apple", "Apple" }
					SelectItem { value: "banana", "Banana" }
					SelectItem { value: "blueberry", "Blueberry" }
				}
			}
		}
	}

	#[test]
	fn trigger_announces_a_listbox_and_controls_it_while_open() {
		let closed = render(fruit);
		assert!(closed.contains("aria-haspopup=\"listbox\""), "{closed}");
		assert!(!closed.contains("aria-controls"), "nothing to control while closed: {closed}");
		let open = render(fruit_open_on_banana);
		let id_at = open.find("aria-controls=\"").expect("aria-controls while open") + "aria-controls=\"".len();
		let id = &open[id_at..id_at + open[id_at..].find('"').unwrap_or(0)];
		assert!(!id.is_empty(), "{open}");
		assert!(open.contains(&format!("role=\"listbox\" id=\"{id}\"")), "the listbox carries the controlled id: {open}");
	}

	#[test]
	fn arrows_on_the_trigger_open_the_list() {
		for key in [Key::ArrowDown, Key::ArrowUp] {
			let html = render_after_keydown(fruit, key);
			assert!(html.contains("role=\"listbox\""), "{html}");
			assert!(html.contains("aria-expanded=\"true\""), "{html}");
		}
		let html = render_after_keydown(fruit, Key::Escape);
		assert!(!html.contains("role=\"listbox\""), "only the arrows open it: {html}");
	}

	#[test]
	fn arrows_walk_the_options_and_enter_chooses() {
		// Opening lands on the first option; one more ArrowDown is the second.
		let html = render_after_keys(fruit, &[Key::ArrowDown, Key::ArrowDown, Key::Enter]);
		assert_eq!(shown(&html), "banana", "{html}");
		assert!(!html.contains("role=\"listbox\""), "a choice closes the list: {html}");
	}

	#[test]
	fn arrows_skip_disabled_options_and_wrap() {
		let html = render_after_keys(fruit, &[Key::ArrowDown, Key::End, Key::ArrowUp, Key::Enter]);
		assert_eq!(shown(&html), "blueberry", "the disabled cherry is skipped: {html}");
		let html = render_after_keys(fruit, &[Key::ArrowDown, Key::ArrowUp, Key::Enter]);
		assert_eq!(shown(&html), "date", "ArrowUp from the first wraps to the last: {html}");
		let html = render_after_keys(fruit, &[Key::ArrowDown, Key::End, Key::ArrowDown, Key::Enter]);
		assert_eq!(shown(&html), "apple", "ArrowDown from the last wraps to the first: {html}");
		let html = render_after_keys(fruit, &[Key::ArrowDown, Key::End, Key::Home, Key::Enter]);
		assert_eq!(shown(&html), "apple", "{html}");
	}

	#[test]
	fn opening_lands_on_the_chosen_option() {
		let html = render_after_keys(fruit_open_on_banana, &[Key::ArrowDown, Key::Enter]);
		assert_eq!(shown(&html), "blueberry", "{html}");
	}

	#[test]
	fn space_chooses_like_enter() {
		let html = render_after_keys(fruit, &[Key::ArrowDown, Key::ArrowDown, ch(" ")]);
		assert_eq!(shown(&html), "banana", "{html}");
		assert!(!html.contains("role=\"listbox\""), "{html}");
	}

	#[test]
	fn typeahead_finds_by_letters() {
		let html = render_after_keys(fruit, &[Key::ArrowDown, ch("b"), Key::Enter]);
		assert_eq!(shown(&html), "banana", "{html}");
		let html = render_after_keys(fruit, &[Key::ArrowDown, ch("b"), ch("b"), Key::Enter]);
		assert_eq!(shown(&html), "blueberry", "a repeated letter cycles: {html}");
		let html = render_after_keys(fruit, &[Key::ArrowDown, ch("b"), ch("l"), Key::Enter]);
		assert_eq!(shown(&html), "blueberry", "letters build a word: {html}");
		let html = render_after_keys(fruit, &[Key::ArrowDown, ch("c"), Key::Enter]);
		assert_eq!(shown(&html), "apple", "a disabled option is not a match: {html}");
	}

	#[test]
	fn escape_and_tab_close_without_choosing() {
		for key in [Key::Escape, Key::Tab] {
			let html = render_after_keydown(fruit_open_on_banana, key);
			assert!(!html.contains("role=\"listbox\""), "{html}");
			assert_eq!(shown(&html), "banana", "{html}");
		}
	}

	#[test]
	fn disabled_option_is_marked_and_not_chosen_by_click() {
		fn app() -> Element {
			rsx! {
				Select { default_open: true,
					SelectTrigger {
						SelectValue { placeholder: "Pick".to_string() }
					}
					SelectContent {
						SelectItem { value: "cherry", disabled: true, "Cherry" }
					}
				}
			}
		}
		assert!(render(app).contains("aria-disabled=\"true\""));
		let html = render_after_click(app);
		assert_eq!(shown(&html), "Pick", "{html}");
	}

	fn select_in_dialog() -> Element {
		rsx! {
			Dialog { default_open: true,
				DialogContent { show_close_button: false,
					Select { default_open: true,
						SelectTrigger {
							SelectValue { placeholder: "Pick".to_string() }
						}
						SelectContent {
							SelectItem { value: "a", "A" }
						}
					}
				}
			}
		}
	}

	#[test]
	fn escape_closes_only_the_top_layer() {
		let html = render_after_keydown(select_in_dialog, Key::Escape);
		assert!(!html.contains("role=\"listbox\""), "the list closes: {html}");
		assert!(html.contains("role=\"dialog\""), "the dialog below stays: {html}");
		let html = render_after_keys(select_in_dialog, &[Key::Escape, Key::Escape]);
		assert!(!html.contains("role=\"dialog\""), "the next Escape is the dialog's: {html}");
	}

	#[test]
	fn a_click_outside_closes_only_the_top_layer() {
		let html = render_after_click(select_in_dialog);
		assert!(!html.contains("role=\"listbox\""), "{html}");
		assert!(html.contains("role=\"dialog\""), "the dialog's scrim hands the click to the list: {html}");
	}

	#[test]
	fn typeahead_query_restarts_after_a_pause() {
		let mut t = Typeahead::default();
		assert_eq!(t.push('B', Some(0.0)), "b");
		assert_eq!(t.push('l', Some(100.0)), "bl");
		assert_eq!(t.push('c', Some(700.0)), "c");
		assert_eq!(t.push('h', None), "h", "no clock: every key starts afresh");
	}

	#[test]
	fn typeahead_match_cycles_a_repeated_letter_and_holds_a_word() {
		let labels: Vec<String> = ["apple", "banana", "blueberry", "date"].map(String::from).to_vec();
		assert_eq!(typeahead_match(&labels, None, "b"), Some(1));
		assert_eq!(typeahead_match(&labels, Some(1), "bb"), Some(2));
		assert_eq!(typeahead_match(&labels, Some(2), "b"), Some(1), "wraps past the end");
		assert_eq!(typeahead_match(&labels, Some(1), "ba"), Some(1), "a word stays while it matches");
		assert_eq!(typeahead_match(&labels, Some(0), "z"), None);
	}

	#[test]
	fn a_focused_disabled_option_is_not_chosen_by_enter() {
		fn app() -> Element {
			rsx! {
				Select { default_open: true,
					SelectTrigger {
						SelectValue { placeholder: "Pick".to_string() }
					}
					SelectContent {
						SelectItem { value: "apple", "Apple" }
						SelectItem { value: "banana", disabled: true, "Banana" }
					}
				}
			}
		}
		// A click on a disabled row still focuses it; the sweep focuses it last.
		for key in [Key::Enter, ch(" ")] {
			let html = render_after_steps(app, &[Step::Focus, Step::Key(key)]);
			assert_eq!(shown(&html), "Pick", "nothing is chosen, not even the option focused before: {html}");
			assert!(html.contains("role=\"listbox\""), "the list stays open: {html}");
		}
	}

	#[test]
	fn arrows_go_on_from_a_focused_disabled_option() {
		fn app() -> Element {
			rsx! {
				Select { default_open: true,
					SelectTrigger {
						SelectValue { placeholder: "Pick".to_string() }
					}
					SelectContent {
						SelectItem { value: "apple", "Apple" }
						SelectItem { value: "cherry", "Cherry" }
						SelectItem { value: "banana", disabled: true, "Banana" }
					}
				}
			}
		}
		// The sweep focuses Cherry, then the disabled Banana last.
		let html = render_after_steps(app, &[Step::Focus, Step::Key(Key::ArrowUp), Step::Key(Key::Enter)]);
		assert_eq!(shown(&html), "cherry", "up from Banana is Cherry: {html}");
		let html = render_after_steps(app, &[Step::Focus, Step::Key(Key::ArrowDown), Step::Key(Key::Enter)]);
		assert_eq!(shown(&html), "apple", "down from the last wraps: {html}");
	}

	#[test]
	fn closing_from_outside_lets_the_next_open_land_again() {
		fn app() -> Element {
			let mut open = use_signal(|| false);
			rsx! {
				// Stands in for the caller closing the list through its own state.
				div {
					onkeydown: move |e| {
						if e.key() == Key::F2 {
							open.set(false);
						}
					},
				}
				Select { open: open(), on_open_change: move |v| open.set(v),
					SelectTrigger {
						SelectValue { placeholder: "Pick".to_string() }
					}
					SelectContent {
						SelectItem { value: "apple", "Apple" }
						SelectItem { value: "banana", "Banana" }
					}
				}
			}
		}
		let steps = [Step::Key(Key::ArrowDown), Step::Focus, Step::Key(Key::F2), Step::Key(Key::ArrowDown), Step::Key(Key::Enter)];
		let html = render_after_steps(app, &steps);
		assert_eq!(shown(&html), "apple", "the reopened list lands on the first option, not the stale one: {html}");
	}

	#[test]
	fn space_inside_a_typeahead_query_is_part_of_it() {
		fn app() -> Element {
			rsx! {
				Select {
					SelectTrigger {
						SelectValue { placeholder: "Pick".to_string() }
					}
					SelectContent {
						SelectItem { value: "apple", "Apple" }
						SelectItem { value: "uk", "United Kingdom" }
						SelectItem { value: "us", "United States" }
					}
				}
			}
		}
		let mut keys = vec![Key::ArrowDown];
		keys.extend("united s".chars().map(|c| ch(&c.to_string())));
		keys.push(Key::Enter);
		let html = render_after_keys(app, &keys);
		assert_eq!(shown(&html), "us", "{html}");
	}
}
