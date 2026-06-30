use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		SHEET_CLOSE, SHEET_CONTENT, SHEET_DESCRIPTION, SHEET_FOOTER, SHEET_HEADER, SHEET_OVERLAY, SHEET_SIDE_BOTTOM, SHEET_SIDE_LEFT, SHEET_SIDE_RIGHT, SHEET_SIDE_TOP, SHEET_TITLE,
		primitives::{Controllable, Side, use_controllable},
	},
};

#[component]
pub fn Sheet(open: Option<bool>, #[props(default)] default_open: bool, on_open_change: Option<EventHandler<bool>>, children: Element) -> Element {
	let state = use_controllable(open, default_open, on_open_change);
	use_context_provider(|| SheetCtx { open: state });
	rsx! {
		div { "data-slot": "sheet", {children} }
	}
}
#[component]
pub fn SheetTrigger(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<SheetCtx>();
	rsx! {
		button {
			r#type: "button",
			class,
			"data-slot": "sheet-trigger",
			"aria-expanded": if ctx.open.get() { "true" } else { "false" },
			onclick: move |_| ctx.open.set(true),
			{children}
		}
	}
}
#[component]
pub fn SheetContent(#[props(default = Side::Right)] side: Side, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<SheetCtx>();
	if !ctx.open.get() {
		return rsx! {};
	}
	let cls = cn!(SHEET_CONTENT, side_class(side), class);
	rsx! {
		// dep-light: native focus order, no trap/portal — see README Limitations
		div {
			class: SHEET_OVERLAY,
			"data-slot": "sheet-overlay",
			"data-state": "open",
			onclick: move |_| ctx.open.set(false),
		}
		div {
			role: "dialog",
			"aria-modal": "true",
			class: cls,
			"data-slot": "sheet-content",
			"data-state": "open",
			tabindex: "-1",
			onclick: move |e| e.stop_propagation(),
			onkeydown: move |e| if e.key() == Key::Escape { ctx.open.set(false) },
			{children}
			button {
				r#type: "button",
				class: SHEET_CLOSE,
				"data-slot": "sheet-close",
				onclick: move |_| ctx.open.set(false),
				svg {
					xmlns: "http://www.w3.org/2000/svg",
					width: "24",
					height: "24",
					view_box: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					stroke_width: "2",
					stroke_linecap: "round",
					stroke_linejoin: "round",
					class: "size-4",
					path { d: "M18 6 6 18M6 6l12 12" }
				}
				span { class: "sr-only", "Close" }
			}
		}
	}
}
#[component]
pub fn SheetClose(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<SheetCtx>();
	rsx! {
		button {
			r#type: "button",
			class,
			"data-slot": "sheet-close",
			onclick: move |_| ctx.open.set(false),
			{children}
		}
	}
}
#[component]
pub fn SheetHeader(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(SHEET_HEADER, class);
	rsx! {
		div { class: cls, "data-slot": "sheet-header", {children} }
	}
}
#[component]
pub fn SheetFooter(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(SHEET_FOOTER, class);
	rsx! {
		div { class: cls, "data-slot": "sheet-footer", {children} }
	}
}
#[component]
pub fn SheetTitle(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(SHEET_TITLE, class);
	rsx! {
		h2 { class: cls, "data-slot": "sheet-title", {children} }
	}
}
#[component]
pub fn SheetDescription(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(SHEET_DESCRIPTION, class);
	rsx! {
		p { class: cls, "data-slot": "sheet-description", {children} }
	}
}
/// Per-side slide-in/positioning classes, canonical with the TS `sheetSideClasses`.
fn side_class(side: Side) -> &'static str {
	match side {
		Side::Right => SHEET_SIDE_RIGHT,
		Side::Left => SHEET_SIDE_LEFT,
		Side::Top => SHEET_SIDE_TOP,
		Side::Bottom => SHEET_SIDE_BOTTOM,
	}
}

#[derive(Clone, Copy)]
struct SheetCtx {
	open: Controllable<bool>,
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn closed_by_default_hides_content() {
		fn app() -> Element {
			rsx! {
				Sheet {
					SheetTrigger { "open" }
					SheetContent {
						SheetTitle { "Title" }
						SheetDescription { "Body" }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"sheet-trigger\""), "{html}");
		assert!(!html.contains("Body"), "content hidden while closed: {html}");
	}

	#[test]
	fn default_open_reveals_dialog_with_role() {
		fn app() -> Element {
			rsx! {
				Sheet { default_open: true,
					SheetContent {
						SheetTitle { "Title" }
						SheetDescription { "Body" }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("role=\"dialog\""), "{html}");
		assert!(html.contains("aria-modal=\"true\""), "{html}");
		assert!(html.contains("data-state=\"open\""), "{html}");
		assert!(html.contains("Title"), "{html}");
		assert!(html.contains("Body"), "{html}");
	}

	#[test]
	fn side_drives_slide_in_classes() {
		fn app() -> Element {
			rsx! {
				Sheet { default_open: true,
					SheetContent { side: Side::Left, SheetTitle { "Left" } }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("slide-in-from-left"), "{html}");
	}
}
