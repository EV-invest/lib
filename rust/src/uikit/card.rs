use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{CARD, CARD_ACTION, CARD_CONTENT, CARD_DESCRIPTION, CARD_FOOTER, CARD_HEADER, CARD_TITLE},
};

#[component]
pub fn Card(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(CARD, class);
	rsx! {
		div { class: cls, "data-slot": "card", {children} }
	}
}

#[component]
pub fn CardHeader(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(CARD_HEADER, class);
	rsx! {
		div { class: cls, "data-slot": "card-header", {children} }
	}
}

#[component]
pub fn CardTitle(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(CARD_TITLE, class);
	rsx! {
		div { class: cls, "data-slot": "card-title", {children} }
	}
}

#[component]
pub fn CardDescription(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(CARD_DESCRIPTION, class);
	rsx! {
		div { class: cls, "data-slot": "card-description", {children} }
	}
}

#[component]
pub fn CardAction(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(CARD_ACTION, class);
	rsx! {
		div { class: cls, "data-slot": "card-action", {children} }
	}
}

#[component]
pub fn CardContent(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(CARD_CONTENT, class);
	rsx! {
		div { class: cls, "data-slot": "card-content", {children} }
	}
}

#[component]
pub fn CardFooter(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(CARD_FOOTER, class);
	rsx! {
		div { class: cls, "data-slot": "card-footer", {children} }
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn card_renders_base_and_slot() {
		fn app() -> Element {
			rsx! { Card { "body" } }
		}
		let html = render(app);
		assert!(html.contains("bg-card"), "{html}");
		assert!(html.contains("data-slot=\"card\""), "{html}");
		assert!(html.contains("body"));
	}

	#[test]
	fn header_keeps_landing_canon() {
		fn app() -> Element {
			rsx! {
				CardHeader { "h" }
			}
		}
		let html = render(app);
		assert!(html.contains("@container/card-header"), "{html}");
		assert!(html.contains("has-data-[slot=card-action]:grid-cols-[1fr_auto]"), "{html}");
	}

	#[test]
	fn footer_has_border_t_rule() {
		fn app() -> Element {
			rsx! {
				CardFooter { "f" }
			}
		}
		let html = render(app);
		assert!(html.contains("[.border-t]:pt-6"), "{html}");
		assert!(html.contains("data-slot=\"card-footer\""), "{html}");
	}
}
