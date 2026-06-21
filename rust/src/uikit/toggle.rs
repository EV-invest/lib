use dioxus::prelude::*;

use crate::{cn, uikit::primitives::use_controllable};

const TOGGLE_BASE: &str = "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium \
                           hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 \
                           data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none \
                           [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:border-ring \
                           focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-[color,box-shadow] \
                           aria-invalid:ring-destructive/20 aria-invalid:border-destructive whitespace-nowrap";

#[derive(Clone, Copy, Default, PartialEq)]
pub enum ToggleVariant {
	#[default]
	Transparent,
	Outline,
}

impl ToggleVariant {
	fn class(&self) -> &'static str {
		match self {
			ToggleVariant::Transparent => "bg-transparent",
			ToggleVariant::Outline => "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground",
		}
	}
}

#[derive(Clone, Copy, Default, PartialEq)]
pub enum ToggleSize {
	Sm,
	#[default]
	Md,
	Lg,
}

impl ToggleSize {
	fn class(&self) -> &'static str {
		match self {
			ToggleSize::Sm => "h-8 px-1.5 min-w-8",
			ToggleSize::Md => "h-9 px-2 min-w-9",
			ToggleSize::Lg => "h-10 px-2.5 min-w-10",
		}
	}
}

/// Fuses the base, variant and size classes with a caller override, last wins.
/// Mirrors the TS `toggleVariants` helper so `toggle-group` can reuse the same
/// canonical class string.
pub fn toggle_classes(variant: &ToggleVariant, size: &ToggleSize, class: &str) -> String {
	cn!(TOGGLE_BASE, variant.class(), size.class(), class)
}

#[component]
pub fn Toggle(
	#[props(default)] variant: ToggleVariant,
	#[props(default)] size: ToggleSize,
	#[props(default)] class: String,
	#[props(default)] disabled: bool,
	pressed: Option<bool>,
	#[props(default)] default_pressed: bool,
	on_pressed_change: Option<EventHandler<bool>>,
	children: Element,
) -> Element {
	let state = use_controllable(pressed, default_pressed, on_pressed_change);
	let on = state.get();
	let cls = toggle_classes(&variant, &size, &class);
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
				Toggle { variant: ToggleVariant::Outline, size: ToggleSize::Sm, "B" }
			}
		}
		let html = render(app);
		assert!(html.contains("border-input"), "{html}");
		assert!(html.contains("h-8"), "{html}");
	}
}
