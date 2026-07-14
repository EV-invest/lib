use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{INPUT_BASE, form::FormControlContext},
};

/// Picks up the id and `aria-*` of an enclosing
/// [`FormControl`](crate::uikit::FormControl); outside one, all three are absent.
#[component]
pub fn Input(
	#[props(default)] class: String,
	#[props(default)] r#type: String,
	#[props(default)] placeholder: String,
	#[props(default)] disabled: bool,
	#[props(default)] value: String,
	oninput: Option<EventHandler<FormEvent>>,
) -> Element {
	let cls = cn!(INPUT_BASE, class);
	let input_type = if r#type.is_empty() { "text".to_string() } else { r#type };
	let form = try_consume_context::<Signal<FormControlContext>>().map(|ctx| ctx.read().clone());

	rsx! {
		input {
			r#type: input_type,
			class: cls,
			"data-slot": "input",
			id: form.as_ref().map(|f| f.id.clone()),
			"aria-describedby": form.as_ref().map(|f| f.described_by.clone()),
			"aria-invalid": form.as_ref().map(|f| f.invalid.to_string()),
			placeholder,
			disabled,
			value,
			oninput: move |e| { if let Some(h) = oninput { h.call(e); } },
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn renders_base_and_slot() {
		fn app() -> Element {
			rsx! { Input {} }
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"input\""), "{html}");
		assert!(html.contains("border-input"), "{html}");
		assert!(html.contains("placeholder:text-muted-foreground"), "{html}");
	}

	#[test]
	fn defaults_to_text_type() {
		fn app() -> Element {
			rsx! { Input {} }
		}
		let html = render(app);
		assert!(html.contains("type=\"text\""), "{html}");
	}

	#[test]
	fn honors_explicit_type_and_placeholder() {
		fn app() -> Element {
			rsx! {
				Input { r#type: "email", placeholder: "you@example.com" }
			}
		}
		let html = render(app);
		assert!(html.contains("type=\"email\""), "{html}");
		assert!(html.contains("you@example.com"), "{html}");
	}

	#[test]
	fn class_override_wins() {
		fn app() -> Element {
			rsx! {
				Input { class: "h-12" }
			}
		}
		let html = render(app);
		assert!(html.contains("h-12"), "{html}");
		assert!(!html.contains("h-9"), "override should drop base h-9: {html}");
	}
}
