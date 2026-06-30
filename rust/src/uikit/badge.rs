use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{BADGE_BASE, BadgeVariant},
};

#[component]
pub fn Badge(#[props(default)] variant: BadgeVariant, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(BADGE_BASE, variant.as_class(), class);
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
