use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{BUTTON_GROUP_BASE, BUTTON_GROUP_SEPARATOR_BASE, BUTTON_GROUP_TEXT_BASE, ButtonGroupOrientation},
};

#[component]
pub fn ButtonGroup(#[props(default)] orientation: ButtonGroupOrientation, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(BUTTON_GROUP_BASE, orientation.as_class(), class);
	rsx! {
		div {
			role: "group",
			"data-slot": "button-group",
			"data-orientation": orientation.as_ref(),
			class: cls,
			{children}
		}
	}
}

#[component]
pub fn ButtonGroupText(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(BUTTON_GROUP_TEXT_BASE, class);
	rsx! {
		div { class: cls, {children} }
	}
}

#[component]
pub fn ButtonGroupSeparator(#[props(default)] class: String) -> Element {
	let cls = cn!(BUTTON_GROUP_SEPARATOR_BASE, class);
	rsx! {
		div {
			"data-slot": "button-group-separator",
			"data-orientation": "vertical",
			role: "separator",
			class: cls,
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn horizontal_is_default() {
		fn app() -> Element {
			rsx! {
				ButtonGroup { "a" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-orientation=\"horizontal\""), "{html}");
		assert!(html.contains("data-slot=\"button-group\""));
	}

	#[test]
	fn vertical_orientation_adds_flex_col() {
		fn app() -> Element {
			rsx! {
				ButtonGroup { orientation: ButtonGroupOrientation::Vertical, "a" }
			}
		}
		let html = render(app);
		assert!(html.contains("flex-col"), "{html}");
		assert!(html.contains("data-orientation=\"vertical\""));
	}

	#[test]
	fn text_and_separator_render_their_slots() {
		fn app() -> Element {
			rsx! {
				ButtonGroup {
					ButtonGroupText { "ms" }
					ButtonGroupSeparator {}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("bg-muted"), "{html}");
		assert!(html.contains("data-slot=\"button-group-separator\""), "{html}");
	}
}
