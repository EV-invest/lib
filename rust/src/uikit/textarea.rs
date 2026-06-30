use dioxus::prelude::*;

use crate::{cn, uikit::TEXTAREA_BASE};

#[component]
pub fn Textarea(
	#[props(default)] class: String,
	#[props(default)] placeholder: String,
	#[props(default)] disabled: bool,
	#[props(default)] value: String,
	oninput: Option<EventHandler<FormEvent>>,
) -> Element {
	let cls = cn!(TEXTAREA_BASE, class);

	rsx! {
		textarea {
			class: cls,
			"data-slot": "textarea",
			placeholder,
			disabled,
			value,
			oninput: move |e| { if let Some(h) = oninput { h.call(e); } },
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn renders_base_and_slot() {
		fn app() -> Element {
			rsx! { Textarea {} }
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"textarea\""), "{html}");
		assert!(html.contains("field-sizing-content"), "{html}");
		assert!(html.contains("min-h-16"), "{html}");
	}

	#[test]
	fn honors_placeholder() {
		fn app() -> Element {
			rsx! {
				Textarea { placeholder: "Write here" }
			}
		}
		let html = render(app);
		assert!(html.contains("Write here"), "{html}");
	}

	#[test]
	fn class_override_wins() {
		fn app() -> Element {
			rsx! {
				Textarea { class: "min-h-40" }
			}
		}
		let html = render(app);
		assert!(html.contains("min-h-40"), "{html}");
		assert!(!html.contains("min-h-16"), "override should drop base min-h-16: {html}");
	}
}
