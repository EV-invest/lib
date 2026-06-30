use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		ITEM_ACTIONS, ITEM_BASE, ITEM_CONTENT, ITEM_DESCRIPTION, ITEM_FOOTER, ITEM_GROUP, ITEM_HEADER, ITEM_MEDIA_BASE, ITEM_SEPARATOR, ITEM_TITLE, ItemMediaVariant, ItemSize, ItemVariant,
		Orientation, separator::Separator,
	},
};
#[component]
pub fn ItemGroup(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(ITEM_GROUP, class);
	rsx! {
		div { role: "list", class: cls, "data-slot": "item-group", {children} }
	}
}

#[component]
pub fn ItemSeparator(#[props(default)] class: String) -> Element {
	let cls = cn!(ITEM_SEPARATOR, class);
	rsx! {
		Separator { orientation: Orientation::Horizontal, class: cls }
	}
}

#[component]
pub fn Item(#[props(default)] variant: ItemVariant, #[props(default)] size: ItemSize, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(ITEM_BASE, variant.as_class(), size.as_class(), class);
	rsx! {
		div {
			class: cls,
			"data-slot": "item",
			"data-variant": variant.as_ref(),
			"data-size": size.as_ref(),
			{children}
		}
	}
}
#[component]
pub fn ItemMedia(#[props(default)] variant: ItemMediaVariant, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(ITEM_MEDIA_BASE, variant.as_class(), class);
	rsx! {
		div {
			class: cls,
			"data-slot": "item-media",
			"data-variant": variant.as_ref(),
			{children}
		}
	}
}
#[component]
pub fn ItemContent(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(ITEM_CONTENT, class);
	rsx! {
		div { class: cls, "data-slot": "item-content", {children} }
	}
}
#[component]
pub fn ItemTitle(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(ITEM_TITLE, class);
	rsx! {
		div { class: cls, "data-slot": "item-title", {children} }
	}
}
#[component]
pub fn ItemDescription(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(ITEM_DESCRIPTION, class);
	rsx! {
		p { class: cls, "data-slot": "item-description", {children} }
	}
}
#[component]
pub fn ItemActions(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(ITEM_ACTIONS, class);
	rsx! {
		div { class: cls, "data-slot": "item-actions", {children} }
	}
}
#[component]
pub fn ItemHeader(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(ITEM_HEADER, class);
	rsx! {
		div { class: cls, "data-slot": "item-header", {children} }
	}
}
#[component]
pub fn ItemFooter(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(ITEM_FOOTER, class);
	rsx! {
		div { class: cls, "data-slot": "item-footer", {children} }
	}
}
#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn item_default_variant_and_size() {
		fn app() -> Element {
			rsx! {
				Item { "x" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"item\""), "{html}");
		assert!(html.contains("data-variant=\"default\""), "{html}");
		assert!(html.contains("data-size=\"md\""), "{html}");
		assert!(html.contains("rounded-md"), "{html}");
	}

	#[test]
	fn item_outline_and_sm_are_canon() {
		fn app() -> Element {
			rsx! {
				Item { variant: ItemVariant::Outline, size: ItemSize::Sm, "x" }
			}
		}
		let html = render(app);
		assert!(html.contains("border-border"), "{html}");
		assert!(html.contains("gap-2.5"), "{html}");
		assert!(html.contains("data-variant=\"outline\""), "{html}");
		assert!(html.contains("data-size=\"sm\""), "{html}");
	}

	#[test]
	fn media_image_variant_is_canon() {
		fn app() -> Element {
			rsx! {
				ItemMedia { variant: ItemMediaVariant::Image, "m" }
			}
		}
		let html = render(app);
		assert!(html.contains("size-10"), "{html}");
		assert!(html.contains("object-cover"), "{html}");
		assert!(html.contains("data-variant=\"image\""), "{html}");
	}

	#[test]
	fn separator_wraps_separator_with_my_0() {
		fn app() -> Element {
			rsx! { ItemSeparator {} }
		}
		let html = render(app);
		assert!(html.contains("my-0"), "{html}");
		assert!(html.contains("data-slot=\"separator\""), "{html}");
	}

	#[test]
	fn family_parts_carry_slots() {
		fn app() -> Element {
			rsx! {
				ItemGroup { "g" }
				ItemContent { "c" }
				ItemTitle { "t" }
				ItemDescription { "d" }
				ItemActions { "a" }
				ItemHeader { "h" }
				ItemFooter { "f" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"item-group\""), "{html}");
		assert!(html.contains("data-slot=\"item-content\""), "{html}");
		assert!(html.contains("data-slot=\"item-title\""), "{html}");
		assert!(html.contains("data-slot=\"item-description\""), "{html}");
		assert!(html.contains("data-slot=\"item-actions\""), "{html}");
		assert!(html.contains("data-slot=\"item-header\""), "{html}");
		assert!(html.contains("data-slot=\"item-footer\""), "{html}");
	}
}
