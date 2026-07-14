use std::rc::Rc;

use dioxus::{
	html::{
		PlatformEventData,
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
	let mut dom = mount(app);
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
	dioxus_ssr::render(&dom)
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
