use dioxus::prelude::*;
use tailwind_fuse::{AsTailwindClass, TwVariant};

use crate::cn;

const BUTTON_GROUP_TEXT_BASE: &str = "bg-muted flex items-center gap-2 rounded-md border px-4 text-sm font-medium \
                                      shadow-xs [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4";
const BUTTON_GROUP_SEPARATOR_BASE: &str = "bg-input relative !m-0 self-stretch shrink-0 data-[orientation=vertical]:h-auto";
#[derive(strum::AsRefStr, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
#[tw(class = "flex w-fit items-stretch [&>*]:focus-visible:z-10 [&>*]:focus-visible:relative \
              [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1 \
              has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md \
              has-[>[data-slot=button-group]]:gap-2")]
pub enum ButtonGroupOrientation {
	#[tw(default, class = "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none")]
	Horizontal,
	#[tw(class = "flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none")]
	Vertical,
}

#[component]
pub fn ButtonGroup(#[props(default)] orientation: ButtonGroupOrientation, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(orientation.as_class(), class);
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
