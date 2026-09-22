use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{SWITCH_BASE, SWITCH_THUMB, primitives::use_controllable},
};

#[component]
pub fn Switch(
	#[props(default)] class: String,
	#[props(default)] disabled: bool,
	checked: Option<bool>,
	#[props(default)] default_checked: bool,
	on_checked_change: Option<EventHandler<bool>>,
) -> Element {
	let state = use_controllable(checked, default_checked, on_checked_change);
	let on = state.get();
	let data_state = if on { "checked" } else { "unchecked" };
	let cls = cn!(SWITCH_BASE, class);
	rsx! {
		button {
			r#type: "button",
			role: "switch",
			class: cls,
			"data-slot": "switch",
			"data-state": data_state,
			"aria-checked": on,
			disabled,
			onclick: move |_| state.set(!on),
			span {
				class: SWITCH_THUMB,
				"data-slot": "switch-thumb",
				"data-state": data_state,
			}
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn default_renders_unchecked() {
		fn app() -> Element {
			rsx! { Switch {} }
		}
		let html = render(app);
		assert!(html.contains("role=\"switch\""), "{html}");
		assert!(html.contains("data-slot=\"switch\""), "{html}");
		assert!(html.contains("data-state=\"unchecked\""), "{html}");
	}

	#[test]
	fn controlled_checked_renders_checked() {
		fn app() -> Element {
			rsx! {
				Switch { checked: true }
			}
		}
		let html = render(app);
		assert!(html.contains("aria-checked=true"), "{html}");
		assert!(html.contains("data-slot=\"switch-thumb\""), "{html}");
	}

	#[test]
	fn wears_the_offset_ring_not_the_halo() {
		fn app() -> Element {
			rsx! { Switch {} }
		}
		let html = render(app);
		assert!(html.contains(crate::uikit::FILLED_FOCUS_RING), "{html}");
		assert!(!html.contains("focus-visible:ring-[3px]"), "{html}");
	}

	#[test]
	fn thumb_has_translate_class() {
		fn app() -> Element {
			rsx! { Switch {} }
		}
		let html = render(app);
		assert!(html.contains("data-[state=checked]:translate-x-[calc(100%-2px)]"), "{html}");
	}
}
