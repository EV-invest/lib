use dioxus::prelude::*;

use crate::{cn, uikit::primitives::use_controllable};

const CHECKBOX_BASE: &str = "peer border-input data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground \
                             data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 \
                             aria-invalid:ring-destructive/20 aria-invalid:border-destructive size-4 shrink-0 \
                             rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] \
                             disabled:cursor-not-allowed disabled:opacity-50";

#[component]
pub fn Checkbox(
	#[props(default)] class: String,
	#[props(default)] disabled: bool,
	checked: Option<bool>,
	#[props(default)] default_checked: bool,
	on_checked_change: Option<EventHandler<bool>>,
) -> Element {
	let state = use_controllable(checked, default_checked, on_checked_change);
	let on = state.get();
	let data_state = if on { "checked" } else { "unchecked" };
	let cls = cn!(CHECKBOX_BASE, class);
	rsx! {
		button {
			r#type: "button",
			role: "checkbox",
			class: cls,
			"data-slot": "checkbox",
			"data-state": data_state,
			"aria-checked": on,
			disabled,
			onclick: move |_| state.set(!on),
			if on {
				span {
					class: "flex items-center justify-center text-current transition-none",
					"data-slot": "checkbox-indicator",
					svg {
						xmlns: "http://www.w3.org/2000/svg",
						view_box: "0 0 24 24",
						fill: "none",
						stroke: "currentColor",
						stroke_width: "2",
						stroke_linecap: "round",
						stroke_linejoin: "round",
						class: "size-3.5",
						"aria-hidden": "true",
						path { d: "M20 6 9 17l-5-5" }
					}
				}
			}
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn default_renders_unchecked_no_indicator() {
		fn app() -> Element {
			rsx! { Checkbox {} }
		}
		let html = render(app);
		assert!(html.contains("role=\"checkbox\""), "{html}");
		assert!(html.contains("data-state=\"unchecked\""), "{html}");
		assert!(!html.contains("checkbox-indicator"), "{html}");
	}

	#[test]
	fn checked_shows_check_svg() {
		fn app() -> Element {
			rsx! {
				Checkbox { checked: true }
			}
		}
		let html = render(app);
		assert!(html.contains("data-state=\"checked\""), "{html}");
		assert!(html.contains("checkbox-indicator"), "{html}");
		assert!(html.contains("M20 6 9 17l-5-5"), "{html}");
	}

	#[test]
	fn base_classes_present() {
		fn app() -> Element {
			rsx! { Checkbox {} }
		}
		let html = render(app);
		assert!(html.contains("rounded-[4px]"), "{html}");
		assert!(html.contains("data-slot=\"checkbox\""), "{html}");
	}
}
