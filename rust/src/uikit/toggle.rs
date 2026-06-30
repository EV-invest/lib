use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{Size, TOGGLE_BASE, ToggleVariant, primitives::use_controllable, toggle_size_class},
};

/// Fuses the base, variant and size classes with a caller override, last wins.
/// Mirrors the TS `toggleVariants` helper so `toggle-group` can reuse the same
/// canonical class string.
pub fn toggle_classes(variant: &ToggleVariant, size: Size, class: &str) -> String {
	cn!(TOGGLE_BASE, variant.as_class(), toggle_size_class(size), class)
}
#[component]
pub fn Toggle(
	#[props(default)] variant: ToggleVariant,
	#[props(default)] size: Size,
	#[props(default)] class: String,
	#[props(default)] disabled: bool,
	pressed: Option<bool>,
	#[props(default)] default_pressed: bool,
	on_pressed_change: Option<EventHandler<bool>>,
	children: Element,
) -> Element {
	let state = use_controllable(pressed, default_pressed, on_pressed_change);
	let on = state.get();
	let cls = toggle_classes(&variant, size, &class);
	rsx! {
		button {
			r#type: "button",
			class: cls,
			"data-slot": "toggle",
			"data-state": if on { "on" } else { "off" },
			"aria-pressed": on,
			disabled,
			onclick: move |_| state.set(!on),
			{children}
		}
	}
}
#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn default_renders_off_state() {
		fn app() -> Element {
			rsx! { Toggle { "B" } }
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"toggle\""), "{html}");
		assert!(html.contains("data-state=\"off\""), "{html}");
		assert!(html.contains("bg-transparent"), "{html}");
	}

	#[test]
	fn controlled_pressed_renders_on() {
		fn app() -> Element {
			rsx! {
				Toggle { pressed: true, "B" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-state=\"on\""), "{html}");
		assert!(html.contains("aria-pressed=true"), "{html}");
	}

	#[test]
	fn outline_variant_classes() {
		fn app() -> Element {
			rsx! {
				Toggle { variant: ToggleVariant::Outline, size: Size::Sm, "B" }
			}
		}
		let html = render(app);
		assert!(html.contains("border-input"), "{html}");
		assert!(html.contains("h-8"), "{html}");
	}
}
