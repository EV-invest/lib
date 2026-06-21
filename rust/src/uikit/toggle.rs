use dioxus::prelude::*;
use tailwind_fuse::{AsTailwindClass, TwVariant};

use crate::{
	cn,
	uikit::{Size, primitives::use_controllable},
};

#[derive(strum::AsRefStr, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
#[tw(class = "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium \
              hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 \
              data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none \
              [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:border-ring \
              focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-[color,box-shadow] \
              aria-invalid:ring-destructive/20 aria-invalid:border-destructive whitespace-nowrap")]
pub enum ToggleVariant {
	#[tw(default, class = "bg-transparent")]
	Transparent,
	#[tw(class = "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground")]
	Outline,
}

/// Fuses the base, variant and size classes with a caller override, last wins.
/// Mirrors the TS `toggleVariants` helper so `toggle-group` can reuse the same
/// canonical class string.
pub fn toggle_classes(variant: &ToggleVariant, size: Size, class: &str) -> String {
	let dims = format!("h-{0} min-w-{0} {1}", size.scale(), toggle_padding(size));
	cn!(variant.as_class(), &dims, class)
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
/// Per-size horizontal padding; height + min-width come from [`Size::scale`].
fn toggle_padding(size: Size) -> &'static str {
	match size {
		Size::Sm => "px-1.5",
		Size::Md => "px-2",
		Size::Lg => "px-2.5",
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
