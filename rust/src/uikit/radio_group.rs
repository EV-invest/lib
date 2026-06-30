use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		RADIO_GROUP_ITEM, RADIO_GROUP_ROOT,
		primitives::{Controllable, use_controllable},
	},
};

#[component]
pub fn RadioGroup(
	#[props(default)] class: String,
	value: Option<String>,
	#[props(default)] default_value: String,
	on_value_change: Option<EventHandler<String>>,
	children: Element,
) -> Element {
	let state = use_controllable(value, default_value, on_value_change);
	use_context_provider(|| RadioGroupContext { value: state });
	let cls = cn!(RADIO_GROUP_ROOT, class);
	rsx! {
		div {
			class: cls,
			"data-slot": "radio-group",
			role: "radiogroup",
			{children}
		}
	}
}
#[component]
pub fn RadioGroupItem(value: String, #[props(default)] class: String, #[props(default)] disabled: bool, children: Element) -> Element {
	let ctx = use_context::<RadioGroupContext>();
	let checked = ctx.value.get() == value;
	let cls = cn!(RADIO_GROUP_ITEM, class);
	let select_value = value.clone();
	rsx! {
		button {
			r#type: "button",
			class: cls,
			"data-slot": "radio-group-item",
			"data-state": if checked { "checked" } else { "unchecked" },
			role: "radio",
			"aria-checked": checked,
			disabled,
			onclick: move |_| ctx.value.set(select_value.clone()),
			if checked {
				span {
					"data-slot": "radio-group-indicator",
					class: "relative flex items-center justify-center",
					svg {
						class: "fill-primary absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2",
						view_box: "0 0 24 24",
						circle { cx: "12", cy: "12", r: "10" }
					}
				}
			}
			{children}
		}
	}
}
/// Shared state for a [`RadioGroup`], provided to descendant [`RadioGroupItem`]s
/// via context — the mirror of the TS React context the radio group publishes.
#[derive(Clone, Copy)]
struct RadioGroupContext {
	value: Controllable<String>,
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn group_renders_role_and_slot() {
		fn app() -> Element {
			rsx! {
				RadioGroup { default_value: "a",
					RadioGroupItem { value: "a" }
					RadioGroupItem { value: "b" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("role=\"radiogroup\""), "{html}");
		assert!(html.contains("data-slot=\"radio-group\""), "{html}");
		assert!(html.contains("grid gap-3"), "{html}");
	}

	#[test]
	fn selected_item_is_checked_and_shows_indicator() {
		fn app() -> Element {
			rsx! {
				RadioGroup { default_value: "a",
					RadioGroupItem { value: "a" }
					RadioGroupItem { value: "b" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-state=\"checked\""), "{html}");
		assert!(html.contains("data-state=\"unchecked\""), "{html}");
		assert!(html.contains("aria-checked=true"), "{html}");
		assert!(html.contains("data-slot=\"radio-group-indicator\""), "{html}");
		assert!(html.contains("fill-primary"), "{html}");
	}

	#[test]
	fn controlled_value_reflects_external_selection() {
		fn app() -> Element {
			rsx! {
				RadioGroup { value: "b",
					RadioGroupItem { value: "a" }
					RadioGroupItem { value: "b" }
				}
			}
		}
		let html = render(app);
		// exactly one checked indicator, on the second item
		assert_eq!(html.matches("radio-group-indicator").count(), 1, "{html}");
	}

	#[test]
	fn item_class_override_merges() {
		fn app() -> Element {
			rsx! {
				RadioGroup { default_value: "a",
					RadioGroupItem { value: "a", class: "size-6" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("size-6"), "{html}");
		assert!(!html.contains("size-4"), "override should drop base size-4: {html}");
	}
}
