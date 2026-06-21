use dioxus::prelude::*;
use tailwind_fuse::{AsTailwindClass, TwVariant};

use crate::cn;

/// Canonical superset of the cabinet (`Success`) and landing variants.
#[derive(PartialEq, TwVariant)]
#[tw(class = "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs \
              font-medium w-fit whitespace-nowrap shrink-0 gap-1 overflow-hidden \
              [&>svg]:size-3 [&>svg]:pointer-events-none transition-[color,box-shadow] \
              focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] \
              aria-invalid:ring-destructive/20 aria-invalid:border-destructive")]
pub enum BadgeVariant {
	#[tw(default, class = "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90")]
	Default,
	#[tw(class = "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90")]
	Secondary,
	#[tw(class = "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20")]
	Destructive,
	#[tw(class = "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground")]
	Outline,
	#[tw(class = "border-transparent bg-main-accent-t2/20 text-main-accent-t2")]
	Success,
}

#[component]
pub fn Badge(#[props(default)] variant: BadgeVariant, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(variant.as_class(), class);
	rsx! {
		span { class: cls, "data-slot": "badge", {children} }
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn default_variant_renders_primary() {
		fn app() -> Element {
			rsx! { Badge { "hi" } }
		}
		let html = render(app);
		assert!(html.contains("bg-primary"), "{html}");
		assert!(html.contains("hi"));
		assert!(html.contains("data-slot=\"badge\""));
	}

	#[test]
	fn success_variant_is_canon_only_here() {
		fn app() -> Element {
			rsx! {
				Badge { variant: BadgeVariant::Success, "ok" }
			}
		}
		let html = render(app);
		assert!(html.contains("text-main-accent-t2"), "{html}");
	}

	#[test]
	fn class_override_wins() {
		fn app() -> Element {
			rsx! {
				Badge { class: "px-6", "x" }
			}
		}
		let html = render(app);
		assert!(html.contains("px-6"));
		assert!(!html.contains("px-2"), "override should drop base px-2: {html}");
	}
}
