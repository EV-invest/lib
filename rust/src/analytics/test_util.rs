use dioxus::prelude::*;

/// Renders a component to a static HTML string via `dioxus-ssr`, so tests can
/// assert on provider/context wiring without a browser.
pub fn render(app: fn() -> Element) -> String {
	let mut dom = VirtualDom::new(app);
	dom.rebuild_in_place();
	dioxus_ssr::render(&dom)
}
