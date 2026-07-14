use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{ButtonVariant, Size, button::button_classes},
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

/// `href` is optional but wanted: an `<a>` without one is neither focusable nor
/// announced as a link, so a link given neither `href` nor `onclick` is inert.
#[component]
pub fn PaginationLink(
	#[props(default)] is_active: bool,
	#[props(default)] size: Size,
	#[props(default = true)] icon: bool,
	#[props(default)] class: String,
	href: Option<String>,
	onclick: Option<EventHandler<MouseEvent>>,
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
			href,
			onclick: move |e| { if let Some(h) = onclick { h.call(e); } },
			{children}
		}
	}
}

#[component]
pub fn PaginationPrevious(#[props(default)] class: String, href: Option<String>, onclick: Option<EventHandler<MouseEvent>>) -> Element {
	let cls = cn!("gap-1 px-2.5 sm:pl-2.5", class);
	rsx! {
		PaginationLink {
			is_active: false,
			icon: false,
			class: cls,
			href,
			onclick: move |e| { if let Some(h) = onclick { h.call(e); } },
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
pub fn PaginationNext(#[props(default)] class: String, href: Option<String>, onclick: Option<EventHandler<MouseEvent>>) -> Element {
	let cls = cn!("gap-1 px-2.5 sm:pr-2.5", class);
	rsx! {
		PaginationLink {
			is_active: false,
			icon: false,
			class: cls,
			href,
			onclick: move |e| { if let Some(h) = onclick { h.call(e); } },
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
	fn link_href_reaches_the_anchor() {
		fn app() -> Element {
			rsx! {
				PaginationLink { href: "?page=2", "2" }
			}
		}
		let html = render(app);
		assert!(html.contains("href=\"?page=2\""), "{html}");
	}

	#[test]
	fn previous_and_next_forward_href() {
		fn app() -> Element {
			rsx! {
				PaginationPrevious { href: "?page=1" }
				PaginationNext { href: "?page=3" }
			}
		}
		let html = render(app);
		assert!(html.contains("href=\"?page=1\""), "{html}");
		assert!(html.contains("href=\"?page=3\""), "{html}");
	}

	#[test]
	fn link_without_href_emits_no_empty_href() {
		fn app() -> Element {
			rsx! {
				PaginationLink { "2" }
			}
		}
		let html = render(app);
		assert!(!html.contains("href"), "an empty href would point the link at the current page: {html}");
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
