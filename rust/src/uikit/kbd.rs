use dioxus::prelude::*;

use crate::cn;

const KBD_BASE: &str = "bg-muted text-muted-foreground pointer-events-none inline-flex h-5 w-fit min-w-5 \
                        items-center justify-center gap-1 rounded-sm px-1 font-sans text-xs font-medium select-none \
                        [&_svg:not([class*='size-'])]:size-3 \
                        [[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background";

#[component]
pub fn Kbd(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(KBD_BASE, class);
	rsx! {
		kbd { class: cls, "data-slot": "kbd", {children} }
	}
}

#[component]
pub fn KbdGroup(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("inline-flex items-center gap-1", class);
	rsx! {
		kbd { class: cls, "data-slot": "kbd-group", {children} }
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn kbd_renders_base_and_slot() {
		fn app() -> Element {
			rsx! {
				Kbd { "K" }
			}
		}
		let html = render(app);
		assert!(html.contains("bg-muted"), "{html}");
		assert!(html.contains("data-slot=\"kbd\""), "{html}");
		assert!(html.contains("K"));
	}

	#[test]
	fn group_renders_slot() {
		fn app() -> Element {
			rsx! {
				KbdGroup {
					Kbd { "Ctrl" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"kbd-group\""), "{html}");
		assert!(html.contains("inline-flex items-center gap-1"), "{html}");
	}
}
