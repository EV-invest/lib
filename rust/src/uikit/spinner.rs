use dioxus::prelude::*;

use crate::cn;

#[component]
pub fn Spinner(#[props(default)] class: String) -> Element {
	let cls = cn!("size-4 animate-spin", class);
	rsx! {
		svg {
			class: cls,
			role: "status",
			"aria-label": "Loading",
			view_box: "0 0 24 24",
			fill: "none",
			stroke: "currentColor",
			stroke_width: "2",
			path { d: "M21 12a9 9 0 1 1-6.219-8.56" }
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn spinner_has_status_and_base() {
		fn app() -> Element {
			rsx! { Spinner {} }
		}
		let html = render(app);
		assert!(html.contains("role=\"status\""), "{html}");
		assert!(html.contains("aria-label=\"Loading\""), "{html}");
		assert!(html.contains("animate-spin"), "{html}");
		assert!(html.contains("M21 12a9 9 0 1 1-6.219-8.56"), "{html}");
	}

	#[test]
	fn class_extends_base() {
		fn app() -> Element {
			rsx! {
				Spinner { class: "size-8" }
			}
		}
		let html = render(app);
		assert!(html.contains("size-8"), "{html}");
		assert!(!html.contains("size-4"), "override should drop base size-4: {html}");
	}
}
