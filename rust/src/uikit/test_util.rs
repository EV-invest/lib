use dioxus::prelude::*;

/// Renders a component to a static HTML string via `dioxus-ssr`, so tests can
/// assert on the emitted classes and structure without a browser.
pub fn render(app: fn() -> Element) -> String {
	let mut dom = VirtualDom::new(app);
	dom.rebuild_in_place();
	dioxus_ssr::render(&dom)
}

/// Fires a `click` at every mounted element, so a test can assert that a
/// handler ran without hardcoding a brittle `ElementId`. The component's own
/// handlers record the hits; the dom is not re-rendered between clicks, so
/// every element stays mounted for the whole sweep.
pub fn click_every_element(app: fn() -> Element) {
	// Listeners receive `PlatformEventData` and a converter turns it back into
	// `MouseData`. The web/desktop platforms install one; under `dioxus-ssr`
	// there is none, hence the serialized converter.
	dioxus::html::set_event_converter(Box::new(dioxus::html::SerializedHtmlEventConverter));
	let mut dom = VirtualDom::new(app);
	dom.rebuild_in_place();
	let runtime = dom.runtime();
	for id in 1..MAX_ELEMENTS {
		let data = Box::new(dioxus::html::SerializedMouseData::default());
		let event = std::rc::Rc::new(dioxus::html::PlatformEventData::new(data));
		runtime.handle_event("click", Event::new(event, false), dioxus::dioxus_core::ElementId(id));
	}
}

/// Upper bound for [`click_every_element`]'s sweep — larger than any component
/// tree the uikit tests build.
const MAX_ELEMENTS: usize = 32;
