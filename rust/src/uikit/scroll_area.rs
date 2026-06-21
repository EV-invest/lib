use dioxus::prelude::*;
use tailwind_fuse::{AsTailwindClass, TwVariant};

use crate::cn;

// Dep-light scroll area: a viewport `div` with native `overflow` scrolling.
// Custom scrollbar thumb tracking is omitted — native overflow does the work;
// `ScrollBar` is a static decorative element kept for class parity.

#[component]
pub fn ScrollArea(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("relative", class);
	rsx! {
		div { class: cls, "data-slot": "scroll-area",
			div {
				"data-slot": "scroll-area-viewport",
				class: "focus-visible:ring-ring/50 size-full rounded-[inherit] overflow-auto transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1",
				{children}
			}
			ScrollBar {}
		}
	}
}

#[derive(strum::AsRefStr, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
#[tw(class = "flex touch-none p-px transition-colors select-none")]
pub enum ScrollBarOrientation {
	#[tw(default, class = "h-full w-2.5 border-l border-l-transparent")]
	Vertical,
	#[tw(class = "h-2.5 flex-col border-t border-t-transparent")]
	Horizontal,
}

#[component]
pub fn ScrollBar(#[props(default)] orientation: ScrollBarOrientation, #[props(default)] class: String) -> Element {
	let cls = cn!(orientation.as_class(), class);
	rsx! {
		div {
			"data-slot": "scroll-area-scrollbar",
			"data-orientation": orientation.as_ref(),
			class: cls,
			div { "data-slot": "scroll-area-thumb", class: "bg-border relative flex-1 rounded-full" }
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn scroll_area_renders_viewport_and_slots() {
		fn app() -> Element {
			rsx! {
				ScrollArea { "body" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"scroll-area\""), "{html}");
		assert!(html.contains("data-slot=\"scroll-area-viewport\""), "{html}");
		assert!(html.contains("overflow-auto"), "{html}");
		assert!(html.contains("size-full"), "{html}");
		assert!(html.contains("body"));
	}

	#[test]
	fn scrollbar_defaults_to_vertical() {
		fn app() -> Element {
			rsx! { ScrollBar {} }
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"scroll-area-scrollbar\""), "{html}");
		assert!(html.contains("data-orientation=\"vertical\""), "{html}");
		assert!(html.contains("w-2.5"), "{html}");
		assert!(html.contains("data-slot=\"scroll-area-thumb\""), "{html}");
	}

	#[test]
	fn scrollbar_horizontal_orientation() {
		fn app() -> Element {
			rsx! {
				ScrollBar { orientation: ScrollBarOrientation::Horizontal }
			}
		}
		let html = render(app);
		assert!(html.contains("data-orientation=\"horizontal\""), "{html}");
		assert!(html.contains("flex-col"), "{html}");
	}
}
