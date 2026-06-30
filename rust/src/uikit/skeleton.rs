use dioxus::prelude::*;

use crate::{cn, uikit::SKELETON_BASE};

#[component]
pub fn Skeleton(#[props(default)] class: String) -> Element {
	let cls = cn!(SKELETON_BASE, class);
	rsx! {
		div { class: cls, "data-slot": "skeleton" }
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn renders_base_and_slot() {
		fn app() -> Element {
			rsx! { Skeleton {} }
		}
		let html = render(app);
		assert!(html.contains("bg-accent"), "{html}");
		assert!(html.contains("animate-pulse"), "{html}");
		assert!(html.contains("data-slot=\"skeleton\""), "{html}");
	}

	#[test]
	fn class_override_merges() {
		fn app() -> Element {
			rsx! {
				Skeleton { class: "h-4 w-24" }
			}
		}
		let html = render(app);
		assert!(html.contains("h-4"), "{html}");
		assert!(html.contains("w-24"), "{html}");
	}
}
