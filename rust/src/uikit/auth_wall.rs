//! What a section shows a caller it is not for: an [`Empty`] with a lock, a title, why,
//! and an action slot. A guest gets the sign-in button there; a signed-in caller without
//! the permission gets no action, or the host's own (request access).

use dioxus::prelude::*;

use crate::uikit::{Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyMediaVariant, EmptyTitle};

#[component]
pub fn AuthWall(
	title: String,
	description: String,
	#[props(default)] class: String,
	/// The action row — typically the host's sign-in button.
	children: Element,
) -> Element {
	rsx! {
		Empty { class,
			EmptyHeader {
				EmptyMedia { variant: EmptyMediaVariant::Icon, {lock_icon()} }
				EmptyTitle { {title} }
				EmptyDescription { {description} }
			}
			EmptyContent { {children} }
		}
	}
}

// lucide `lock`, inlined so the kit keeps its zero-icon-dep footprint.
fn lock_icon() -> Element {
	rsx! {
		svg {
			xmlns: "http://www.w3.org/2000/svg",
			view_box: "0 0 24 24",
			fill: "none",
			stroke: "currentColor",
			stroke_width: "2",
			stroke_linecap: "round",
			stroke_linejoin: "round",
			"aria-hidden": "true",
			rect { x: "3", y: "11", width: "18", height: "11", rx: "2", ry: "2" }
			path { d: "M7 11V7a5 5 0 0 1 10 0v4" }
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn a_wall_is_an_empty_with_a_lock_and_the_hosts_action() {
		fn app() -> Element {
			rsx! {
				AuthWall { title: "Sign in to view your wallet", description: "Your balances live in your account.",
					button { "Sign in" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"empty\""), "{html}");
		assert!(html.contains("data-variant=\"icon\""), "{html}");
		assert!(html.contains("Sign in to view your wallet") && html.contains("<button>Sign in</button>"), "{html}");
	}
}
