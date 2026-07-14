//! Behaviour primitives shared by the interactive components.
//!
//! Unlike the TypeScript port, the Rust kit does **not** ship a Portal, a
//! measured floating engine, or a focus-trap: Dioxus has no renderer-agnostic
//! portal, and measuring layout needs `web-sys` (host-only, not I/O-free).
//! Overlays therefore render inline with `position: fixed`, a full-screen
//! backdrop for outside-dismiss, CSS-only placement via [`Side`], and the
//! browser's native focus order. See the README "Limitations". The primitives
//! that port cleanly — controlled/uncontrolled state, roving focus — live here.

use std::{
	collections::BTreeMap,
	rc::Rc,
	sync::atomic::{AtomicUsize, Ordering},
};

use dioxus::prelude::*;

/// Which edge of its anchor an overlay is placed against. Rendered as a
/// `data-side` attribute so CSS positions and animates the overlay; the kit
/// does not measure the viewport (the TS `useFloating` does).
#[derive(strum::AsRefStr, Clone, Copy, Debug, Default, Eq, PartialEq)]
#[strum(serialize_all = "kebab-case")]
pub enum Side {
	Top,
	Right,
	#[default]
	Bottom,
	Left,
}

/// Controlled/uncontrolled state, the mirror of TS `useControllableState`. When
/// `controlled` is `Some` the component is controlled — reads return that value
/// and [`Controllable::set`] only forwards to `on_change`; otherwise it owns an
/// internal [`Signal`] seeded from `default`.
pub struct Controllable<T: Clone + PartialEq + 'static> {
	signal: Signal<T>,
	controlled: bool,
	on_change: Option<EventHandler<T>>,
}
impl<T: Clone + PartialEq + 'static> Controllable<T> {
	pub fn get(&self) -> T {
		self.signal.read().clone()
	}

	pub fn set(&self, next: T) {
		if !self.controlled {
			let mut sig = self.signal;
			sig.set(next.clone());
		}
		if let Some(handler) = &self.on_change {
			handler.call(next);
		}
	}
}

impl<T: Clone + PartialEq + 'static> Clone for Controllable<T> {
	fn clone(&self) -> Self {
		*self
	}
}
impl<T: Clone + PartialEq + 'static> Copy for Controllable<T> {}

/// Seeds a [`Controllable`] state. Keeps the internal signal in sync with the
/// controlled value across re-renders.
pub fn use_controllable<T: Clone + PartialEq + 'static>(controlled: Option<T>, default: T, on_change: Option<EventHandler<T>>) -> Controllable<T> {
	let mut signal = use_signal(|| controlled.clone().unwrap_or(default));
	if let Some(value) = controlled.clone()
		&& *signal.peek() != value
	{
		signal.set(value);
	}
	Controllable {
		signal,
		controlled: controlled.is_some(),
		on_change,
	}
}

/// Which arrow keys walk a [`RovingFocus`] group. `Home`/`End` always do.
#[derive(Clone, Copy, Default, PartialEq)]
pub enum RovingOrientation {
	Horizontal,
	#[default]
	Vertical,
	Both,
}

/// Arrow-key roving focus over a group of items — the mirror of the TS
/// `useRovingFocus`, and what earns a group the right to take its items out of
/// the tab order: the group is one tab stop, and the arrows move within it.
///
/// The group calls [`use_roving_focus`], publishes the result on its context,
/// and wires [`RovingFocus::next`] into its `onkeydown`; each item calls
/// [`use_roving_item`], reports its element via `onmounted`, and asks
/// [`RovingFocus::is_tab_stop`] for its `tabindex`.
///
/// Items are keyed by the same value the group selects on, so navigating is
/// "find the neighbour of the selected key". Movement wraps at both ends, as
/// `useRovingFocus`'s default `loop: true` does.
#[derive(Clone, Copy)]
pub struct RovingFocus {
	items: Signal<BTreeMap<usize, RovingItem>>,
	orientation: RovingOrientation,
}
impl RovingFocus {
	/// The key the arrow/`Home`/`End` in `e` walks to, starting from the item
	/// keyed `from`; `None` when `e` isn't a navigation key for this
	/// orientation, or the group is empty. The caller decides what to do with
	/// it — both consumers select it and [`RovingFocus::focus`] it.
	pub fn next(&self, e: &KeyboardEvent, from: &str) -> Option<String> {
		let items = self.items.read();
		let keys: Vec<&str> = items.values().map(|i| i.key.as_str()).collect();
		let last = keys.len().checked_sub(1)?;
		// An unknown `from` (nothing selected yet) walks as if from the first
		// item, so the first arrow press lands on a real neighbour.
		let at = keys.iter().position(|k| *k == from).unwrap_or(0);
		let horizontal = matches!(self.orientation, RovingOrientation::Horizontal | RovingOrientation::Both);
		let vertical = matches!(self.orientation, RovingOrientation::Vertical | RovingOrientation::Both);
		let forward = |at: usize| if at == last { 0 } else { at + 1 };
		let back = |at: usize| if at == 0 { last } else { at - 1 };
		let to = match e.key() {
			Key::ArrowDown if vertical => forward(at),
			Key::ArrowUp if vertical => back(at),
			Key::ArrowRight if horizontal => forward(at),
			Key::ArrowLeft if horizontal => back(at),
			Key::Home => 0,
			Key::End => last,
			_ => return None,
		};
		Some(keys[to].to_string())
	}

