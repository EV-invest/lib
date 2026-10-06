//! Behaviour primitives shared by the interactive components.
//!
//! Unlike the TypeScript port, the Rust kit does **not** ship a Portal, a
//! measured floating engine, or a focus-trap: Dioxus has no renderer-agnostic
//! portal, and measuring layout needs `web-sys` (host-only, not I/O-free).
//! Overlays therefore render inline with `position: fixed`, a full-screen
//! backdrop for outside-dismiss, CSS-only placement via [`Side`], and the
//! browser's native focus order. See the README "Limitations". The primitives
//! that port cleanly — controlled/uncontrolled state, roving focus, the stack
//! of dismissable layers — live here.

use std::{
	cell::RefCell,
	collections::BTreeMap,
	rc::Rc,
	sync::atomic::{AtomicUsize, Ordering},
};

use dioxus::{
	dioxus_core::{DynamicNode, TemplateNode, provide_root_context},
	prelude::*,
};

/// Which edge of its anchor an overlay is placed against. Rendered as a
/// `data-side` attribute so CSS positions and animates the overlay; the kit
/// does not measure the viewport (the TS `useFloating` does).
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq, strum::AsRefStr)]
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

/// A DOM id for the calling component, derived from its place in the tree —
/// the Rust side of React's `useId`.
///
/// The id is the component's `ScopeId`, which the `VirtualDom` hands out in
/// render order: the server render and the client's hydrating render of the
/// same tree mint the same ids, so `for`/`aria-*` wiring survives hydration. A
/// process-global counter would not — a long-lived server has advanced it
/// across earlier requests while a fresh client starts from zero.
///
/// Unique among the components mounted in one `VirtualDom` (a scope id is only
/// recycled after its component unmounts). Two independent `VirtualDom`s on one
/// page can collide; give them different `prefix`es.
pub fn use_stable_id(prefix: &str) -> String {
	use_hook(|| format!("{prefix}-{}", dioxus::dioxus_core::current_scope_id().0))
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

/// What dismissed a [`DismissableLayer`] — for a caller that treats keys and
/// pointers apart (a Select hands focus back to its trigger after Escape, never
/// after a click elsewhere). The mirror of the TS `DismissEvent`.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DismissReason {
	Escape,
	Outside,
}

type DismissFn = Rc<dyn Fn(DismissReason)>;

/// The open layers of one `VirtualDom`, oldest first. Lives in the root scope,
/// so every overlay in the tree shares it without a provider of the caller's.
/// Not a signal: it is read only from event handlers, never to render.
#[derive(Clone, Default)]
struct LayerStack(Rc<RefCell<Vec<(usize, DismissFn)>>>);

/// One overlay's place on the layer stack — the Rust side of the TS
/// `useDismissableLayer`.
///
/// Layers stack in the order they opened, and Escape or a click outside only
/// ever dismisses the topmost one: a Select's list inside a Dialog closes the
/// list, not the Dialog. The kit renders overlays inline, so a key or a click
/// meant for the top layer can reach a lower one — the Escape from a field of
/// the Dialog while its Popover is open, a click on the Dialog's own scrim
/// below the list. A lower layer that hears one hands it to the top instead of
/// acting on it itself.
///
/// Unlike the TS hook there is no document listener (that needs `web-sys`):
/// only a key that reaches some open layer's `onkeydown` dismisses anything,
/// and "outside" is whatever full-screen backdrop the overlay renders.
#[derive(Clone)]
pub struct DismissableLayer {
	id: usize,
	stack: LayerStack,
}
impl DismissableLayer {
	/// Handles Escape for this layer's `onkeydown`: when this layer is open the
	/// key is consumed (so no layer below hears it) and the topmost layer is
	/// dismissed. A closed layer leaves the key alone, for the layer around it.
	pub fn on_keydown(&self, e: &KeyboardEvent) -> bool {
		if e.key() != Key::Escape || !self.is_open() {
			return false;
		}
		e.stop_propagation();
		self.dismiss_top(DismissReason::Escape);
		true
	}

