use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		ButtonVariant, Size,
		button::button_classes,
		primitives::{Controllable, use_controllable},
	},
};

const ALERT_OVERLAY: &str = "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 \
                             data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50";
const ALERT_CONTENT: &str = "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 \
                             data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] \
                             left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg \
                             border p-6 shadow-lg duration-200 sm:max-w-lg";

#[component]
pub fn AlertDialog(open: Option<bool>, #[props(default)] default_open: bool, on_open_change: Option<EventHandler<bool>>, children: Element) -> Element {
	let state = use_controllable(open, default_open, on_open_change);
	use_context_provider(|| AlertDialogCtx { open: state });
	rsx! {
		div { "data-slot": "alert-dialog", {children} }
	}
}
#[component]
pub fn AlertDialogTrigger(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<AlertDialogCtx>();
	rsx! {
		button {
			r#type: "button",
			class,
			"data-slot": "alert-dialog-trigger",
			"aria-expanded": if ctx.open.get() { "true" } else { "false" },
			onclick: move |_| ctx.open.set(true),
			{children}
		}
	}
}
#[component]
pub fn AlertDialogContent(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<AlertDialogCtx>();
	if !ctx.open.get() {
		return rsx! {};
	}
	let cls = cn!(ALERT_CONTENT, class);
	rsx! {
		// dep-light: native focus order, no trap/portal — see README Limitations
		div {
			class: ALERT_OVERLAY,
			"data-slot": "alert-dialog-overlay",
			"data-state": "open",
			onclick: move |_| ctx.open.set(false),
		}
		div {
			role: "alertdialog",
			"aria-modal": "true",
			class: cls,
			"data-slot": "alert-dialog-content",
			"data-state": "open",
			tabindex: "-1",
			onclick: move |e| e.stop_propagation(),
			onkeydown: move |e| if e.key() == Key::Escape { ctx.open.set(false) },
			{children}
		}
	}
}
#[component]
pub fn AlertDialogHeader(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("flex flex-col gap-2 text-center sm:text-left", class);
	rsx! {
		div { class: cls, "data-slot": "alert-dialog-header", {children} }
	}
}
#[component]
pub fn AlertDialogFooter(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", class);
	rsx! {
		div { class: cls, "data-slot": "alert-dialog-footer", {children} }
	}
}
#[component]
pub fn AlertDialogTitle(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("text-lg font-semibold", class);
	rsx! {
		h2 { class: cls, "data-slot": "alert-dialog-title", {children} }
	}
}
#[component]
pub fn AlertDialogDescription(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("text-muted-foreground text-sm", class);
	rsx! {
		p { class: cls, "data-slot": "alert-dialog-description", {children} }
	}
}
#[component]
pub fn AlertDialogAction(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<AlertDialogCtx>();
	let cls = button_classes(&ButtonVariant::Default, Size::Md, false, &class);
	rsx! {
		button {
			r#type: "button",
			class: cls,
			"data-slot": "alert-dialog-action",
			onclick: move |_| ctx.open.set(false),
			{children}
		}
	}
}
#[component]
pub fn AlertDialogCancel(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<AlertDialogCtx>();
	let cls = button_classes(&ButtonVariant::Outline, Size::Md, false, &class);
	rsx! {
		button {
			r#type: "button",
			class: cls,
			"data-slot": "alert-dialog-cancel",
			onclick: move |_| ctx.open.set(false),
			{children}
		}
	}
}
#[derive(Clone, Copy)]
struct AlertDialogCtx {
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
				AlertDialog {
					AlertDialogTrigger { "open" }
					AlertDialogContent {
						AlertDialogTitle { "Title" }
						AlertDialogDescription { "Body" }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"alert-dialog-trigger\""), "{html}");
		assert!(!html.contains("Body"), "content hidden while closed: {html}");
	}

	#[test]
	fn default_open_reveals_alertdialog_with_role() {
		fn app() -> Element {
			rsx! {
				AlertDialog { default_open: true,
					AlertDialogContent {
						AlertDialogTitle { "Title" }
						AlertDialogDescription { "Body" }
						AlertDialogFooter {
							AlertDialogCancel { "Cancel" }
							AlertDialogAction { "Confirm" }
						}
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("role=\"alertdialog\""), "{html}");
		assert!(html.contains("aria-modal=\"true\""), "{html}");
		assert!(html.contains("data-state=\"open\""), "{html}");
		assert!(html.contains("Title"), "{html}");
		assert!(html.contains("Body"), "{html}");
		assert!(!html.contains("data-slot=\"alert-dialog-close\""), "no close X: {html}");
	}

	#[test]
	fn action_reuses_button_classes() {
		fn app() -> Element {
			rsx! {
				AlertDialog { default_open: true,
					AlertDialogContent {
						AlertDialogAction { "Confirm" }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("bg-primary"), "action uses default button variant: {html}");
	}
}
