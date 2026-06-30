use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{KBD_BASE, KBD_GROUP_BASE},
};

#[component]
pub fn Kbd(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(KBD_BASE, class);
	rsx! {
		kbd { class: cls, "data-slot": "kbd", {children} }
	}
}

#[component]
pub fn KbdGroup(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(KBD_GROUP_BASE, class);
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
