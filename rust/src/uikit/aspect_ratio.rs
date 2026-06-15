use dioxus::prelude::*;

use crate::cn;

fn default_ratio() -> f64 {
	1.0
}

#[component]
pub fn AspectRatio(#[props(default = default_ratio())] ratio: f64, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(class);
	let style = format!("aspect-ratio: {ratio};");
	rsx! {
		div { class: cls, style, "data-slot": "aspect-ratio", {children} }
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn default_ratio_is_one() {
		fn app() -> Element {
			rsx! {
				AspectRatio { "x" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"aspect-ratio\""), "{html}");
		assert!(html.contains("aspect-ratio: 1"), "{html}");
		assert!(html.contains("x"));
	}

	#[test]
	fn custom_ratio_applied() {
		fn app() -> Element {
			rsx! {
				AspectRatio { ratio: 1.5, "y" }
			}
		}
		let html = render(app);
		assert!(html.contains("aspect-ratio: 1.5"), "{html}");
	}
}
