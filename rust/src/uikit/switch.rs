use dioxus::prelude::*;

use crate::{cn, uikit::primitives::use_controllable};

const SWITCH_BASE: &str = "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring \
                           focus-visible:ring-ring/50 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full \
                           border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] \
                           disabled:cursor-not-allowed disabled:opacity-50";

const THUMB: &str = "bg-background pointer-events-none block size-4 rounded-full ring-0 transition-transform \
                     data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0";

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
				class: THUMB,
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
	fn thumb_has_translate_class() {
		fn app() -> Element {
			rsx! { Switch {} }
		}
		let html = render(app);
		assert!(html.contains("data-[state=checked]:translate-x-[calc(100%-2px)]"), "{html}");
	}
}
