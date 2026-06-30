use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		TABS_CONTENT, TABS_LIST, TABS_ROOT, TABS_TRIGGER,
		primitives::{Controllable, use_controllable},
	},
};

/// Tab layout axis; also drives the roving-focus arrow keys in the TS mirror.
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
#[component]
pub fn TabsList(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<TabsCtx>();
	let cls = cn!(TABS_LIST, class);
	rsx! {
		div {
			role: "tablist",
			class: cls,
			"data-slot": "tabs-list",
			"aria-orientation": ctx.orientation.as_ref(),
			{children}
		}
	}
}
#[component]
pub fn TabsTrigger(value: String, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<TabsCtx>();
	let selected = ctx.value.get() == value;
	let aria_selected = if selected { "true" } else { "false" };
	let data_state = if selected { "active" } else { "inactive" };
	let cls = cn!(TABS_TRIGGER, class);
	rsx! {
		button {
			r#type: "button",
			role: "tab",
			class: cls,
			"data-slot": "tabs-trigger",
			"data-state": data_state,
			"aria-selected": aria_selected,
			tabindex: if selected { "0" } else { "-1" },
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
	use crate::uikit::test_util::render;

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
