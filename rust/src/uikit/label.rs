use dioxus::prelude::*;

use crate::cn;

const LABEL_BASE: &str = "flex items-center gap-2 text-sm leading-none font-medium select-none \
                          group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 \
                          peer-disabled:cursor-not-allowed peer-disabled:opacity-50";

#[component]
pub fn Label(#[props(default)] class: String, #[props(default)] r#for: String, children: Element) -> Element {
	let cls = cn!(LABEL_BASE, class);
	rsx! {
		label { class: cls, "data-slot": "label", r#for, {children} }
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn renders_base_and_slot() {
		fn app() -> Element {
			rsx! { Label { "Name" } }
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"label\""), "{html}");
		assert!(html.contains("select-none"), "{html}");
		assert!(html.contains("Name"), "{html}");
	}

	#[test]
	fn maps_for_attribute() {
		fn app() -> Element {
			rsx! {
				Label { r#for: "email", "Email" }
			}
		}
		let html = render(app);
		assert!(html.contains("for=\"email\""), "{html}");
	}

	#[test]
	fn class_override_wins() {
		fn app() -> Element {
			rsx! {
				Label { class: "text-base", "x" }
			}
		}
		let html = render(app);
		assert!(html.contains("text-base"), "{html}");
		assert!(!html.contains("text-sm"), "override should drop base text-sm: {html}");
	}
}
