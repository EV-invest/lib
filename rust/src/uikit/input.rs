use dioxus::prelude::*;

use crate::cn;

const INPUT_BASE: &str = "file:text-foreground placeholder:text-muted-foreground selection:bg-primary \
                          selection:text-primary-foreground border-input h-9 w-full min-w-0 rounded-md border \
                          bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none \
                          file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium \
                          disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm \
                          focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] \
                          aria-invalid:ring-destructive/20 aria-invalid:border-destructive";

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

	rsx! {
		input {
			r#type: input_type,
			class: cls,
			"data-slot": "input",
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
