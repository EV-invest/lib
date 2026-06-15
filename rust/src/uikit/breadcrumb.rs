use dioxus::prelude::*;

use crate::cn;

#[component]
pub fn Breadcrumb(#[props(default)] class: String, children: Element) -> Element {
	rsx! {
		nav {
			class,
			"aria-label": "breadcrumb",
			"data-slot": "breadcrumb",
			{children}
		}
	}
}

#[component]
pub fn BreadcrumbList(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5", class);
	rsx! {
		ol { class: cls, "data-slot": "breadcrumb-list", {children} }
	}
}

#[component]
pub fn BreadcrumbItem(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("inline-flex items-center gap-1.5", class);
	rsx! {
		li { class: cls, "data-slot": "breadcrumb-item", {children} }
	}
}

#[component]
pub fn BreadcrumbLink(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("hover:text-foreground transition-colors", class);
	rsx! {
		a { class: cls, "data-slot": "breadcrumb-link", {children} }
	}
}

#[component]
pub fn BreadcrumbPage(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("text-foreground font-normal", class);
	rsx! {
		span {
			class: cls,
			"data-slot": "breadcrumb-page",
			role: "link",
			"aria-disabled": "true",
			"aria-current": "page",
			{children}
		}
	}
}

#[component]
pub fn BreadcrumbSeparator(#[props(default)] class: String, children: Option<Element>) -> Element {
	let cls = cn!("[&>svg]:size-3.5", class);
	rsx! {
		li {
			class: cls,
			"data-slot": "breadcrumb-separator",
			role: "presentation",
			"aria-hidden": "true",
			if let Some(children) = children {
				{children}
			} else {
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
}

#[component]
pub fn BreadcrumbEllipsis(#[props(default)] class: String) -> Element {
	let cls = cn!("flex size-9 items-center justify-center", class);
	rsx! {
		span {
			class: cls,
			"data-slot": "breadcrumb-ellipsis",
			role: "presentation",
			"aria-hidden": "true",
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
			span { class: "sr-only", "More" }
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn breadcrumb_nav_slot() {
		fn app() -> Element {
			rsx! { Breadcrumb { "x" } }
		}
		let html = render(app);
		assert!(html.contains("aria-label=\"breadcrumb\""), "{html}");
		assert!(html.contains("data-slot=\"breadcrumb\""), "{html}");
	}

	#[test]
	fn list_item_link_slots() {
		fn app() -> Element {
			rsx! {
				BreadcrumbList {
					BreadcrumbItem {
						BreadcrumbLink { "home" }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"breadcrumb-list\""), "{html}");
		assert!(html.contains("data-slot=\"breadcrumb-item\""), "{html}");
		assert!(html.contains("data-slot=\"breadcrumb-link\""), "{html}");
		assert!(html.contains("hover:text-foreground"), "{html}");
	}

	#[test]
	fn page_has_aria() {
		fn app() -> Element {
			rsx! {
				BreadcrumbPage { "here" }
			}
		}
		let html = render(app);
		assert!(html.contains("aria-current=\"page\""), "{html}");
		assert!(html.contains("data-slot=\"breadcrumb-page\""), "{html}");
	}

	#[test]
	fn separator_default_chevron() {
		fn app() -> Element {
			rsx! { BreadcrumbSeparator {} }
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"breadcrumb-separator\""), "{html}");
		assert!(html.contains("m9 18 6-6-6-6"), "{html}");
	}

	#[test]
	fn ellipsis_has_sr_only() {
		fn app() -> Element {
			rsx! { BreadcrumbEllipsis {} }
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"breadcrumb-ellipsis\""), "{html}");
		assert!(html.contains("More"), "{html}");
		assert!(html.contains("sr-only"), "{html}");
	}
}
