use std::rc::Rc;

use dioxus::{
	dioxus_core::{Mutation, Mutations},
	html::{
		PlatformEventData, SerializedFormData,
		input_data::keyboard_types::{Code, Location, Modifiers},
	},
	prelude::*,
};

/// Upper bound for the event sweeps — larger than any component tree the uikit
/// tests build.
const MAX_ELEMENTS: usize = 32;
/// Renders a component to a static HTML string via `dioxus-ssr`, so tests can
/// assert on the emitted classes and structure without a browser.
pub fn render(app: fn() -> Element) -> String {
	let mut dom = VirtualDom::new(app);
	dom.rebuild_in_place();
	dioxus_ssr::render(&dom)
}

/// Renders once effects have run. `rebuild_in_place` leaves them queued, so a
/// component that registers itself through `use_effect` is invisible to plain
/// [`render`]; `render_immediate` runs them and re-renders whoever they dirtied.
pub fn render_with_effects(app: fn() -> Element) -> String {
	let mut dom = VirtualDom::new(app);
	dom.rebuild_in_place();
	// Twice: the first pass runs the effects, the second lets whatever they
	// dirtied settle.
	for _ in 0..2 {
		dom.render_immediate(&mut dioxus::dioxus_core::NoOpMutations);
	}
	dioxus_ssr::render(&dom)
}

/// Fires a `click` at every mounted element, so a test can assert that a
/// handler ran without hardcoding a brittle `ElementId`. The component's own
/// handlers record the hits.
pub fn click_every_element(app: fn() -> Element) {
	let mut dom = mount(app);
	sweep(&mut dom, "click", || Box::new(dioxus::html::SerializedMouseData::default()));
}

/// Fires a `click` at every mounted element in mount order, then renders — so a
/// test can assert the state a sequence of presses left behind. No render runs
/// between clicks; a handler that reads its state at click time (a signal, not
/// a value captured at render) still sees the earlier presses.
pub fn render_after_click(app: fn() -> Element) -> String {
	let mut dom = mount(app);
	sweep(&mut dom, "click", || Box::new(dioxus::html::SerializedMouseData::default()));
	dom.render_immediate(&mut dioxus::dioxus_core::NoOpMutations);
	dioxus_ssr::render(&dom)
}

/// Fires a `focus` at every mounted element, then renders — so a test can
/// assert on the markup a component shows only while focused.
pub fn render_focused(app: fn() -> Element) -> String {
	let mut dom = mount(app);
	sweep(&mut dom, "focus", || Box::new(dioxus::html::SerializedFocusData::default()));
	dom.render_immediate(&mut dioxus::dioxus_core::NoOpMutations);
	dioxus_ssr::render(&dom)
}

/// Fires a `keydown` for `key` at every mounted element, then renders — so a
/// test can assert what a component's key handling actually did, rather than
/// re-asserting the markup around it. Only elements listening for `keydown`
/// react; the event does not bubble, so a handler sees exactly one press.
pub fn render_after_keydown(app: fn() -> Element, key: Key) -> String {
	render_after_keys(app, &[key])
}

/// [`render_after_keydown`] for a sequence: each key is swept and rendered
/// before the next, so the second press meets whatever the first one opened.
pub fn render_after_keys(app: fn() -> Element, keys: &[Key]) -> String {
	let mut dom = mount(app);
	for key in keys {
		sweep(&mut dom, "keydown", || {
			Box::new(dioxus::html::SerializedKeyboardData::new(
				key.clone(),
				Code::Unidentified,
				Location::Standard,
				false,
				Modifiers::empty(),
				false,
			))
		});
		dom.render_immediate(&mut dioxus::dioxus_core::NoOpMutations);
	}
	dioxus_ssr::render(&dom)
}

/// One sweep of [`render_after_steps`].
pub enum Step {
	Key(Key),
	Focus,
}

