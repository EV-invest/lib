use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		ALERT_DIALOG_CONTENT, ALERT_DIALOG_DESCRIPTION, ALERT_DIALOG_FOOTER, ALERT_DIALOG_HEADER, ALERT_DIALOG_OVERLAY, ALERT_DIALOG_TITLE, ButtonVariant, Size,
		button::button_classes,
		primitives::{Controllable, use_controllable},
	},
};

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
	let cls = cn!(ALERT_DIALOG_CONTENT, class);
	rsx! {
		// dep-light: native focus order, no trap/portal — see README Limitations
		div {
			class: ALERT_DIALOG_OVERLAY,
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
	let cls = cn!(ALERT_DIALOG_HEADER, class);
	rsx! {
		div { class: cls, "data-slot": "alert-dialog-header", {children} }
	}
}
#[component]
pub fn AlertDialogFooter(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(ALERT_DIALOG_FOOTER, class);
	rsx! {
		div { class: cls, "data-slot": "alert-dialog-footer", {children} }
	}
}
#[component]
pub fn AlertDialogTitle(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(ALERT_DIALOG_TITLE, class);
	rsx! {
		h2 { class: cls, "data-slot": "alert-dialog-title", {children} }
	}
}
#[component]
pub fn AlertDialogDescription(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(ALERT_DIALOG_DESCRIPTION, class);
	rsx! {
		p { class: cls, "data-slot": "alert-dialog-description", {children} }
	}
}
/// The confirm button: runs `onclick` — the consumer's destructive action —
/// then closes the dialog.
#[component]
pub fn AlertDialogAction(onclick: Option<EventHandler<MouseEvent>>, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<AlertDialogCtx>();
	let cls = button_classes(&ButtonVariant::Default, Size::Md, false, &class);
	rsx! {
		button {
			r#type: "button",
			class: cls,
			"data-slot": "alert-dialog-action",
			onclick: move |e| {
				if let Some(h) = onclick {
					h.call(e);
				}
				ctx.open.set(false);
			},
			{children}
		}
	}
}
/// The dismiss button: runs `onclick`, then closes the dialog.
#[component]
pub fn AlertDialogCancel(onclick: Option<EventHandler<MouseEvent>>, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<AlertDialogCtx>();
	let cls = button_classes(&ButtonVariant::Outline, Size::Md, false, &class);
	rsx! {
		button {
			r#type: "button",
			class: cls,
			"data-slot": "alert-dialog-cancel",
			onclick: move |e| {
				if let Some(h) = onclick {
					h.call(e);
				}
				ctx.open.set(false);
			},
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
	use std::sync::atomic::{AtomicUsize, Ordering};

	use super::*;
	use crate::uikit::test_util::{click_every_element, render};

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
	fn action_and_cancel_run_the_consumer_handler() {
		static CONFIRMED: AtomicUsize = AtomicUsize::new(0);
		static CANCELLED: AtomicUsize = AtomicUsize::new(0);

		fn app() -> Element {
			rsx! {
				AlertDialog { default_open: true,
					AlertDialogContent {
						AlertDialogFooter {
							AlertDialogCancel {
								onclick: move |_| {
									CANCELLED.fetch_add(1, Ordering::SeqCst);
								},
								"Cancel"
							}
							AlertDialogAction {
								onclick: move |_| {
									CONFIRMED.fetch_add(1, Ordering::SeqCst);
								},
								"Delete"
							}
						}
					}
				}
			}
		}
		click_every_element(app);
		assert_eq!(CONFIRMED.load(Ordering::SeqCst), 1, "the confirm handler must run when the action button is clicked");
		assert_eq!(CANCELLED.load(Ordering::SeqCst), 1, "the cancel handler must run when the cancel button is clicked");
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
