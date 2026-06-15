use dioxus::prelude::*;

use crate::{
	cn,
	uikit::primitives::{Controllable, Side, use_controllable},
};

const SHEET_OVERLAY: &str = "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 \
                             data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50";
const SHEET_CONTENT: &str = "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 \
                             shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500";
const SHEET_CLOSE: &str = "ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity \
                           hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none";

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
	let cls = cn!("flex flex-col gap-1.5 p-4", class);
	rsx! {
		div { class: cls, "data-slot": "sheet-header", {children} }
	}
}
#[component]
pub fn SheetFooter(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("mt-auto flex flex-col gap-2 p-4", class);
	rsx! {
		div { class: cls, "data-slot": "sheet-footer", {children} }
	}
}
#[component]
pub fn SheetTitle(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("text-foreground font-semibold", class);
	rsx! {
		h2 { class: cls, "data-slot": "sheet-title", {children} }
	}
}
#[component]
pub fn SheetDescription(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("text-muted-foreground text-sm", class);
	rsx! {
		p { class: cls, "data-slot": "sheet-description", {children} }
	}
}
/// Per-side slide-in/positioning classes, canonical with the TS `sheetSideClasses`.
fn side_class(side: Side) -> &'static str {
	match side {
		Side::Right => "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
		Side::Left => "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
		Side::Top => "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
		Side::Bottom => "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
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