/// Sweeps each step at every mounted element and renders after it — for a
/// sequence that mixes keys with focus moves.
pub fn render_after_steps(app: fn() -> Element, steps: &[Step]) -> String {
	let mut dom = mount(app);
	for step in steps {
		match step {
			Step::Key(key) => sweep(&mut dom, "keydown", || {
				Box::new(dioxus::html::SerializedKeyboardData::new(
					key.clone(),
					Code::Unidentified,
					Location::Standard,
					false,
					Modifiers::empty(),
					false,
				))
			}),
			Step::Focus => sweep(&mut dom, "focus", || Box::new(dioxus::html::SerializedFocusData::default())),
		}
		dom.render_immediate(&mut dioxus::dioxus_core::NoOpMutations);
	}
	dioxus_ssr::render(&dom)
}

/// Fires an `input` carrying `value` at every mounted element, then renders and
/// returns the mutations that render produced — so a test can assert what a
/// controlled field writes back to the DOM, which the SSR string cannot show
/// (the string is the same whether or not the DOM was patched).
pub fn mutations_after_input(app: fn() -> Element, value: &str) -> Vec<Mutation> {
	let mut dom = mount(app);
	let value = value.to_owned();
	sweep(&mut dom, "input", move || Box::new(SerializedFormData::new(value.clone(), Vec::new())));
	let mut mutations = Mutations::default();
	dom.render_immediate(&mut mutations);
	mutations.edits
}

/// Fires each of `keys` as a `keydown` at every mounted element, like
/// [`render_after_keydown`], but only once effects have settled — before the
/// first key and after each — for a component whose parts register through
/// `use_effect` and would otherwise meet the keys unregistered.
pub fn render_after_settled_keys(app: fn() -> Element, keys: &[Key]) -> String {
	keys_settling(app, keys, true)
}
/// [`render_after_settled_keys`] without settling before the first key: it
/// meets the first render's effects still queued — for a test of what happens
/// to them when that key unmounts their component.
pub fn render_after_keys_on_queued_effects(app: fn() -> Element, keys: &[Key]) -> String {
	keys_settling(app, keys, false)
}
fn mount(app: fn() -> Element) -> VirtualDom {
	// Listeners receive `PlatformEventData` and a converter turns it back into
	// the concrete data. The web/desktop platforms install one; under
	// `dioxus-ssr` there is none, hence the serialized converter.
	dioxus::html::set_event_converter(Box::new(dioxus::html::SerializedHtmlEventConverter));
	let mut dom = VirtualDom::new(app);
	dom.rebuild_in_place();
	dom
}

/// Dispatches `name` at every element id. The dom is not re-rendered mid-sweep,
/// so every element stays mounted throughout.
fn sweep(dom: &mut VirtualDom, name: &str, data: impl Fn() -> Box<dyn std::any::Any>) {
	let runtime = dom.runtime();
	for id in 1..MAX_ELEMENTS {
		let event = Rc::new(PlatformEventData::new(data()));
		runtime.handle_event(name, Event::new(event, false), dioxus::dioxus_core::ElementId(id));
	}
}

fn keys_settling(app: fn() -> Element, keys: &[Key], settle_first: bool) -> String {
	let mut dom = mount(app);
	let settle = |dom: &mut VirtualDom| {
		// Twice, as in `render_with_effects`: run the effects, then let what they dirtied render.
		for _ in 0..2 {
			dom.render_immediate(&mut dioxus::dioxus_core::NoOpMutations);
		}
	};
	if settle_first {
		settle(&mut dom);
	}
	for key in keys {
		sweep(&mut dom, "keydown", || {
			Box::new(dioxus::html::SerializedKeyboardData::new(
				key.clone(),
				Code::Unidentified,
				Location::Standard,
				false,
				Modifiers::empty(),
				false,
			))
		});
		settle(&mut dom);
	}
	dioxus_ssr::render(&dom)
}
