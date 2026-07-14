use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		TABS_CONTENT, TABS_LIST, TABS_ROOT, TABS_TRIGGER,
		primitives::{Controllable, RovingFocus, RovingOrientation, use_controllable, use_roving_focus, use_roving_item},
	},
};

/// Tab layout axis; also drives the roving-focus arrow keys.
#[derive(strum::AsRefStr, Clone, Copy, Default, PartialEq)]
#[strum(serialize_all = "kebab-case")]
pub enum TabsOrientation {
	#[default]
	Horizontal,
	Vertical,
}

#[component]
pub fn Tabs(
	value: Option<String>,
	#[props(default)] default_value: String,
	on_value_change: Option<EventHandler<String>>,
	#[props(default)] orientation: TabsOrientation,
	#[props(default)] class: String,
	children: Element,
) -> Element {
	let state = use_controllable(value, default_value, on_value_change);
	use_context_provider(|| TabsCtx { value: state, orientation });
	let cls = cn!(TABS_ROOT, class);
	rsx! {
		div { class: cls, "data-slot": "tabs", "data-orientation": orientation.as_ref(), {children} }
	}
}
/// Owns the group's roving focus, so the `tabindex="-1"` its triggers carry is
/// paid for: the arrows reach every tab the tab order no longer stops at.
#[component]
pub fn TabsList(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<TabsCtx>();
	let roving = use_roving_focus(match ctx.orientation {
		TabsOrientation::Horizontal => RovingOrientation::Horizontal,
		TabsOrientation::Vertical => RovingOrientation::Vertical,
	});
	use_context_provider(|| roving);
	let cls = cn!(TABS_LIST, class);
	rsx! {
		div {
			role: "tablist",
			class: cls,
			"data-slot": "tabs-list",
			"aria-orientation": ctx.orientation.as_ref(),
			// Automatic activation, the ARIA pattern for panels that render
			// instantly: arrowing to a tab selects it as well as focusing it,
			// which is also what carries the group's lone tab stop along.
			onkeydown: move |e: KeyboardEvent| {
				if let Some(next) = roving.next(&e, &ctx.value.get()) {
					e.prevent_default();
					ctx.value.set(next.clone());
					roving.focus(&next);
				}
			},
			{children}
		}
	}
}
#[component]
pub fn TabsTrigger(value: String, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<TabsCtx>();
	let roving = use_context::<RovingFocus>();
	let id = use_roving_item(roving, value.clone());
	let selected = ctx.value.get() == value;
	let aria_selected = if selected { "true" } else { "false" };
	let data_state = if selected { "active" } else { "inactive" };
	let tab_stop = roving.is_tab_stop(&value, &ctx.value.get());
	let cls = cn!(TABS_TRIGGER, class);
	rsx! {
		button {
			r#type: "button",
			role: "tab",
			class: cls,
			"data-slot": "tabs-trigger",
			"data-state": data_state,
			"aria-selected": aria_selected,
			tabindex: if tab_stop { "0" } else { "-1" },
			onmounted: move |e: MountedEvent| roving.attach(id, e.data()),
			onclick: move |_| ctx.value.set(value.clone()),
			{children}
		}
	}
}
#[component]
pub fn TabsContent(value: String, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<TabsCtx>();
	if ctx.value.get() != value {
		return rsx! {};
	}
	let cls = cn!(TABS_CONTENT, class);
	rsx! {
		div { role: "tabpanel", class: cls, "data-slot": "tabs-content", "data-state": "active", {children} }
	}
}
#[derive(Clone, Copy)]
struct TabsCtx {
	value: Controllable<String>,
	orientation: TabsOrientation,
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::{render, render_after_keydown};

	fn two_tabs() -> Element {
		rsx! {
			Tabs { default_value: "one".to_string(),
				TabsList {
					TabsTrigger { value: "one", "One" }
					TabsTrigger { value: "two", "Two" }
				}
				TabsContent { value: "one", "panel-one" }
				TabsContent { value: "two", "panel-two" }
			}
		}
	}

