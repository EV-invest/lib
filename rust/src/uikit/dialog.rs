use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		DIALOG_CLOSE, DIALOG_CONTENT, DIALOG_DESCRIPTION, DIALOG_FOOTER, DIALOG_HEADER, DIALOG_OVERLAY, DIALOG_TITLE,
		primitives::{Controllable, use_controllable},
	},
};

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
	let cls = cn!(DIALOG_HEADER, class);
	rsx! {
		div { class: cls, "data-slot": "dialog-header", {children} }
	}
}
#[component]
pub fn DialogFooter(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(DIALOG_FOOTER, class);
	rsx! {
		div { class: cls, "data-slot": "dialog-footer", {children} }
	}
}
#[component]
pub fn DialogTitle(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(DIALOG_TITLE, class);
	rsx! {
		h2 { class: cls, "data-slot": "dialog-title", {children} }
	}
}
#[component]
pub fn DialogDescription(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(DIALOG_DESCRIPTION, class);
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
