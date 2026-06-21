use dioxus::prelude::*;
use tailwind_fuse::{AsTailwindClass, TwVariant};

use crate::cn;

#[derive(strum::AsRefStr, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
#[tw(class = "bg-border shrink-0")]
pub enum Orientation {
	#[tw(default, class = "data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full")]
	Horizontal,
	#[tw(class = "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px")]
	Vertical,
}

#[component]
pub fn Separator(#[props(default)] orientation: Orientation, #[props(default)] class: String) -> Element {
	let cls = cn!(orientation.as_class(), class);
	rsx! {
		div {
			role: "separator",
			"data-slot": "separator",
			"data-orientation": orientation.as_ref(),
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
