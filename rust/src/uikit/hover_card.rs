use dioxus::prelude::*;

use crate::{
	cn,
	uikit::primitives::{Controllable, Side, use_controllable},
};

const HOVER_CARD_CONTENT: &str = "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out \
                                  data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 \
                                  data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 \
                                  data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 \
                                  z-50 w-64 rounded-md border p-4 shadow-md outline-hidden";

#[component]
pub fn HoverCard(open: Option<bool>, #[props(default)] default_open: bool, on_open_change: Option<EventHandler<bool>>, children: Element) -> Element {
	let state = use_controllable(open, default_open, on_open_change);
	use_context_provider(|| HoverCardCtx { open: state });
	// dep-light: inline positioning + backdrop; no portal/floating — see README Limitations
	rsx! {
		div {
			class: "relative inline-block",
			onkeydown: move |e| {
				if e.key() == Key::Escape {
					state.set(false);
				}
			},
			{children}
		}
	}
}

#[component]
pub fn HoverCardTrigger(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<HoverCardCtx>();
	rsx! {
		a {
			class,
			"data-slot": "hover-card-trigger",
			onmouseenter: move |_| ctx.open.set(true),
			onmouseleave: move |_| ctx.open.set(false),
			{children}
		}
	}
}

#[component]
pub fn HoverCardContent(#[props(default)] side: Side, #[props(default = String::from("center"))] align: String, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<HoverCardCtx>();
	if !ctx.open.get() {
		return rsx! {};
	}
	let cls = cn!(HOVER_CARD_CONTENT, "absolute top-full left-1/2 -translate-x-1/2 mt-1", class);
	rsx! {
		div {
			class: cls,
			"data-slot": "hover-card-content",
			"data-state": "open",
			"data-side": "{side}",
			"data-align": align,
			{children}
		}
	}
}

#[derive(Clone, Copy)]
struct HoverCardCtx {
	open: Controllable<bool>,
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn closed_by_default_hides_content() {
		fn app() -> Element {
			rsx! {
				HoverCard {
					HoverCardTrigger { "@user" }
					HoverCardContent { "profile-body" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"hover-card-trigger\""), "{html}");
		assert!(!html.contains("profile-body"), "content hidden while closed: {html}");
	}

	#[test]
	fn default_open_reveals_content() {
		fn app() -> Element {
			rsx! {
				HoverCard { default_open: true,
					HoverCardTrigger { "@user" }
					HoverCardContent { "profile-body" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"hover-card-content\""), "{html}");
		assert!(html.contains("profile-body"), "{html}");
		assert!(html.contains("data-state=\"open\""), "{html}");
		assert!(html.contains("data-side=\"bottom\""), "{html}");
	}
}
