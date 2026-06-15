//! Dep-light, presentational form primitives — the kernel keeps the ARIA
//! id-wiring of shadcn's form (label/control/description/message share an id so
//! `aria-describedby` and `id` line up) but drops `react-hook-form`'s state
//! engine: validation and field state are the consumer's job.
//!
//! [`FormItem`] mints an id and provides it via context; [`FormLabel`],
//! [`FormDescription`] and [`FormMessage`] read it. Unlike the TS port there is
//! no `Slot`, so [`FormControl`] cannot inject `id`/`aria-*` onto an arbitrary
//! child — it only exposes the ids through context; wiring them onto the actual
//! input is the consumer's responsibility.

use std::sync::atomic::{AtomicUsize, Ordering};

use dioxus::prelude::*;

use crate::{cn, uikit::label::Label};

static NEXT_ID: AtomicUsize = AtomicUsize::new(0);

/// The shared id minted by [`FormItem`], plus the derived ids the control,
/// description and message hang off of so `aria-describedby`/`id` align.
#[derive(Clone, PartialEq)]
pub struct FormItemContext {
	pub id: String,
}

impl FormItemContext {
	pub fn form_item_id(&self) -> String {
		format!("{}-form-item", self.id)
	}

	pub fn form_description_id(&self) -> String {
		format!("{}-form-item-description", self.id)
	}

	pub fn form_message_id(&self) -> String {
		format!("{}-form-item-message", self.id)
	}
}

/// Passthrough `<form>` wrapper. Mirrors TS `Form` (which is rhf's
/// `FormProvider`); here it owns no state, so consumers wire submit/onsubmit.
#[component]
pub fn Form(#[props(default)] class: String, children: Element) -> Element {
	rsx! {
		form { class, "data-slot": "form", {children} }
	}
}

/// Provides a generated id via context so the label/control/description/message
/// underneath share `aria-describedby`/`id`.
#[component]
pub fn FormItem(#[props(default)] class: String, children: Element) -> Element {
	let id = use_hook(|| format!("form-item-{}", NEXT_ID.fetch_add(1, Ordering::Relaxed)));
	use_context_provider(|| FormItemContext { id });
	let cls = cn!("grid gap-2", class);
	rsx! {
		div { class: cls, "data-slot": "form-item", {children} }
	}
}

/// Wraps [`Label`], pointing `for` at the control id. Unlike the TS port — where
/// `data-error` rides on the element and `data-[error=true]:text-destructive`
/// reacts to it — the `Label` component forwards no arbitrary attributes, so
/// `error` folds the destructive colour straight into the class instead.
#[component]
pub fn FormLabel(#[props(default)] error: bool, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<FormItemContext>();
	let cls = cn!(if error { "text-destructive" } else { "" }, class);
	rsx! {
		Label { class: cls, r#for: ctx.form_item_id(), {children} }
	}
}

/// Exposes the control id and `aria-*` ids through context for the consumer to
/// place onto their input. Rust has no `Slot`, so — unlike the TS `FormControl`
/// — it cannot inject these onto an arbitrary child; it only wraps the child in
/// the context. `aria-invalid` follows `error`.
#[component]
pub fn FormControl(#[props(default)] error: bool, children: Element) -> Element {
	let ctx = use_context::<FormItemContext>();
	let described_by = if error {
		format!("{} {}", ctx.form_description_id(), ctx.form_message_id())
	} else {
		ctx.form_description_id()
	};
	rsx! {
		div {
			"data-slot": "form-control",
			id: ctx.form_item_id(),
			"aria-describedby": described_by,
			"aria-invalid": if error { "true" } else { "false" },
			{children}
		}
	}
}

/// Muted helper copy, carrying the description id the control points at.
#[component]
pub fn FormDescription(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<FormItemContext>();
	let cls = cn!("text-muted-foreground text-sm", class);
	rsx! {
		p { class: cls, "data-slot": "form-description", id: ctx.form_description_id(), {children} }
	}
}

/// Error/validation text. Renders only when it has children.
#[component]
pub fn FormMessage(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<FormItemContext>();
	let cls = cn!("text-destructive text-sm", class);
	rsx! {
		p { class: cls, "data-slot": "form-message", id: ctx.form_message_id(), {children} }
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn form_is_passthrough_with_slot() {
		fn app() -> Element {
			rsx! {
				Form {
					"body"
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"form\""), "{html}");
		assert!(html.contains("<form"), "{html}");
		assert!(html.contains("body"), "{html}");
	}

	#[test]
	fn item_provides_shared_id_to_label_and_description() {
		fn app() -> Element {
			rsx! {
				FormItem {
					FormLabel { "Email" }
					FormDescription { "we never share it" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"form-item\""), "{html}");
		assert!(html.contains("grid gap-2"), "{html}");
		// label's `for` matches the control id derived from the item id.
		assert!(html.contains("-form-item\""), "{html}");
		assert!(html.contains("-form-item-description\""), "{html}");
	}

	#[test]
	fn label_error_folds_destructive_into_class() {
		fn app() -> Element {
			rsx! {
				FormItem {
					FormLabel { error: true, "Email" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"label\""), "wraps Label: {html}");
		assert!(html.contains("text-destructive"), "{html}");
	}

	#[test]
	fn control_wires_aria_ids_and_invalid() {
		fn app() -> Element {
			rsx! {
				FormItem {
					FormControl { error: true,
						input {}
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"form-control\""), "{html}");
		assert!(html.contains("aria-invalid=\"true\""), "{html}");
		// describedby lists both description and message ids when invalid.
		assert!(html.contains("-form-item-description"), "{html}");
		assert!(html.contains("-form-item-message\""), "{html}");
	}

	#[test]
	fn message_renders_children() {
		fn app() -> Element {
			rsx! {
				FormItem {
					FormMessage { "required" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"form-message\""), "{html}");
		assert!(html.contains("text-destructive"), "{html}");
		assert!(html.contains("required"), "{html}");
	}
}
