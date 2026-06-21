use dioxus::prelude::*;

use crate::cn;

const SEPARATOR_BASE: &str = "bg-border shrink-0";
#[derive(derive_more::Display, Clone, Default, PartialEq)]
#[display(rename_all = "kebab-case")]
pub enum Orientation {
	#[default]
	Horizontal,
	Vertical,
}

impl Orientation {
	fn class(&self) -> &'static str {
		match self {
			Orientation::Horizontal => "data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full",
			Orientation::Vertical => "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
		}
	}
}

#[component]
pub fn Separator(#[props(default)] orientation: Orientation, #[props(default)] class: String) -> Element {
	let cls = cn!(SEPARATOR_BASE, orientation.class(), class);
	rsx! {
		div {
			role: "separator",
			"data-slot": "separator",
			"data-orientation": "{orientation}",
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
			rsx! { Separator {} }
		}
		let html = render(app);
		assert!(html.contains("bg-border"), "{html}");
		assert!(html.contains("data-orientation=\"horizontal\""), "{html}");
		assert!(html.contains("role=\"separator\""), "{html}");
		assert!(html.contains("data-slot=\"separator\""), "{html}");
	}

	#[test]
	fn vertical_sizing() {
		fn app() -> Element {
			rsx! {
				Separator { orientation: Orientation::Vertical }
			}
		}
		let html = render(app);
		assert!(html.contains("data-[orientation=vertical]:w-px"), "{html}");
		assert!(html.contains("data-orientation=\"vertical\""), "{html}");
	}
}
