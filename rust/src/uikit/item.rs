use dioxus::prelude::*;

use crate::{
	cn,
	uikit::separator::{Orientation, Separator},
};

#[component]
pub fn ItemGroup(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("group/item-group flex flex-col", class);
	rsx! {
		div { role: "list", class: cls, "data-slot": "item-group", {children} }
	}
}

#[component]
pub fn ItemSeparator(#[props(default)] class: String) -> Element {
	let cls = cn!("my-0", class);
	rsx! {
		Separator { orientation: Orientation::Horizontal, class: cls }
	}
}

#[derive(Clone, Default, PartialEq)]
pub enum ItemVariant {
	#[default]
	Default,
	Outline,
	Muted,
}

impl ItemVariant {
	fn class(&self) -> &'static str {
		match self {
			ItemVariant::Default => "bg-transparent",
			ItemVariant::Outline => "border-border",
			ItemVariant::Muted => "bg-muted/50",
		}
	}

	fn attr(&self) -> &'static str {
		match self {
			ItemVariant::Default => "default",
			ItemVariant::Outline => "outline",
			ItemVariant::Muted => "muted",
		}
	}
}

#[derive(Clone, Default, PartialEq)]
pub enum ItemSize {
	#[default]
	Default,
	Sm,
}

impl ItemSize {
	fn class(&self) -> &'static str {
		match self {
			ItemSize::Default => "p-4 gap-4 ",
			ItemSize::Sm => "py-3 px-4 gap-2.5",
		}
	}

	fn attr(&self) -> &'static str {
		match self {
			ItemSize::Default => "default",
			ItemSize::Sm => "sm",
		}
	}
}

const ITEM_BASE: &str = "group/item flex items-center border border-transparent text-sm rounded-md transition-colors \
                         [a]:hover:bg-accent/50 [a]:transition-colors duration-100 flex-wrap outline-none \
                         focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

#[component]
pub fn Item(#[props(default)] variant: ItemVariant, #[props(default)] size: ItemSize, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(ITEM_BASE, variant.class(), size.class(), class);
	rsx! {
		div {
			class: cls,
			"data-slot": "item",
			"data-variant": variant.attr(),
			"data-size": size.attr(),
			{children}
		}
	}
}

#[derive(Clone, Default, PartialEq)]
pub enum ItemMediaVariant {
	#[default]
	Default,
	Icon,
	Image,
}

impl ItemMediaVariant {
	fn class(&self) -> &'static str {
		match self {
			ItemMediaVariant::Default => "bg-transparent",
			ItemMediaVariant::Icon => "size-8 border rounded-sm bg-muted [&_svg:not([class*='size-'])]:size-4",
			ItemMediaVariant::Image => "size-10 rounded-sm overflow-hidden [&_img]:size-full [&_img]:object-cover",
		}
	}

	fn attr(&self) -> &'static str {
		match self {
			ItemMediaVariant::Default => "default",
			ItemMediaVariant::Icon => "icon",
			ItemMediaVariant::Image => "image",
		}
	}
}

const ITEM_MEDIA_BASE: &str = "flex shrink-0 items-center justify-center gap-2 \
                               group-has-[[data-slot=item-description]]/item:self-start [&_svg]:pointer-events-none \
                               group-has-[[data-slot=item-description]]/item:translate-y-0.5";

#[component]
pub fn ItemMedia(#[props(default)] variant: ItemMediaVariant, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(ITEM_MEDIA_BASE, variant.class(), class);
	rsx! {
		div {
			class: cls,
			"data-slot": "item-media",
			"data-variant": variant.attr(),
			{children}
		}
	}
}

#[component]
pub fn ItemContent(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("flex flex-1 flex-col gap-1 [&+[data-slot=item-content]]:flex-none", class);
	rsx! {
		div { class: cls, "data-slot": "item-content", {children} }
	}
}

#[component]
pub fn ItemTitle(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("flex w-fit items-center gap-2 text-sm leading-snug font-medium", class);
	rsx! {
		div { class: cls, "data-slot": "item-title", {children} }
	}
}

#[component]
pub fn ItemDescription(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(
		"text-muted-foreground line-clamp-2 text-sm leading-normal font-normal text-balance \
         [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
		class
	);
	rsx! {
		p { class: cls, "data-slot": "item-description", {children} }
	}
}

#[component]
pub fn ItemActions(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("flex items-center gap-2", class);
	rsx! {
		div { class: cls, "data-slot": "item-actions", {children} }
	}
}

#[component]
pub fn ItemHeader(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("flex basis-full items-center justify-between gap-2", class);
	rsx! {
		div { class: cls, "data-slot": "item-header", {children} }
	}
}

#[component]
pub fn ItemFooter(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("flex basis-full items-center justify-between gap-2", class);
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
		assert!(html.contains("data-size=\"default\""), "{html}");
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