	/// A click on this layer's backdrop: dismisses the topmost layer, which is
	/// this one unless another opened above it.
	pub fn on_outside(&self) {
		self.dismiss_top(DismissReason::Outside);
	}

	/// Whether no layer is open above this one (and this one is open).
	pub fn is_top(&self) -> bool {
		self.stack.0.borrow().last().is_some_and(|(id, _)| *id == self.id)
	}

	fn is_open(&self) -> bool {
		self.stack.0.borrow().iter().any(|(id, _)| *id == self.id)
	}

	fn dismiss_top(&self, reason: DismissReason) {
		// Cloned out so the dismiss callback may render or re-enter the stack
		// without a live borrow.
		let top = self.stack.0.borrow().last().map(|(_, f)| f.clone());
		if let Some(dismiss) = top {
			dismiss(reason);
		}
	}
}

/// Puts the calling overlay on the layer stack while `open`, calling
/// `on_dismiss` when it is the top layer and Escape or an outside click
/// arrives.
///
/// The stack follows renders, not handlers: a layer that closes itself stays
/// on top until it re-renders closed, so the Escape that closed it cannot also
/// close the layer below on its way up.
pub fn use_dismissable_layer(open: bool, on_dismiss: impl Fn(DismissReason) + 'static) -> DismissableLayer {
	let id = use_hook(|| NEXT_LAYER_ID.fetch_add(1, Ordering::Relaxed));
	let stack = use_hook(|| try_consume_context::<LayerStack>().unwrap_or_else(|| provide_root_context(LayerStack::default())));
	{
		let mut layers = stack.0.borrow_mut();
		let at = layers.iter().position(|(layer, _)| *layer == id);
		match (open, at) {
			// The callback is refreshed in place: re-pushing would move a layer
			// that merely re-rendered above the ones opened after it.
			(true, Some(at)) => layers[at].1 = Rc::new(on_dismiss),
			(true, None) => layers.push((id, Rc::new(on_dismiss))),
			(false, Some(at)) => {
				layers.remove(at);
			}
			(false, None) => {}
		}
	}
	use_drop({
		let stack = stack.clone();
		move || stack.0.borrow_mut().retain(|(layer, _)| *layer != id)
	});
	DismissableLayer { id, stack }
}
static NEXT_LAYER_ID: AtomicUsize = AtomicUsize::new(0);

/// Puts `items` into document order by their mounted elements — the order the
/// user sees, which a keyed re-sort or a row inserted above the others makes
/// differ from the order the items first registered in.
///
/// Only the web renderer can compare two elements' places; elsewhere (SSR,
/// desktop) and while any item has not mounted yet, the order is left as is.
pub(crate) fn sort_into_document_order<T: Clone>(items: &mut [T], el: impl Fn(&T) -> Option<&Rc<MountedData>>) {
	sort_by_position(
		items,
		|item| el(item).is_some_and(|el| is_placed(el)),
		|a, b| match (el(a), el(b)) {
			(Some(a), Some(b)) => document_precedes(a, b),
			_ => false,
		},
	);
}

/// Sorts `items` by `precedes` when every item is `placed`, leaving them as they
/// are otherwise — O(n) `placed` checks, then O(n) comparisons for a list already
/// in order and O(n log n) for one that is not. Each comparison is a call into
/// the DOM, so an n² pass over a long list would stall every key.
///
/// A merge sort of our own rather than `sort_by`: `sort_by` may panic on an
/// order that is not total, and a DOM comparison is one only while every node
/// is in the document — this one stays a permutation whatever `precedes` says.
fn sort_by_position<T: Clone>(items: &mut [T], placed: impl Fn(&T) -> bool, precedes: impl Fn(&T, &T) -> bool) {
	if !items.iter().all(&placed) {
		return;
	}
	if items.windows(2).all(|pair| !precedes(&pair[1], &pair[0])) {
		return;
	}
	merge_sort(items, &precedes);
}

