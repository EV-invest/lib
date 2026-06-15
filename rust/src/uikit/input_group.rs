use dioxus::prelude::*;

use crate::{
	cn,
	uikit::button::{Button, ButtonVariant},
};

const INPUT_CONTROL_BASE: &str = "file:text-foreground placeholder:text-muted-foreground selection:bg-primary \
                                  selection:text-primary-foreground border-input h-9 w-full min-w-0 rounded-md border \
                                  bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none \
                                  file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium \
                                  disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm \
                                  focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] \
                                  aria-invalid:ring-destructive/20 aria-invalid:border-destructive";

const TEXTAREA_CONTROL_BASE: &str = "border-input placeholder:text-muted-foreground focus-visible:border-ring \
                                     focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 \
                                     aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-md \
                                     border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] \
                                     outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 \
                                     md:text-sm";

const INPUT_GROUP_BASE: &str = "group/input-group border-input relative flex w-full items-center rounded-md border \
                                shadow-xs transition-[color,box-shadow] outline-none \
                                h-9 min-w-0 has-[>textarea]:h-auto \
                                has-[>[data-align=inline-start]]:[&>input]:pl-2 \
                                has-[>[data-align=inline-end]]:[&>input]:pr-2 \
                                has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3 \
                                has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3 \
                                has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot=input-group-control]:focus-visible]:ring-[3px] \
                                has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[[data-slot][aria-invalid=true]]:border-destructive";

const INPUT_GROUP_ADDON_BASE: &str = "text-muted-foreground flex h-auto cursor-text items-center justify-center gap-2 \
                                      py-1.5 text-sm font-medium select-none [&>svg:not([class*='size-'])]:size-4 \
                                      [&>kbd]:rounded-[calc(var(--radius)-5px)] group-data-[disabled=true]/input-group:opacity-50";
const INPUT_GROUP_BUTTON_BASE: &str = "text-sm shadow-none flex gap-2 items-center";
#[component]
pub fn InputGroup(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(INPUT_GROUP_BASE, class);
	rsx! {
		div { class: cls, "data-slot": "input-group", role: "group", {children} }
	}
}

#[derive(Clone, Default, PartialEq)]
pub enum InputGroupAddonAlign {
	#[default]
	InlineStart,
	InlineEnd,
	BlockStart,
	BlockEnd,
}

impl InputGroupAddonAlign {
	fn class(&self) -> &'static str {
		match self {
			InputGroupAddonAlign::InlineStart => "order-first pl-3 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem]",
			InputGroupAddonAlign::InlineEnd => "order-last pr-3 has-[>button]:mr-[-0.45rem] has-[>kbd]:mr-[-0.35rem]",
			InputGroupAddonAlign::BlockStart => "order-first w-full justify-start px-3 pt-3 [.border-b]:pb-3 group-has-[>input]/input-group:pt-2.5",
			InputGroupAddonAlign::BlockEnd => "order-last w-full justify-start px-3 pb-3 [.border-t]:pt-3 group-has-[>input]/input-group:pb-2.5",
		}
	}

	fn attr(&self) -> &'static str {
		match self {
			InputGroupAddonAlign::InlineStart => "inline-start",
			InputGroupAddonAlign::InlineEnd => "inline-end",
			InputGroupAddonAlign::BlockStart => "block-start",
			InputGroupAddonAlign::BlockEnd => "block-end",
		}
	}
}

#[component]
pub fn InputGroupAddon(#[props(default)] align: InputGroupAddonAlign, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(INPUT_GROUP_ADDON_BASE, align.class(), class);
	rsx! {
		div {
			role: "group",
			class: cls,
			"data-slot": "input-group-addon",
			"data-align": align.attr(),
			{children}
		}
	}
}

#[derive(Clone, Default, PartialEq)]
pub enum InputGroupButtonSize {
	#[default]
	Xs,
	Sm,
	IconXs,
	IconSm,
}

impl InputGroupButtonSize {
	fn class(&self) -> &'static str {
		match self {
			InputGroupButtonSize::Xs => "h-6 gap-1 px-2 rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-3.5 has-[>svg]:px-2",
			InputGroupButtonSize::Sm => "h-8 px-2.5 gap-1.5 rounded-md has-[>svg]:px-2.5",
			InputGroupButtonSize::IconXs => "size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0",
			InputGroupButtonSize::IconSm => "size-8 p-0 has-[>svg]:p-0",
		}
	}
}

#[component]
pub fn InputGroupButton(#[props(default)] size: InputGroupButtonSize, #[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(INPUT_GROUP_BUTTON_BASE, size.class(), class);
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
	let cls = cn!(
		"text-muted-foreground flex items-center gap-2 text-sm [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
		class
	);
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
	let cls = cn!(INPUT_CONTROL_BASE, "flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0", class);
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
	let cls = cn!(
		TEXTAREA_CONTROL_BASE,
		"flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none focus-visible:ring-0",
		class
	);
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
