//! Dep-light, presentational form primitives — the kernel keeps the ARIA
//! id-wiring of shadcn's form (label/control/description/message share an id so
//! `aria-describedby` and `id` line up) but drops `react-hook-form`'s state
//! engine: validation and field state are the consumer's job.
//!
//! [`FormItem`] mints an id and provides it via context; [`FormLabel`],
//! [`FormDescription`] and [`FormMessage`] read it. Unlike the TS port there is
//! no `Slot`, so [`FormControl`] cannot inject `id`/`aria-*` onto an arbitrary
//! child; it publishes them as [`FormControlContext`] instead, and the kit's own
//! controls ([`Input`](crate::uikit::Input), [`Textarea`](crate::uikit::Textarea))
//! consume it and apply them to themselves. Wrapping a bare element is the one
//! case the consumer still wires by hand.

use std::sync::atomic::{AtomicUsize, Ordering};

use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{FORM_DESCRIPTION, FORM_ITEM, FORM_LABEL, FORM_MESSAGE, label::Label},
};

/// What [`FormControl`] hands down to the control beneath it. Provided as a
/// `Signal<FormControlContext>`; the kit's own controls consume it and stamp
/// these onto themselves. Consume it too if you wrap a bare element:
///
/// ```ignore
/// let form = try_consume_context::<Signal<FormControlContext>>();
/// rsx! { input { id: form.map(|f| f.read().id.clone()) } }
/// ```
#[derive(Clone, PartialEq)]
pub struct FormControlContext {
	/// The id [`FormLabel`]'s `for` points at — put it on the control itself, or
	/// the label focuses nothing.
	pub id: String,
	/// The description id, plus the message id when invalid.
	pub described_by: String,
	/// Drives the control's own `aria-invalid:*` styling.
	pub invalid: bool,
}

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
	let cls = cn!(FORM_ITEM, class);
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
	let cls = cn!(if error { FORM_LABEL } else { "" }, class);
	rsx! {
		Label { class: cls, r#for: ctx.form_item_id(), {children} }
	}
}
/// Hands the control id and `aria-*` ids to the control underneath, via
/// [`FormControlContext`]. Rust has no `Slot`, so — unlike the TS `FormControl`
/// — it cannot inject them onto an arbitrary child; the kit's own controls
/// ([`Input`](crate::uikit::Input), [`Textarea`](crate::uikit::Textarea)) read
/// the context and apply them to themselves. Wrapping a bare `input {}` element
/// instead? Read the context and place the ids yourself. `aria-invalid` follows
/// `error`.
///
/// The attributes must land on the control, not on this wrapper: `FormLabel`'s
/// `for` only focuses a labelable element, and `aria-invalid:*` styling lives on
/// the control's own classes.
#[component]
pub fn FormControl(#[props(default)] error: bool, children: Element) -> Element {
	let ctx = use_context::<FormItemContext>();
	let described_by = if error {
		format!("{} {}", ctx.form_description_id(), ctx.form_message_id())
	} else {
		ctx.form_description_id()
	};
	let next = FormControlContext {
		id: ctx.form_item_id(),
		described_by,
		invalid: error,
	};
	// Provided as a signal and kept in sync with the props: the context value is
	// built on the first render only, so a plain struct would pin that render's
	// `error` and the control would never react to validation flipping.
	let mut current = use_signal(|| next.clone());
	if *current.peek() != next {
		current.set(next);
	}
	use_context_provider(|| current);
	rsx! {
		div { "data-slot": "form-control", {children} }
	}
}
/// Muted helper copy, carrying the description id the control points at.
#[component]
pub fn FormDescription(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<FormItemContext>();
	let cls = cn!(FORM_DESCRIPTION, class);
	rsx! {
		p { class: cls, "data-slot": "form-description", id: ctx.form_description_id(), {children} }
	}
}
/// Error/validation text. Renders only when it has children.
#[component]
pub fn FormMessage(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<FormItemContext>();
	let cls = cn!(FORM_MESSAGE, class);
	rsx! {
		p { class: cls, "data-slot": "form-message", id: ctx.form_message_id(), {children} }
	}
}
static NEXT_ID: AtomicUsize = AtomicUsize::new(0);

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::{Input, Textarea, test_util::render};

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

	/// The opening tag of the first element carrying `data-slot="<slot>"`.
	/// Asserting on the whole document would pass with the attributes on any
	/// element — which is exactly the bug this file had.
	fn tag_of<'a>(html: &'a str, slot: &str) -> &'a str {
		let marker = format!("data-slot=\"{slot}\"");
		let at = html.find(&marker).unwrap_or_else(|| panic!("no element with {marker}: {html}"));
		let start = html[..at].rfind('<').expect("an opening tag");
		let end = at + html[at..].find('>').expect("a closing bracket");
		&html[start..end]
	}

	#[test]
	fn control_wires_aria_ids_and_invalid_onto_the_input() {
		fn app() -> Element {
			rsx! {
				FormItem {
					FormLabel { error: true, "Email" }
					FormControl { error: true,
						Input { r#type: "email" }
					}
					FormDescription { "we never share it" }
					FormMessage { "Invalid email" }
				}
			}
		}
		let html = render(app);
		let input = tag_of(&html, "input");
		let control = tag_of(&html, "form-control");

		// The label's `for` only focuses a labelable element, so the id has to be
		// on the input itself — and must not also sit on the wrapper, or the
		// document would carry duplicate ids and `for` would resolve to the div.
		assert!(input.contains("id=\"form-item-"), "the control id belongs on the input: {input}");
		assert!(!control.contains("id=\"form-item-"), "the wrapper must not take the id: {control}");

		// `aria-invalid:border-destructive` lives on INPUT_BASE, so this attribute
		// is inert anywhere but the input.
		assert!(input.contains("aria-invalid=\"true\""), "{input}");
		assert!(!control.contains("aria-invalid"), "{control}");

		// Focusing the input should announce the description and, when invalid,
		// the message too.
		assert!(input.contains("-form-item-description"), "{input}");
		assert!(input.contains("-form-item-message"), "{input}");
		assert!(!control.contains("aria-describedby"), "{control}");

		// The label points at the id the input now actually has.
		assert!(tag_of(&html, "label").contains("for=\"form-item-"), "{html}");
	}

	#[test]
	fn control_describes_by_description_only_while_valid() {
		fn app() -> Element {
			rsx! {
				FormItem {
					FormControl {
						Input {}
					}
				}
			}
		}
		let input = tag_of(&render(app), "input").to_string();
		assert!(input.contains("aria-invalid=\"false\""), "{input}");
		assert!(input.contains("-form-item-description"), "{input}");
		assert!(!input.contains("-form-item-message"), "a valid field must not point at the message: {input}");
	}

	#[test]
	fn textarea_is_wired_the_same_way() {
		fn app() -> Element {
			rsx! {
				FormItem {
					FormControl { error: true,
						Textarea {}
					}
				}
			}
		}
		let textarea = tag_of(&render(app), "textarea").to_string();
		assert!(textarea.contains("id=\"form-item-"), "{textarea}");
		assert!(textarea.contains("aria-invalid=\"true\""), "{textarea}");
	}

	#[test]
	fn a_control_outside_a_form_takes_no_ids() {
		fn app() -> Element {
			rsx! { Input {} }
		}
		// Matching on `aria-` alone would hit the `aria-invalid:` Tailwind classes,
		// so these look for the attribute form specifically.
		let input = tag_of(&render(app), "input").to_string();
		assert!(!input.contains("id=\""), "{input}");
		assert!(!input.contains("aria-invalid=\""), "{input}");
		assert!(!input.contains("aria-describedby=\""), "{input}");
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