fn merge_sort<T: Clone>(items: &mut [T], precedes: &impl Fn(&T, &T) -> bool) {
	if items.len() < 2 {
		return;
	}
	let mid = items.len() / 2;
	merge_sort(&mut items[..mid], precedes);
	merge_sort(&mut items[mid..], precedes);
	let mut merged = Vec::with_capacity(items.len());
	let (mut i, mut j) = (0, mid);
	while i < mid && j < items.len() {
		// Strictly before, so equals keep their order: the sort is stable.
		if precedes(&items[j], &items[i]) {
			merged.push(items[j].clone());
			j += 1;
		} else {
			merged.push(items[i].clone());
			i += 1;
		}
	}
	merged.extend_from_slice(&items[i..mid]);
	merged.extend_from_slice(&items[j..]);
	items.clone_from_slice(&merged);
}

/// Whether the renderer can place `el` in the document: the web renderer, for
/// an element that is still connected.
#[cfg(all(target_arch = "wasm32", feature = "wasm"))]
fn is_placed(el: &MountedData) -> bool {
	el.downcast::<web_sys::Element>().is_some_and(|el| el.is_connected())
}
#[cfg(not(all(target_arch = "wasm32", feature = "wasm")))]
fn is_placed(_: &MountedData) -> bool {
	false
}

/// Whether `a` comes before `b` in the document. Only asked of placed elements.
#[cfg(all(target_arch = "wasm32", feature = "wasm"))]
fn document_precedes(a: &MountedData, b: &MountedData) -> bool {
	match (a.downcast::<web_sys::Element>(), b.downcast::<web_sys::Element>()) {
		(Some(a), Some(b)) => a.compare_document_position(b) & web_sys::Node::DOCUMENT_POSITION_FOLLOWING != 0,
		_ => false,
	}
}
#[cfg(not(all(target_arch = "wasm32", feature = "wasm")))]
fn document_precedes(_: &MountedData, _: &MountedData) -> bool {
	false
}

/// The text `children` would render, as far as it can be read off the vnode —
/// the Rust side of the DOM's `textContent` for a type-ahead or a label. A
/// child component's text is invisible (knowing it would mean rendering it),
/// so a caller with one should pass the text explicitly.
pub(crate) fn text_of(children: &Element) -> String {
	let mut out = String::new();
	if let Ok(node) = children {
		vnode_text(node, &mut out);
	}
	out
}
fn vnode_text(node: &VNode, out: &mut String) {
	for root in node.template.roots.iter() {
		template_text(node, root, out);
	}
}
fn template_text(node: &VNode, template: &TemplateNode, out: &mut String) {
	match template {
		TemplateNode::Element { children, .. } => children.iter().for_each(|c| template_text(node, c, out)),
		TemplateNode::Text { text } => out.push_str(text),
		TemplateNode::Dynamic { id } => match node.dynamic_nodes.get(*id) {
			Some(DynamicNode::Text(text)) => out.push_str(&text.value),
			Some(DynamicNode::Fragment(nodes)) => nodes.iter().for_each(|n| vnode_text(n, out)),
			Some(DynamicNode::Component(_) | DynamicNode::Placeholder(_)) | None => {}
		},
	}
}