	#[test]
	fn active_panel_renders_with_roles() {
		fn app() -> Element {
			rsx! {
				Tabs { default_value: "one".to_string(),
					TabsList {
						TabsTrigger { value: "one", "One" }
						TabsTrigger { value: "two", "Two" }
					}
					TabsContent { value: "one", "panel-one" }
					TabsContent { value: "two", "panel-two" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("role=\"tablist\""), "{html}");
		assert!(html.contains("role=\"tabpanel\""), "{html}");
		assert!(html.contains("panel-one"), "{html}");
		assert!(!html.contains("panel-two"), "inactive panel hidden: {html}");
	}

	#[test]
	fn active_trigger_is_selected() {
		fn app() -> Element {
			rsx! {
				Tabs { default_value: "one".to_string(),
					TabsList {
						TabsTrigger { value: "one", "One" }
						TabsTrigger { value: "two", "Two" }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("aria-selected=\"true\""), "{html}");
		assert!(html.contains("data-state=\"active\""), "{html}");
	}

	#[test]
	fn exactly_one_trigger_is_tabbable() {
		let html = render(two_tabs);
		assert_eq!(html.matches("tabindex=\"0\"").count(), 1, "the tablist is a single tab stop: {html}");
		assert_eq!(html.matches("tabindex=\"-1\"").count(), 1, "{html}");
	}

	#[test]
	fn unselected_group_still_has_a_tab_stop() {
		fn app() -> Element {
			rsx! {
				Tabs {
					TabsList {
						TabsTrigger { value: "one", "One" }
						TabsTrigger { value: "two", "Two" }
					}
				}
			}
		}
		let html = render(app);
		assert_eq!(html.matches("tabindex=\"0\"").count(), 1, "with nothing selected the first tab takes the stop: {html}");
	}

	#[test]
	fn arrow_right_moves_to_the_next_tab() {
		let html = render_after_keydown(two_tabs, Key::ArrowRight);
		assert!(html.contains("panel-two"), "arrowing right selects the next tab: {html}");
		assert!(!html.contains("panel-one"), "{html}");
	}

	#[test]
	fn arrow_right_wraps_past_the_last_tab() {
		fn app() -> Element {
			rsx! {
				Tabs { default_value: "two".to_string(),
					TabsList {
						TabsTrigger { value: "one", "One" }
						TabsTrigger { value: "two", "Two" }
					}
					TabsContent { value: "one", "panel-one" }
					TabsContent { value: "two", "panel-two" }
				}
			}
		}
		let html = render_after_keydown(app, Key::ArrowRight);
		assert!(html.contains("panel-one"), "the last tab wraps to the first: {html}");
	}

	#[test]
	fn end_jumps_to_the_last_tab() {
		let html = render_after_keydown(two_tabs, Key::End);
		assert!(html.contains("panel-two"), "{html}");
	}

	#[test]
	fn arrow_down_is_inert_in_a_horizontal_tablist() {
		let html = render_after_keydown(two_tabs, Key::ArrowDown);
		assert!(html.contains("panel-one"), "the cross-axis arrow must not move a horizontal tablist: {html}");
	}

	#[test]
	fn vertical_tablist_walks_with_arrow_down() {
		fn app() -> Element {
			rsx! {
				Tabs { orientation: TabsOrientation::Vertical, default_value: "one".to_string(),
					TabsList {
						TabsTrigger { value: "one", "One" }
						TabsTrigger { value: "two", "Two" }
					}
					TabsContent { value: "one", "panel-one" }
					TabsContent { value: "two", "panel-two" }
				}
			}
		}
		let html = render_after_keydown(app, Key::ArrowDown);
		assert!(html.contains("panel-two"), "{html}");
	}

	#[test]
	fn list_carries_orientation() {
		fn app() -> Element {
			rsx! {
				Tabs { orientation: TabsOrientation::Vertical, default_value: "one".to_string(),
					TabsList {
						TabsTrigger { value: "one", "One" }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("aria-orientation=\"vertical\""), "{html}");
	}
}
