use dioxus::prelude::*;

use crate::{cn, uikit::CONTAINER_BASE};

/// Page-width wrapper: centres content, caps it at `--page-max` and applies the
/// responsive `--page-px` gutter (tighter on mobile, roomier ≥ sm). Standardises
/// the `<div class="container">` consumers were repeating, so the page gutter and
/// max width live in one token-driven place.
#[component]
pub fn Container(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(CONTAINER_BASE, class);
	rsx! {
		div { class: cls, "data-slot": "container", {children} }
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn applies_gutter_and_max_width() {
		fn app() -> Element {
			rsx! {
				Container { "x" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"container\""), "{html}");
		assert!(html.contains("max-w-[var(--page-max,90rem)]"), "{html}");
		assert!(html.contains("px-[var(--page-px,1rem)]"), "{html}");
		assert!(html.contains("x"));
	}

	#[test]
	fn class_override_wins() {
		fn app() -> Element {
			rsx! {
				Container { class: "max-w-3xl".to_string(), "y" }
			}
		}
		let html = render(app);
		assert!(html.contains("max-w-3xl"), "{html}");
	}
}