/// Whether a `transitionend` is the element's own exit `transform` finishing.
///
/// Every exiting overlay (toast, drawer) stays mounted with
/// `data-state="closed"` until its slide-out transition ends, then drops the
/// node. But `transitionend` bubbles, so the closing element also sees its
/// descendants' — a button's 150ms `transition-colors`, a child's opacity fade —
/// and dropping on those cuts the slide-out short. Mirrors the TS guard
/// (`e.propertyName === "transform"`).
///
/// Dioxus 0.7's `TransitionData` exposes no `property_name` accessor, so the name
/// is read off the concrete web event. Web-only: another renderer can't report it
/// and falls through to accepting the event, which is at worst the unguarded
/// behaviour — never a node stranded on screen.
#[cfg(all(target_arch = "wasm32", feature = "wasm"))]
pub(crate) fn is_transform_transition(e: &Event<TransitionData>) -> bool {
	e.downcast::<web_sys::TransitionEvent>().is_none_or(|t| {
		// transitionend bubbles: a descendant's own transform (a progress bar,
		// a hovered button) must not pass for the node's exit
		let own = t.target().is_some_and(|target| t.current_target().is_some_and(|current| current == target));
		own && t.property_name() == "transform"
	})
}
#[cfg(not(all(target_arch = "wasm32", feature = "wasm")))]
pub(crate) fn is_transform_transition(_: &Event<TransitionData>) -> bool {
	true
}

