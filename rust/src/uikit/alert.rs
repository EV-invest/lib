use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{ALERT_BASE, ALERT_DESCRIPTION, ALERT_TITLE, AlertVariant},
};

#[component]
pub fn Alert(#[props(default)] variant: AlertVariant, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(ALERT_BASE, variant.as_class(), class);
	rsx! {
		div { class: cls, "data-slot": "alert", role: "alert", {children} }
	}
}

#[component]
pub fn AlertTitle(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(ALERT_TITLE, class);
	rsx! {
		div { class: cls, "data-slot": "alert-title", {children} }
	}
}

#[component]
pub fn AlertDescription(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(ALERT_DESCRIPTION, class);
	rsx! {
		div { class: cls, "data-slot": "alert-description", {children} }
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn default_variant_renders_base_and_slot() {
		fn app() -> Element {
			rsx! { Alert { "body" } }
		}
		let html = render(app);
		assert!(html.contains("bg-card"), "{html}");
		assert!(html.contains("data-slot=\"alert\""), "{html}");
		assert!(html.contains("role=\"alert\""), "{html}");
		assert!(html.contains("body"));
	}

	#[test]
	fn destructive_variant() {
		fn app() -> Element {
			rsx! {
				Alert { variant: AlertVariant::Destructive, "x" }
			}
		}
		let html = render(app);
		assert!(html.contains("text-destructive"), "{html}");
	}

	#[test]
	fn title_and_description_slots() {
		fn app() -> Element {
			rsx! {
				Alert {
					AlertTitle { "t" }
					AlertDescription { "d" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"alert-title\""), "{html}");
		assert!(html.contains("data-slot=\"alert-description\""), "{html}");
		assert!(html.contains("text-muted-foreground"), "{html}");
	}
}
