use dioxus::prelude::*;

use crate::{
	cn,
	uikit::primitives::{Controllable, use_controllable},
};

const DIALOG_OVERLAY: &str = "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 \
                              data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50";
const DIALOG_CONTENT: &str = "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 \
                              data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] \
                              left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg \
                              border p-6 shadow-lg duration-200 sm:max-w-lg";
const DIALOG_CLOSE: &str = "ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity \
                            hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none \
                            [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

#[component]
pub fn Dialog(open: Option<bool>, #[props(default)] default_open: bool, on_open_change: Option<EventHandler<bool>>, children: Element) -> Element {
	let state = use_controllable(open, default_open, on_open_change);
	use_context_provider(|| DialogCtx { open: state });
	rsx! {
		div { "data-slot": "dialog", {children} }
	}
}
#[component]
pub fn DialogTrigger(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<DialogCtx>();
	rsx! {
		button {
			r#type: "button",
			class,
			"data-slot": "dialog-trigger",
			"aria-expanded": if ctx.open.get() { "true" } else { "false" },
			onclick: move |_| ctx.open.set(true),
			{children}
		}
	}
}
/// Pass-through that mirrors the TS `DialogPortal`; the Rust kit renders inline
/// (no portal — see README Limitations).
#[component]
pub fn DialogPortal(children: Element) -> Element {
	rsx! {
		{children}
	}
}
#[component]
pub fn DialogContent(#[props(default = true)] show_close_button: bool, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<DialogCtx>();
	if !ctx.open.get() {
		return rsx! {};
	}
	let cls = cn!(DIALOG_CONTENT, class);
	rsx! {
		// dep-light: native focus order, no trap/portal — see README Limitations
		div {
			class: DIALOG_OVERLAY,
			"data-slot": "dialog-overlay",
			"data-state": "open",
			onclick: move |_| ctx.open.set(false),
		}
		div {
			role: "dialog",
			"aria-modal": "true",
			class: cls,
			"data-slot": "dialog-content",
			"data-state": "open",
			tabindex: "-1",
			onclick: move |e| e.stop_propagation(),
			onkeydown: move |e| if e.key() == Key::Escape { ctx.open.set(false) },
			{children}
			if show_close_button {
				button {
					r#type: "button",
					class: DIALOG_CLOSE,
					"data-slot": "dialog-close",
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
						path { d: "M18 6 6 18M6 6l12 12" }
					}
					span { class: "sr-only", "Close" }
				}
			}
		}
	}
}
#[component]
pub fn DialogClose(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<DialogCtx>();
	rsx! {
		button {
			r#type: "button",
			class,
			"data-slot": "dialog-close",
			onclick: move |_| ctx.open.set(false),
			{children}
		}
	}
}
#[component]
pub fn DialogHeader(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("flex flex-col gap-2 text-center sm:text-left", class);
	rsx! {
		div { class: cls, "data-slot": "dialog-header", {children} }
	}
}
#[component]
pub fn DialogFooter(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", class);
	rsx! {
		div { class: cls, "data-slot": "dialog-footer", {children} }
	}
}
#[component]
pub fn DialogTitle(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("text-lg leading-none font-semibold", class);
	rsx! {
		h2 { class: cls, "data-slot": "dialog-title", {children} }
	}
}
#[component]
pub fn DialogDescription(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("text-muted-foreground text-sm", class);
	rsx! {
		p { class: cls, "data-slot": "dialog-description", {children} }
	}
}
#[derive(Clone, Copy)]
struct DialogCtx {
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
				Dialog {
					DialogTrigger { "open" }
					DialogContent {
						DialogTitle { "Title" }
						DialogDescription { "Body" }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"dialog-trigger\""), "{html}");
		assert!(!html.contains("Body"), "content hidden while closed: {html}");
	}

	#[test]
	fn default_open_reveals_dialog_with_role() {
		fn app() -> Element {
			rsx! {
				Dialog { default_open: true,
					DialogTrigger { "open" }
					DialogContent {
						DialogTitle { "Title" }
						DialogDescription { "Body" }
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
		assert!(html.contains("data-slot=\"dialog-close\""), "default close button: {html}");
	}

	#[test]
	fn hide_close_button() {
		fn app() -> Element {
			rsx! {
				Dialog { default_open: true,
					DialogContent { show_close_button: false, DialogTitle { "Title" } }
				}
			}
		}
		let html = render(app);
		assert!(!html.contains("data-slot=\"dialog-close\""), "{html}");
	}
}