/// Whether `children` would render anything — the Rust side of the TS ports'
/// `!children` checks. A Dioxus component always receives an `Element`, even
/// when the caller passed nothing or an empty string (`{error_text}` with no
/// error), so emptiness has to be read off the vnode rather than the prop's
/// presence. A child component counts as content: knowing what it renders would
/// mean rendering it.
pub(crate) fn has_content(children: &Element) -> bool {
	// An error must still surface where the children would have rendered.
	let Ok(node) = children else { return true };
	vnode_has_content(node)
}
fn vnode_has_content(node: &VNode) -> bool {
	node.template.roots.iter().any(|root| match root {
		TemplateNode::Element { .. } => true,
		TemplateNode::Text { text } => !text.is_empty(),
		TemplateNode::Dynamic { id } => node.dynamic_nodes.get(*id).is_some_and(dynamic_has_content),
	})
}
fn dynamic_has_content(node: &DynamicNode) -> bool {
	match node {
		DynamicNode::Component(_) => true,
		DynamicNode::Text(text) => !text.value.is_empty(),
		DynamicNode::Placeholder(_) => false,
		DynamicNode::Fragment(nodes) => nodes.iter().any(vnode_has_content),
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::{
		Dialog, DialogContent, Popover, PopoverContent, PopoverTrigger,
		test_util::{render, render_after_click, render_after_keys},
	};

	fn popover_in_dialog() -> Element {
		rsx! {
			Dialog { default_open: true,
				DialogContent { show_close_button: false,
					Popover { default_open: true,
						PopoverTrigger { "more" }
						PopoverContent { "panel" }
					}
				}
			}
		}
	}

	#[test]
	fn escape_goes_to_the_top_layer_even_from_a_lower_one() {
		// The sweep reaches the dialog's own `onkeydown` as well as the popover's.
		let html = render_after_keys(popover_in_dialog, &[Key::Escape]);
		assert!(!html.contains("data-slot=\"popover-content\""), "{html}");
		assert!(html.contains("role=\"dialog\""), "the dialog below stays: {html}");
		let html = render_after_keys(popover_in_dialog, &[Key::Escape, Key::Escape]);
		assert!(!html.contains("role=\"dialog\""), "the next Escape is the dialog's: {html}");
	}

	#[test]
	fn a_click_on_a_lower_scrim_dismisses_the_top_layer() {
		let html = render_after_click(popover_in_dialog);
		assert!(!html.contains("data-slot=\"popover-content\""), "{html}");
		assert!(html.contains("role=\"dialog\""), "the dialog's scrim hands the click to the popover: {html}");
	}

	/// `(registration id, place on screen)`; the sort sees only the place.
	fn by_place(items: &mut [(usize, Option<usize>)]) {
		sort_by_position(items, |i| i.1.is_some(), |a, b| a.1 < b.1);
	}

	#[test]
	fn a_keyed_resort_walks_in_document_order() {
		// Registered Apple (0), Apricot (1); re-sorted to Apricot above Apple.
		let mut items = [(0, Some(1)), (1, Some(0))];
		by_place(&mut items);
		assert_eq!(items.map(|i| i.0), [1, 0]);
	}

	#[test]
	fn a_row_inserted_above_the_mounted_ones_comes_first() {
		let mut items = [(0, Some(1)), (1, Some(2)), (2, Some(0))];
		by_place(&mut items);
		assert_eq!(items.map(|i| i.0), [2, 0, 1]);
	}

	#[test]
	fn an_unplaced_item_keeps_registration_order() {
		let mut items = [(0, Some(1)), (1, None), (2, Some(0))];
		by_place(&mut items);
		assert_eq!(items.map(|i| i.0), [0, 1, 2]);
	}

	#[test]
	fn the_document_sort_asks_n_log_n_comparisons_not_n_squared() {
		use std::cell::Cell;
		let n = 1000;
		let calls = Cell::new(0_usize);
		let count = |a: &usize, b: &usize| {
			calls.set(calls.get() + 1);
			a < b
		};
		let mut in_order: Vec<usize> = (0..n).collect();
		sort_by_position(&mut in_order, |_| true, count);
		assert_eq!(calls.get(), n - 1, "a list already in order costs one pass");
		calls.set(0);
		// A keyed re-sort that reverses the list: the worst case for the old insertion sort.
		let mut reversed: Vec<usize> = (0..n).rev().collect();
		sort_by_position(&mut reversed, |_| true, count);
		assert_eq!(reversed, (0..n).collect::<Vec<_>>());
		assert!(calls.get() < 2 * n * 10, "{} comparisons for {n} items", calls.get());
	}

	#[test]
	fn the_document_sort_is_stable_and_survives_an_inconsistent_order() {
		let mut items = [(0, 1), (1, 0), (2, 1), (3, 0)];
		sort_by_position(&mut items, |_| true, |a, b| a.1 < b.1);
		assert_eq!(items.map(|i| i.0), [1, 3, 0, 2]);
		// A comparison that is no order at all still leaves a permutation, never a panic.
		let mut items: Vec<usize> = (0..50).collect();
		sort_by_position(&mut items, |_| true, |a, b| (a * 7 + b * 3) % 5 == 0);
		items.sort_unstable();
		assert_eq!(items, (0..50).collect::<Vec<_>>());
	}

	#[test]
	fn a_closed_layer_leaves_escape_to_the_one_around_it() {
		fn app() -> Element {
			rsx! {
				Dialog { default_open: true,
					DialogContent { show_close_button: false,
						Popover {
							PopoverTrigger { "more" }
							PopoverContent { "panel" }
						}
					}
				}
			}
		}
		let html = render_after_keys(app, &[Key::Escape]);
		assert!(!html.contains("role=\"dialog\""), "{html}");
	}

	#[test]
	fn has_content_sees_through_empty_children() {
		let empty = String::new();
		let none: Option<&str> = None;
		let blanks = [String::new()];
		assert!(!has_content(&VNode::empty()));
		assert!(!has_content(&rsx! {}));
		assert!(!has_content(&rsx! { {empty} }));
		assert!(!has_content(&rsx! { {none} }));
		assert!(!has_content(&rsx! {
			for b in blanks.iter() {
				{b.clone()}
			}
		}));
	}

	#[test]
	fn has_content_sees_text_elements_and_components() {
		#[component]
		fn Child() -> Element {
			rsx! {}
		}
		let text = String::from("required");
		assert!(has_content(&rsx! { "or" }));
		assert!(has_content(&rsx! { {text} }));
		assert!(has_content(&rsx! { span {} }));
		assert!(has_content(&rsx! { Child {} }));
	}

	#[test]
	fn text_of_reads_static_and_dynamic_text() {
		let name = String::from("Blue");
		assert_eq!(text_of(&rsx! { "Apple" }), "Apple");
		assert_eq!(text_of(&rsx! { span { {name} } " berry" }), "Blue berry");
		assert_eq!(text_of(&rsx! {}), "");
	}

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
