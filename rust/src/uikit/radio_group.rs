use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		RADIO_GROUP_ITEM, RADIO_GROUP_ROOT,
		primitives::{Controllable, RovingFocus, RovingOrientation, use_controllable, use_roving_focus, use_roving_item},
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
	let roving = use_roving_focus(RovingOrientation::Vertical);
	use_context_provider(|| RadioGroupContext { value: state });
	use_context_provider(|| roving);
	let cls = cn!(RADIO_GROUP_ROOT, class);
	rsx! {
		div {
			class: cls,
			"data-slot": "radio-group",
			role: "radiogroup",
			// The arrows both move and check, as native radios do — which is
			// what the `role="radio"` contract promises ("1 of 3, use arrow
			// keys") and what keeps the group's lone tab stop under focus.
			onkeydown: move |e: KeyboardEvent| {
				if let Some(next) = roving.next(&e, &state.get()) {
					e.prevent_default();
					state.set(next.clone());
					roving.focus(&next);
				}
			},
			{children}
		}
	}
}
#[component]
pub fn RadioGroupItem(value: String, #[props(default)] class: String, #[props(default)] disabled: bool, children: Element) -> Element {
	let ctx = use_context::<RadioGroupContext>();
	let roving = use_context::<RovingFocus>();
	let id = use_roving_item(roving, value.clone());
	let checked = ctx.value.get() == value;
	let tab_stop = roving.is_tab_stop(&value, &ctx.value.get());
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
			tabindex: if tab_stop { "0" } else { "-1" },
			onmounted: move |e: MountedEvent| roving.attach(id, e.data()),
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
	use crate::uikit::test_util::{render, render_after_keydown};

	fn three_radios() -> Element {
		rsx! {
			RadioGroup { default_value: "a",
				RadioGroupItem { value: "a" }
				RadioGroupItem { value: "b" }
				RadioGroupItem { value: "c" }
			}
		}
	}

	/// Position of the checked item — which radio the keys landed on. Each split
	/// segment runs from one item's slot marker to the next's, so a `checked`
	/// state inside a segment belongs to that item.
	fn checked_index(html: &str) -> usize {
		html.split("data-slot=\"radio-group-item\"")
			.skip(1)
			.position(|item| item.contains("data-state=\"checked\""))
			.expect("one item is checked")
	}

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
	fn group_is_a_single_tab_stop() {
		let html = render(three_radios);
		assert_eq!(html.matches("tabindex=\"0\"").count(), 1, "Tab enters the group once, not once per radio: {html}");
		assert_eq!(html.matches("tabindex=\"-1\"").count(), 2, "{html}");
	}

	#[test]
	fn unchecked_group_still_has_a_tab_stop() {
		fn app() -> Element {
			rsx! {
				RadioGroup {
					RadioGroupItem { value: "a" }
					RadioGroupItem { value: "b" }
				}
			}
		}
		let html = render(app);
		assert_eq!(html.matches("tabindex=\"0\"").count(), 1, "with nothing checked the first radio takes the stop: {html}");
	}

	#[test]
	fn arrow_down_checks_the_next_radio() {
		let html = render_after_keydown(three_radios, Key::ArrowDown);
		assert_eq!(checked_index(&html), 1, "{html}");
	}

	#[test]
	fn arrow_up_wraps_to_the_last_radio() {
		let html = render_after_keydown(three_radios, Key::ArrowUp);
		assert_eq!(checked_index(&html), 2, "the first radio wraps back to the last: {html}");
	}

	#[test]
	fn end_and_home_jump_to_the_edges() {
		assert_eq!(checked_index(&render_after_keydown(three_radios, Key::End)), 2);
		fn last_selected() -> Element {
			rsx! {
				RadioGroup { default_value: "c",
					RadioGroupItem { value: "a" }
					RadioGroupItem { value: "b" }
					RadioGroupItem { value: "c" }
				}
			}
		}
		assert_eq!(checked_index(&render_after_keydown(last_selected, Key::Home)), 0);
	}

	#[test]
	fn the_tab_stop_follows_the_checked_radio() {
		let html = render_after_keydown(three_radios, Key::ArrowDown);
		let stop = html
			.split("data-slot=\"radio-group-item\"")
			.skip(1)
			.position(|item| item.contains("tabindex=\"0\""))
			.expect("a radio is tabbable");
		assert_eq!(stop, 1, "arrowing must carry the tab stop, not strand it: {html}");
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
