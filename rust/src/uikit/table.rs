use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{TABLE, TABLE_BODY, TABLE_CAPTION, TABLE_CARD, TABLE_CELL, TABLE_CONTAINER, TABLE_FOOTER, TABLE_HEAD, TABLE_HEADER, TABLE_ROW, TableAlign, TableDensity, TableVariant},
};

/// `variant` and `density` only set inherited `--table-*` properties on the
/// `<table>`; the heads and cells read them, so their own `class` still wins.
#[component]
pub fn Table(#[props(default)] variant: TableVariant, #[props(default)] density: TableDensity, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(TABLE, variant.as_class(), density.as_class(), class);
	rsx! {
		div { class: TABLE_CONTAINER, "data-slot": "table-container",
			table {
				class: cls,
				"data-slot": "table",
				"data-variant": variant.as_ref(),
				"data-density": density.as_ref(),
				{children}
			}
		}
	}
}

/// The surface a `TableVariant::Card` table sits in, edge to edge.
#[component]
pub fn TableCard(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(TABLE_CARD, class);
	rsx! {
		div { class: cls, "data-slot": "table-card", {children} }
	}
}

#[component]
pub fn TableHeader(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(TABLE_HEADER, class);
	rsx! {
		thead { class: cls, "data-slot": "table-header", {children} }
	}
}

#[component]
pub fn TableBody(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(TABLE_BODY, class);
	rsx! {
		tbody { class: cls, "data-slot": "table-body", {children} }
	}
}

#[component]
pub fn TableFooter(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(TABLE_FOOTER, class);
	rsx! {
		tfoot { class: cls, "data-slot": "table-footer", {children} }
	}
}

#[component]
pub fn TableRow(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(TABLE_ROW, class);
	rsx! {
		tr { class: cls, "data-slot": "table-row", {children} }
	}
}

#[component]
pub fn TableHead(#[props(default)] align: TableAlign, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(TABLE_HEAD, align.as_class(), class);
	rsx! {
		th { class: cls, "data-slot": "table-head", {children} }
	}
}

#[component]
pub fn TableCell(#[props(default)] align: TableAlign, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(TABLE_CELL, align.as_class(), class);
	rsx! {
		td { class: cls, "data-slot": "table-cell", {children} }
	}
}

#[component]
pub fn TableCaption(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(TABLE_CAPTION, class);
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
		// the landing `p-2` is now the `var()` fallback, so it holds outside any table
		assert!(html.contains("px-[var(--table-px,calc(var(--spacing)*2))]"), "{html}");
		assert!(html.contains("py-[var(--table-dense-py,var(--table-py,calc(var(--spacing)*2)))]"), "{html}");
		assert!(html.contains("align-middle"), "{html}");
	}

	#[test]
	fn default_table_resets_inherited_custom_properties() {
		fn app() -> Element {
			rsx! {
				Table { "x" }
			}
		}
		let html = render(app);
		// Nested in a card table, a default one must not wear the card geometry.
		assert!(html.contains("[--table-px:initial]"), "{html}");
		assert!(html.contains("[--table-dense-py:initial]"), "{html}");
		assert!(!html.contains("calc(var(--spacing)*5)"), "{html}");
		assert!(html.contains("data-variant=\"default\""), "{html}");
		assert!(html.contains("data-density=\"default\""), "{html}");
	}

	#[test]
	fn card_compact_table_carries_its_geometry_on_the_table() {
		fn app() -> Element {
			rsx! {
				Table { variant: TableVariant::Card, density: TableDensity::Compact,
					TableBody {
						TableRow {
							TableCell { "c" }
						}
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-variant=\"card\""), "{html}");
		assert!(html.contains("data-density=\"compact\""), "{html}");
		assert!(html.contains("[--table-head-case:uppercase]"), "{html}");
		assert!(html.contains("[--table-dense-py:calc(var(--spacing)*1.5)]"), "{html}");
		// dioxus-ssr escapes `&` and `>` as numeric references
		assert!(html.contains("thead") && html.contains("tr:hover]:bg-transparent"), "{html}");
		// the cell itself is unchanged: it only reads the properties
		assert!(!html.contains("px-5"), "{html}");
	}

	#[test]
	fn cell_class_beats_the_table_geometry() {
		fn app() -> Element {
			rsx! {
				Table { variant: TableVariant::Card,
					TableBody {
						TableRow {
							TableCell { class: "px-4", "c" }
						}
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("px-4"), "{html}");
		assert!(!html.contains("px-[var(--table-px"), "{html}");
	}

	#[test]
	fn align_end_right_aligns_with_tabular_numbers() {
		fn app() -> Element {
			rsx! {
				TableHead { align: TableAlign::End, "h" }
				TableCell { align: TableAlign::End, "1.00" }
			}
		}
		let html = render(app);
		assert_eq!(html.matches("text-end tabular-nums").count(), 2, "{html}");
		assert!(!html.contains("text-start"), "{html}");
	}

	#[test]
	fn table_card_is_a_paddingless_card() {
		fn app() -> Element {
			rsx! {
				TableCard {
					Table { variant: TableVariant::Card, "x" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"table-card\""), "{html}");
		assert!(html.contains("overflow-hidden"), "{html}");
		assert!(html.contains("rounded-xl"), "{html}");
		assert!(!html.contains("py-6"), "{html}");
	}
}
