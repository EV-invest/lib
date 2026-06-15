use dioxus::prelude::*;

use crate::cn;

const BUTTON_BASE: &str = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm \
                           font-medium transition-all cursor-pointer disabled:pointer-events-none disabled:opacity-50 \
                           [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 \
                           outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] \
                           aria-invalid:ring-destructive/20 aria-invalid:border-destructive";
/// Canonical superset of the cabinet and landing variants.
#[derive(Clone, Default, PartialEq)]
pub enum ButtonVariant {
	#[default]
	Default,
	Secondary,
	Outline,
	Ghost,
	Destructive,
	Link,
}

impl ButtonVariant {
	fn class(&self) -> &'static str {
		match self {
			ButtonVariant::Default => "bg-primary text-primary-foreground hover:bg-primary/90",
			ButtonVariant::Secondary => "bg-secondary text-secondary-foreground hover:bg-secondary/80",
			ButtonVariant::Outline => "border bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground",
			ButtonVariant::Ghost => "hover:bg-accent hover:text-accent-foreground",
			ButtonVariant::Destructive => "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20",
			ButtonVariant::Link => "text-primary underline-offset-4 hover:underline",
		}
	}
}

/// Canonical superset: cabinet sizes plus landing's `icon-sm` / `icon-lg`.
#[derive(Clone, Default, PartialEq)]
pub enum ButtonSize {
	#[default]
	Default,
	Sm,
	Lg,
	Icon,
	IconSm,
	IconLg,
}

impl ButtonSize {
	fn class(&self) -> &'static str {
		match self {
			ButtonSize::Default => "h-9 px-4 py-2 has-[>svg]:px-3",
			ButtonSize::Sm => "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
			ButtonSize::Lg => "h-10 rounded-md px-6 has-[>svg]:px-4",
			ButtonSize::Icon => "size-9",
			ButtonSize::IconSm => "size-8",
			ButtonSize::IconLg => "size-10",
		}
	}
}

/// Fuses the base, variant and size classes with a caller override, last wins.
/// Mirrors the TS `buttonVariants` helper so consumers (e.g. pagination) can
/// reuse the same canonical class string without rendering a `Button`.
pub fn button_classes(variant: &ButtonVariant, size: &ButtonSize, class: &str) -> String {
	cn!(BUTTON_BASE, variant.class(), size.class(), class)
}

#[component]
pub fn Button(
	#[props(default)] variant: ButtonVariant,
	#[props(default)] size: ButtonSize,
	#[props(default)] class: String,
	#[props(default)] disabled: bool,
	onclick: Option<EventHandler<MouseEvent>>,
	children: Element,
) -> Element {
	let cls = button_classes(&variant, &size, &class);
	rsx! {
		button {
			class: cls,
			"data-slot": "button",
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
				Button { size: ButtonSize::IconSm, "x" }
			}
		}
		let html = render(app);
		assert!(html.contains("size-8"), "{html}");
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
