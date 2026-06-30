use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		ButtonVariant, INPUT_BASE, INPUT_GROUP_ADDON_BASE, INPUT_GROUP_BASE, INPUT_GROUP_BUTTON_BASE, INPUT_GROUP_INPUT_CONTROL, INPUT_GROUP_TEXT, INPUT_GROUP_TEXTAREA_CONTROL,
		InputGroupAddonAlign, InputGroupButtonSize, TEXTAREA_BASE, button::Button, input_group_button_size_class,
	},
};

#[component]
pub fn InputGroup(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(INPUT_GROUP_BASE, class);
	rsx! {
		div { class: cls, "data-slot": "input-group", role: "group", {children} }
	}
}

#[component]
pub fn InputGroupAddon(#[props(default)] align: InputGroupAddonAlign, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(INPUT_GROUP_ADDON_BASE, align.as_class(), class);
	rsx! {
		div {
			role: "group",
			class: cls,
			"data-slot": "input-group-addon",
			"data-align": align.as_ref(),
			{children}
		}
	}
}

#[component]
pub fn InputGroupButton(#[props(default)] size: InputGroupButtonSize, #[props(default)] icon: bool, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(INPUT_GROUP_BUTTON_BASE, input_group_button_size_class(size, icon), class);
	rsx! {
		Button {
			variant: ButtonVariant::Ghost,
			class: cls,
			{children}
		}
	}
}

#[component]
pub fn InputGroupText(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(INPUT_GROUP_TEXT, class);
	rsx! {
		span { class: cls, {children} }
	}
}

#[component]
pub fn InputGroupInput(
	#[props(default)] class: String,
	#[props(default)] r#type: String,
	#[props(default)] placeholder: String,
	#[props(default)] disabled: bool,
	#[props(default)] value: String,
	oninput: Option<EventHandler<FormEvent>>,
) -> Element {
	let cls = cn!(INPUT_BASE, INPUT_GROUP_INPUT_CONTROL, class);
	let input_type = if r#type.is_empty() { "text".to_string() } else { r#type };
	rsx! {
		input {
			r#type: input_type,
			class: cls,
			"data-slot": "input-group-control",
			placeholder,
			disabled,
			value,
			oninput: move |e| { if let Some(h) = oninput { h.call(e); } },
		}
	}
}

#[component]
pub fn InputGroupTextarea(
	#[props(default)] class: String,
	#[props(default)] placeholder: String,
	#[props(default)] disabled: bool,
	#[props(default)] value: String,
	oninput: Option<EventHandler<FormEvent>>,
) -> Element {
	let cls = cn!(TEXTAREA_BASE, INPUT_GROUP_TEXTAREA_CONTROL, class);
	rsx! {
		textarea {
			class: cls,
			"data-slot": "input-group-control",
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
	fn group_renders_base_slot_and_role() {
		fn app() -> Element {
			rsx! {
				InputGroup { "x" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"input-group\""), "{html}");
		assert!(html.contains("role=\"group\""), "{html}");
		assert!(html.contains("group/input-group"), "{html}");
	}

	#[test]
	fn group_drops_dark_classes() {
		fn app() -> Element {
			rsx! {
				InputGroup { "x" }
			}
		}
		let html = render(app);
		assert!(!html.contains("dark:"), "dark variants must be dropped: {html}");
	}

	#[test]
	fn addon_default_align_is_inline_start() {
		fn app() -> Element {
			rsx! {
				InputGroupAddon { "a" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"input-group-addon\""), "{html}");
		assert!(html.contains("data-align=\"inline-start\""), "{html}");
		assert!(html.contains("order-first"), "{html}");
	}

	#[test]
	fn addon_block_end_align_is_canon() {
		fn app() -> Element {
			rsx! {
				InputGroupAddon { align: InputGroupAddonAlign::BlockEnd, "a" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-align=\"block-end\""), "{html}");
		assert!(html.contains("order-last"), "{html}");
	}

	#[test]
	fn button_default_size_and_ghost_variant() {
		fn app() -> Element {
			rsx! {
				InputGroupButton { "b" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"button\""), "{html}");
		assert!(html.contains("hover:bg-accent"), "ghost variant: {html}");
		assert!(html.contains("h-6"), "xs size class: {html}");
	}

	#[test]
	fn icon_button_squares_and_drops_padding() {
		fn app() -> Element {
			rsx! {
				InputGroupButton { size: InputGroupButtonSize::Sm, icon: true, "b" }
			}
		}
		let html = render(app);
		assert!(html.contains("size-8"), "{html}");
		assert!(html.contains("p-0"), "icon button folds to a square, padding zeroed: {html}");
	}

	#[test]
	fn addon_align_serializes_kebab() {
		assert_eq!(InputGroupAddonAlign::InlineStart.as_ref(), "inline-start");
	}

	#[test]
	fn control_drops_dark_classes() {
		fn app() -> Element {
			rsx! {
				InputGroupInput {}
				InputGroupTextarea {}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"input-group-control\""), "{html}");
		assert!(html.contains("focus-visible:ring-0"), "{html}");
		assert!(!html.contains("dark:"), "dark variants must be dropped: {html}");
	}
}
