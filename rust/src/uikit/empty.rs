use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{EMPTY, EMPTY_CONTENT, EMPTY_DESCRIPTION, EMPTY_HEADER, EMPTY_MEDIA_BASE, EMPTY_TITLE, EmptyMediaVariant},
};
#[component]
pub fn Empty(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(EMPTY, class);
	rsx! {
		div { class: cls, "data-slot": "empty", {children} }
	}
}

#[component]
pub fn EmptyHeader(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(EMPTY_HEADER, class);
	rsx! {
		div { class: cls, "data-slot": "empty-header", {children} }
	}
}

#[component]
pub fn EmptyMedia(#[props(default)] variant: EmptyMediaVariant, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(EMPTY_MEDIA_BASE, variant.as_class(), class);
	rsx! {
		div {
			class: cls,
			"data-slot": "empty-icon",
			"data-variant": variant.as_ref(),
			{children}
		}
	}
}

#[component]
pub fn EmptyTitle(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(EMPTY_TITLE, class);
	rsx! {
		div { class: cls, "data-slot": "empty-title", {children} }
	}
}

#[component]
pub fn EmptyDescription(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(EMPTY_DESCRIPTION, class);
	rsx! {
		div { class: cls, "data-slot": "empty-description", {children} }
	}
}

#[component]
pub fn EmptyContent(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(EMPTY_CONTENT, class);
	rsx! {
		div { class: cls, "data-slot": "empty-content", {children} }
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn empty_renders_base_and_slot() {
		fn app() -> Element {
			rsx! {
				Empty { "x" }
			}
		}
		let html = render(app);
		assert!(html.contains("border-dashed"), "{html}");
		assert!(html.contains("data-slot=\"empty\""), "{html}");
	}

	#[test]
	fn media_default_variant() {
		fn app() -> Element {
			rsx! {
				EmptyMedia { "m" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"empty-icon\""), "{html}");
		assert!(html.contains("data-variant=\"default\""), "{html}");
		assert!(html.contains("bg-transparent"), "{html}");
	}

	#[test]
	fn media_icon_variant_is_canon() {
		fn app() -> Element {
			rsx! {
				EmptyMedia { variant: EmptyMediaVariant::Icon, "m" }
			}
		}
		let html = render(app);
		assert!(html.contains("size-10"), "{html}");
		assert!(html.contains("data-variant=\"icon\""), "{html}");
	}

	#[test]
	fn parts_carry_their_slots() {
		fn app() -> Element {
			rsx! {
				EmptyHeader { "h" }
				EmptyTitle { "t" }
				EmptyDescription { "d" }
				EmptyContent { "c" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"empty-header\""), "{html}");
		assert!(html.contains("data-slot=\"empty-title\""), "{html}");
		assert!(html.contains("data-slot=\"empty-description\""), "{html}");
		assert!(html.contains("data-slot=\"empty-content\""), "{html}");
	}
}
