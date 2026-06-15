use dioxus::prelude::*;

use crate::cn;

#[component]
pub fn Progress(#[props(default)] value: f64, #[props(default)] class: String) -> Element {
	let cls = cn!("bg-primary/20 relative h-2 w-full overflow-hidden rounded-full", class);
	let style = format!("transform: translateX(-{}%)", 100.0 - value);
	rsx! {
		div {
			class: cls,
			"data-slot": "progress",
			role: "progressbar",
			"aria-valuenow": value,
			"aria-valuemin": 0,
			"aria-valuemax": 100,
			div {
				class: "bg-primary h-full w-full flex-1 transition-all",
				"data-slot": "progress-indicator",
				style,
			}
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn renders_base_slot_and_role() {
		fn app() -> Element {
			rsx! { Progress {} }
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"progress\""), "{html}");
		assert!(html.contains("role=\"progressbar\""), "{html}");
		assert!(html.contains("bg-primary/20"), "{html}");
	}

	#[test]
	fn default_value_translates_fully_left() {
		fn app() -> Element {
			rsx! { Progress {} }
		}
		let html = render(app);
		assert!(html.contains("translateX(-100%)"), "{html}");
		assert!(html.contains("data-slot=\"progress-indicator\""), "{html}");
	}

	#[test]
	fn value_drives_indicator_transform() {
		fn app() -> Element {
			rsx! {
				Progress { value: 60.0 }
			}
		}
		let html = render(app);
		assert!(html.contains("translateX(-40%)"), "{html}");
		assert!(html.contains("aria-valuenow=60"), "{html}");
	}
}