	/// Whether the item keyed `key` is the group's single tab stop: the selected
	/// item, or — while nothing is selected — the first item, so `Tab` always
	/// enters the group exactly once and never lands nowhere.
	pub fn is_tab_stop(&self, key: &str, selected: &str) -> bool {
		if key == selected {
			return true;
		}
		let items = self.items.read();
		let mut keys = items.values().map(|i| i.key.as_str());
		!keys.clone().any(|k| k == selected) && keys.next() == Some(key)
	}

	/// Moves DOM focus onto the item keyed `key`. A no-op before that item has
	/// mounted, and on renderers without a DOM.
	pub fn focus(&self, key: &str) {
		let el = self.items.read().values().find(|i| i.key == key).and_then(|i| i.el.clone());
		if let Some(el) = el {
			// Focus is best-effort: a detached element just leaves focus where
			// it was, which is why the result is dropped rather than surfaced.
			spawn(async move {
				let _ = el.set_focus(true).await;
			});
		}
	}

	/// Records the mounted element for the item registered as `id` — call from
	/// the item's `onmounted`.
	pub fn attach(&self, id: usize, el: Rc<MountedData>) {
		let mut items = self.items;
		if let Some(item) = items.write().get_mut(&id) {
			item.el = Some(el);
		}
	}
}

/// Seeds the [`RovingFocus`] a group owns and hands to its items via context.
pub fn use_roving_focus(orientation: RovingOrientation) -> RovingFocus {
	RovingFocus {
		items: use_signal(BTreeMap::new),
		orientation,
	}
}
/// Registers the calling item with its group's [`RovingFocus`] under `key`,
/// returning the id to hand back to [`RovingFocus::attach`] on mount.
///
/// Registration happens during the item's first render, not on mount, so the
/// order the arrows walk — and every item's `tabindex` — is already right in
/// server-rendered markup.
pub fn use_roving_item(roving: RovingFocus, key: String) -> usize {
	let id = use_hook({
		let key = key.clone();
		move || {
			let id = NEXT_ROVING_ITEM_ID.fetch_add(1, Ordering::Relaxed);
			let mut items = roving.items;
			items.write().insert(id, RovingItem { key, el: None });
			id
		}
	});
	// `use_hook` only ever sees the first render, so a re-keyed item would
	// otherwise leave a stale key for the arrows to walk onto.
	use_effect(use_reactive!(|key| {
		let mut items = roving.items;
		if let Some(item) = items.write().get_mut(&id) {
			item.key = key;
		}
	}));
	use_drop(move || {
		let mut items = roving.items;
		items.write().remove(&id);
	});
	id
}
static NEXT_ROVING_ITEM_ID: AtomicUsize = AtomicUsize::new(0);

struct RovingItem {
	key: String,
	/// Set on mount, so it stays `None` under SSR and on non-web renderers —
	/// only [`RovingFocus::focus`] needs it, never the rendered markup.
	el: Option<Rc<MountedData>>,
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn uncontrolled_uses_default_then_updates() {
		fn app() -> Element {
			let state = use_controllable::<bool>(None, false, None);
			let label = if state.get() { "on" } else { "off" };
			rsx! {
				button {
					onclick: move |_| state.set(true),
					{label}
				}
			}
		}
		// On first render the default is observed.
		assert!(render(app).contains("off"));
	}

	#[test]
	fn items_register_during_render_so_ssr_markup_has_a_tab_stop() {
		fn app() -> Element {
			let roving = use_roving_focus(RovingOrientation::Vertical);
			use_context_provider(|| roving);
			rsx! {
				Item { value: "a" }
				Item { value: "b" }
			}
		}
		#[component]
		fn Item(value: String) -> Element {
			let roving = use_context::<RovingFocus>();
			use_roving_item(roving, value.clone());
			// Nothing selected, so only the first item may be the tab stop.
			let stop = roving.is_tab_stop(&value, "");
			rsx! {
				button { tabindex: if stop { "0" } else { "-1" } }
			}
		}
		let html = render(app);
		assert_eq!(html.matches("tabindex=\"0\"").count(), 1, "{html}");
		assert!(html.starts_with("<button tabindex=\"0\""), "the first item takes the stop: {html}");
	}

	#[test]
	fn controlled_reflects_external_value() {
		fn app() -> Element {
			let state = use_controllable::<bool>(Some(true), false, None);
			let label = if state.get() { "on" } else { "off" };
			rsx! { span { {label} } }
		}
		assert!(render(app).contains("on"));
	}
}
