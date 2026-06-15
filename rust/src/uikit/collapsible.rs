use dioxus::prelude::*;

use crate::uikit::primitives::{Controllable, use_controllable};

#[component]
pub fn Collapsible(open: Option<bool>, #[props(default)] default_open: bool, on_open_change: Option<EventHandler<bool>>, #[props(default)] class: String, children: Element) -> Element {
	let state = use_controllable(open, default_open, on_open_change);
	use_context_provider(|| CollapsibleCtx { open: state });
	let data_state = if state.get() { "open" } else { "closed" };
	rsx! {
		div { class, "data-slot": "collapsible", "data-state": data_state, {children} }
	}
}
#[component]
pub fn CollapsibleTrigger(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<CollapsibleCtx>();
	let open = ctx.open.get();
	let data_state = if open { "open" } else { "closed" };
	let aria_expanded = if open { "true" } else { "false" };
	rsx! {
		button {
			r#type: "button",
			class,
			"data-slot": "collapsible-trigger",
			"data-state": data_state,
			"aria-expanded": aria_expanded,
			onclick: move |_| ctx.open.set(!ctx.open.get()),
			{children}
		}
	}
}
#[component]
pub fn CollapsibleContent(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<CollapsibleCtx>();
	if !ctx.open.get() {
		return rsx! {};
	}
	rsx! {
		div { class, "data-slot": "collapsible-content", "data-state": "open", {children} }
	}
}
#[derive(Clone, Copy)]
struct CollapsibleCtx {
	open: Controllable<bool>,
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn closed_by_default_hides_content() {
		fn app() -> Element {
			rsx! {
				Collapsible {
					CollapsibleTrigger { "toggle" }
					CollapsibleContent { "body" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"collapsible-trigger\""), "{html}");
		assert!(!html.contains("body"), "content hidden while closed: {html}");
	}

	#[test]
	fn default_open_reveals_content() {
		fn app() -> Element {
			rsx! {
				Collapsible { default_open: true,
					CollapsibleTrigger { "toggle" }
					CollapsibleContent { "body" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"collapsible-content\""), "{html}");
		assert!(html.contains("body"), "{html}");
		assert!(html.contains("data-state=\"open\""), "{html}");
	}

	#[test]
	fn trigger_carries_aria_expanded() {
		fn app() -> Element {
			rsx! {
				Collapsible { default_open: true,
					CollapsibleTrigger { "toggle" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("aria-expanded=\"true\""), "{html}");
	}
}
