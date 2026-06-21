use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		Size,
		button::{ButtonVariant, button_classes},
	},
};

#[component]
pub fn Pagination(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("mx-auto flex w-full justify-center", class);
	rsx! {
		nav {
			role: "navigation",
			"aria-label": "pagination",
			"data-slot": "pagination",
			class: cls,
			{children}
		}
	}
}

#[component]
pub fn PaginationContent(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("flex flex-row items-center gap-1", class);
	rsx! {
		ul { "data-slot": "pagination-content", class: cls, {children} }
	}
}

#[component]
pub fn PaginationItem(children: Element) -> Element {
	rsx! {
		li { "data-slot": "pagination-item", {children} }
	}
}

#[component]
pub fn PaginationLink(
	#[props(default)] is_active: bool,
	#[props(default)] size: Size,
	#[props(default = true)] icon: bool,
	#[props(default)] class: String,
	children: Element,
) -> Element {
	let variant = if is_active { ButtonVariant::Outline } else { ButtonVariant::Ghost };
	let cls = button_classes(&variant, size, icon, &class);
	rsx! {
		a {
			"aria-current": if is_active { "page" },
			"data-slot": "pagination-link",
			"data-active": is_active,
			class: cls,
			{children}
		}
	}
}

#[component]
pub fn PaginationPrevious(#[props(default)] class: String) -> Element {
	let cls = cn!("gap-1 px-2.5 sm:pl-2.5", class);
	rsx! {
		PaginationLink {
			is_active: false,
			icon: false,
			class: cls,
			svg {
				view_box: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				stroke_width: "2",
				path { d: "m15 18-6-6 6-6" }
			}
			span { class: "hidden sm:block", "Previous" }
		}
	}
}

#[component]
pub fn PaginationNext(#[props(default)] class: String) -> Element {
	let cls = cn!("gap-1 px-2.5 sm:pr-2.5", class);
	rsx! {
		PaginationLink {
			is_active: false,
			icon: false,
			class: cls,
			span { class: "hidden sm:block", "Next" }
			svg {
				view_box: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				stroke_width: "2",
				path { d: "m9 18 6-6-6-6" }
			}
		}
	}
}

#[component]
pub fn PaginationEllipsis(#[props(default)] class: String) -> Element {
	let cls = cn!("flex size-9 items-center justify-center", class);
	rsx! {
		span {
			"aria-hidden": "true",
			"data-slot": "pagination-ellipsis",
			class: cls,
			svg {
				class: "size-4",
				view_box: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				stroke_width: "2",
				circle { cx: "12", cy: "12", r: "1" }
				circle { cx: "19", cy: "12", r: "1" }
				circle { cx: "5", cy: "12", r: "1" }
			}
			span { class: "sr-only", "More pages" }
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn pagination_wraps_a_nav() {
		fn app() -> Element {
			rsx! {
				Pagination {
					PaginationContent {
						PaginationItem {
							PaginationLink { "1" }
						}
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("aria-label=\"pagination\""), "{html}");
		assert!(html.contains("data-slot=\"pagination-link\""));
	}

	#[test]
	fn active_link_uses_outline_variant() {
		fn app() -> Element {
			rsx! {
				PaginationLink { is_active: true, "2" }
			}
		}
		let html = render(app);
		assert!(html.contains("aria-current=\"page\""), "{html}");
		assert!(html.contains("border"), "outline variant adds border: {html}");
	}

	#[test]
	fn previous_renders_chevron_and_label() {
		fn app() -> Element {
			rsx! { PaginationPrevious {} }
		}
		let html = render(app);
		assert!(html.contains("m15 18-6-6 6-6"), "{html}");
		assert!(html.contains("Previous"));
	}

	#[test]
	fn ellipsis_is_aria_hidden() {
		fn app() -> Element {
			rsx! { PaginationEllipsis {} }
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"pagination-ellipsis\""), "{html}");
		assert!(html.contains("More pages"));
	}
}
