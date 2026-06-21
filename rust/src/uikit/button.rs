use dioxus::prelude::*;
use tailwind_fuse::{AsTailwindClass, TwVariant};

use crate::{cn, uikit::Size};

/// Canonical superset of the cabinet and landing variants. The base rides on the
/// enum via `#[tw(class)]`, so `as_class()` already yields base + variant.
#[derive(PartialEq, TwVariant)]
#[tw(class = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm \
              font-medium transition-all cursor-pointer disabled:pointer-events-none disabled:opacity-50 \
              [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 \
              outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] \
              aria-invalid:ring-destructive/20 aria-invalid:border-destructive")]
pub enum ButtonVariant {
	#[tw(default, class = "bg-primary text-primary-foreground hover:bg-primary/90")]
	Default,
	#[tw(class = "bg-secondary text-secondary-foreground hover:bg-secondary/80")]
	Secondary,
	#[tw(class = "border bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground")]
	Outline,
	#[tw(class = "hover:bg-accent hover:text-accent-foreground")]
	Ghost,
	#[tw(class = "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20")]
	Destructive,
	#[tw(class = "text-primary underline-offset-4 hover:underline")]
	Link,
}

/// Fuses the base, variant and size classes with a caller override, last wins.
/// Mirrors the TS `buttonVariants` helper so consumers (e.g. pagination) can
/// reuse the same canonical class string without rendering a `Button`. An
/// `icon` button is a square (`h-N aspect-square`); otherwise height + per-size padding.
pub fn button_classes(variant: &ButtonVariant, size: Size, icon: bool, class: &str) -> String {
	let dims = if icon {
		format!("h-{} aspect-square px-0", size.scale())
	} else {
		format!("h-{} {}", size.scale(), text_padding(size))
	};
	cn!(variant.as_class(), &dims, class)
}
#[component]
pub fn Button(
	#[props(default)] variant: ButtonVariant,
	#[props(default)] size: Size,
	#[props(default)] icon: bool,
	#[props(default)] class: String,
	#[props(default)] disabled: bool,
	onclick: Option<EventHandler<MouseEvent>>,
	children: Element,
) -> Element {
	let cls = button_classes(&variant, size, icon, &class);
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
/// Per-size padding for text buttons; the height comes from [`Size::scale`].
fn text_padding(size: Size) -> &'static str {
	match size {
		Size::Sm => "rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
		Size::Md => "px-4 py-2 has-[>svg]:px-3",
		Size::Lg => "rounded-md px-6 has-[>svg]:px-4",
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
