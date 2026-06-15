use dioxus::prelude::*;

use crate::cn;

const EMPTY_MEDIA_BASE: &str = "flex shrink-0 items-center justify-center mb-2 [&_svg]:pointer-events-none [&_svg]:shrink-0";
#[component]
pub fn Empty(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(
		"flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border-dashed p-6 text-center text-balance md:p-12",
		class
	);
	rsx! {
		div { class: cls, "data-slot": "empty", {children} }
	}
}

#[component]
pub fn EmptyHeader(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("flex max-w-sm flex-col items-center gap-2 text-center", class);
	rsx! {
		div { class: cls, "data-slot": "empty-header", {children} }
	}
}

#[derive(Clone, Default, PartialEq)]
pub enum EmptyMediaVariant {
	#[default]
	Default,
	Icon,
}

impl EmptyMediaVariant {
	fn class(&self) -> &'static str {
		match self {
			EmptyMediaVariant::Default => "bg-transparent",
			EmptyMediaVariant::Icon => "bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*='size-'])]:size-6",
		}
	}

	fn attr(&self) -> &'static str {
		match self {
			EmptyMediaVariant::Default => "default",
			EmptyMediaVariant::Icon => "icon",
		}
	}
}

#[component]
pub fn EmptyMedia(#[props(default)] variant: EmptyMediaVariant, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(EMPTY_MEDIA_BASE, variant.class(), class);
	rsx! {
		div {
			class: cls,
			"data-slot": "empty-icon",
			"data-variant": variant.attr(),
			{children}
		}
	}
}

#[component]
pub fn EmptyTitle(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("text-lg font-medium tracking-tight", class);
	rsx! {
		div { class: cls, "data-slot": "empty-title", {children} }
	}
}

#[component]
pub fn EmptyDescription(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4", class);
	rsx! {
		div { class: cls, "data-slot": "empty-description", {children} }
	}
}

#[component]
pub fn EmptyContent(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance", class);
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
