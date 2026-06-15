use dioxus::prelude::*;

use crate::cn;

#[component]
pub fn Table(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("w-full caption-bottom text-sm", class);
	rsx! {
		div { class: "relative w-full overflow-x-auto", "data-slot": "table-container",
			table { class: cls, "data-slot": "table", {children} }
		}
	}
}

#[component]
pub fn TableHeader(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("[&_tr]:border-b", class);
	rsx! {
		thead { class: cls, "data-slot": "table-header", {children} }
	}
}

#[component]
pub fn TableBody(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("[&_tr:last-child]:border-0", class);
	rsx! {
		tbody { class: cls, "data-slot": "table-body", {children} }
	}
}

#[component]
pub fn TableFooter(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("bg-muted/50 border-t font-medium [&>tr]:last:border-b-0", class);
	rsx! {
		tfoot { class: cls, "data-slot": "table-footer", {children} }
	}
}

#[component]
pub fn TableRow(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors", class);
	rsx! {
		tr { class: cls, "data-slot": "table-row", {children} }
	}
}

#[component]
pub fn TableHead(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(
		"text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap \
         [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
		class
	);
	rsx! {
		th { class: cls, "data-slot": "table-head", {children} }
	}
}

#[component]
pub fn TableCell(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]", class);
	rsx! {
		td { class: cls, "data-slot": "table-cell", {children} }
	}
}

#[component]
pub fn TableCaption(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("text-muted-foreground mt-4 text-sm", class);
	rsx! {
		caption { class: cls, "data-slot": "table-caption", {children} }
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn table_wraps_in_scroll_container() {
		fn app() -> Element {
			rsx! {
				Table { "x" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"table-container\""), "{html}");
		assert!(html.contains("overflow-x-auto"), "{html}");
		assert!(html.contains("data-slot=\"table\""), "{html}");
	}

	#[test]
	fn footer_is_landing_canon() {
		fn app() -> Element {
			rsx! {
				TableFooter { "f" }
			}
		}
		let html = render(app);
		assert!(html.contains("bg-muted/50"), "{html}");
		assert!(html.contains("border-t"), "{html}");
		assert!(html.contains("data-slot=\"table-footer\""), "{html}");
	}

	#[test]
	fn cell_uses_landing_padding_and_checkbox_rules() {
		fn app() -> Element {
			rsx! {
				TableCell { "c" }
			}
		}
		let html = render(app);
		assert!(html.contains("p-2"), "{html}");
		assert!(html.contains("align-middle"), "{html}");
	}
}
