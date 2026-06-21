use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		Size,
		primitives::use_controllable,
		toggle::{ToggleVariant, toggle_classes},
	},
};

/// Grouped container. Unlike the TS port it does not own selection or use a
/// React context: variant/size are passed to each [`ToggleGroupItem`] directly,
/// keeping the Rust kernel context-free.
#[component]
pub fn ToggleGroup(#[props(default)] variant: ToggleVariant, #[props(default)] size: Size, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("group/toggle-group flex w-fit items-center rounded-md data-[variant=outline]:shadow-xs", class);
	rsx! {
		div {
			class: cls,
			"data-slot": "toggle-group",
			"data-variant": variant_attr(&variant),
			"data-size": size_attr(&size),
			{children}
		}
	}
}
/// A single selectable item. Reuses [`toggle_classes`] then layers the group
/// adjacency utilities. Controllable `pressed` mirrors [`Toggle`].
#[component]
pub fn ToggleGroupItem(
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
	let cls = cn!(
		toggle_classes(&variant, size, ""),
		"min-w-0 flex-1 shrink-0 rounded-none shadow-none first:rounded-l-md last:rounded-r-md focus:z-10 focus-visible:z-10 data-[variant=outline]:border-l-0 data-[variant=outline]:first:border-l",
		class
	);
	rsx! {
		button {
			r#type: "button",
			class: cls,
			"data-slot": "toggle-group-item",
			"data-variant": variant_attr(&variant),
			"data-size": size_attr(&size),
			"data-state": if on { "on" } else { "off" },
			"aria-pressed": on,
			disabled,
			onclick: move |_| state.set(!on),
			{children}
		}
	}
}
fn variant_attr(variant: &ToggleVariant) -> &'static str {
	match variant {
		ToggleVariant::Outline => "outline",
		ToggleVariant::Transparent => "transparent",
	}
}

fn size_attr(size: &Size) -> &'static str {
	match size {
		Size::Md => "md",
		Size::Sm => "sm",
		Size::Lg => "lg",
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn group_renders_slot_and_variant() {
		fn app() -> Element {
			rsx! {
				ToggleGroup { variant: ToggleVariant::Outline, "x" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"toggle-group\""), "{html}");
		assert!(html.contains("data-variant=\"outline\""), "{html}");
	}

	#[test]
	fn item_reuses_toggle_classes_and_adjacency() {
		fn app() -> Element {
			rsx! {
				ToggleGroupItem { size: Size::Sm, "A" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"toggle-group-item\""), "{html}");
		assert!(html.contains("first:rounded-l-md"), "{html}");
		assert!(html.contains("h-8"), "{html}");
	}

	#[test]
	fn item_controlled_pressed_renders_on() {
		fn app() -> Element {
			rsx! {
				ToggleGroupItem { pressed: true, "A" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-state=\"on\""), "{html}");
	}
}
