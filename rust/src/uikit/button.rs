use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{BUTTON_BASE, ButtonVariant, Size, button_size_class},
};

/// Fuses the base, variant and size classes with a caller override, last wins.
/// Mirrors the TS `buttonVariants` helper so consumers (e.g. pagination) can
/// reuse the same canonical class string without rendering a `Button`.
pub fn button_classes(variant: &ButtonVariant, size: Size, icon: bool, class: &str) -> String {
	cn!(BUTTON_BASE, variant.as_class(), button_size_class(size, icon), class)
}
#[component]
pub fn Button(
	#[props(default)] variant: ButtonVariant,
	#[props(default)] size: Size,
	#[props(default)] icon: bool,
	#[props(default)] class: String,
	#[props(default)] disabled: bool,
	/// Left unset the HTML default applies (`submit` inside a `Form`), mirroring
	/// the TS port where `type` is just another forwarded button prop. Callers
	/// that must not submit — addons, toolbars — pass `"button"`.
	r#type: Option<String>,
	onclick: Option<EventHandler<MouseEvent>>,
	children: Element,
) -> Element {
	let cls = button_classes(&variant, size, icon, &class);
	rsx! {
		button {
			class: cls,
			"data-slot": "button",
			r#type,
			disabled,
			onclick: move |e| { if let Some(h) = onclick { h.call(e); } },
			{children}
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn default_variant_and_size_render() {
		fn app() -> Element {
			rsx! { Button { "go" } }
		}
		let html = render(app);
		assert!(html.contains("bg-primary"), "{html}");
		assert!(html.contains("h-9"), "{html}");
		assert!(html.contains("go"));
		assert!(html.contains("data-slot=\"button\""));
	}

	#[test]
	fn icon_sm_size_is_canon_only_here() {
		fn app() -> Element {
			rsx! {
				Button { size: Size::Sm, icon: true, "x" }
			}
		}
		let html = render(app);
		assert!(html.contains("h-8 aspect-square"), "{html}");
	}

	#[test]
	fn icon_lg_drops_text_padding() {
		fn app() -> Element {
			rsx! {
				Button { size: Size::Lg, icon: true, "x" }
			}
		}
		let html = render(app);
		assert!(html.contains("h-10 aspect-square"), "{html}");
		assert!(!html.contains("px-6"), "icon button must not carry text padding: {html}");
	}

	#[test]
	fn type_is_absent_unless_asked_for() {
		fn app() -> Element {
			rsx! { Button { "go" } }
		}
		let html = render(app);
		assert!(!html.contains("type="), "bare Button mirrors TS and emits no type: {html}");
	}

	#[test]
	fn type_prop_reaches_the_element() {
		fn app() -> Element {
			rsx! {
				Button { r#type: "button", "go" }
			}
		}
		let html = render(app);
		assert!(html.contains("type=\"button\""), "{html}");
	}

	#[test]
	fn class_override_wins() {
		fn app() -> Element {
			rsx! {
				Button { class: "px-6", "x" }
			}
		}
		let html = render(app);
		assert!(html.contains("px-6"));
		assert!(!html.contains("px-4"), "override should drop base px-4: {html}");
	}
}
