use dioxus::prelude::*;

use crate::{
	cn,
	uikit::primitives::{Controllable, Side, use_controllable},
};

const POPOVER_CONTENT: &str = "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out \
                               data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 \
                               data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 \
                               data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 \
                               z-50 w-72 rounded-md border p-4 shadow-md outline-hidden";

#[component]
pub fn Popover(open: Option<bool>, #[props(default)] default_open: bool, on_open_change: Option<EventHandler<bool>>, children: Element) -> Element {
	let state = use_controllable(open, default_open, on_open_change);
	use_context_provider(|| PopoverCtx { open: state });
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
pub fn PopoverTrigger(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<PopoverCtx>();
	let open = ctx.open.get();
	rsx! {
		button {
			r#type: "button",
			class,
			"data-slot": "popover-trigger",
			"aria-expanded": if open { "true" } else { "false" },
			onclick: move |_| ctx.open.set(!ctx.open.get()),
			{children}
		}
	}
}

/// Optional anchor for API parity with the TS `PopoverAnchor`. Inline placement
/// makes it a passive marker (the content positions against the wrapper).
#[component]
pub fn PopoverAnchor(#[props(default)] class: String, children: Element) -> Element {
	rsx! {
		div { class, "data-slot": "popover-anchor", {children} }
	}
}

#[component]
pub fn PopoverContent(#[props(default)] side: Side, #[props(default = String::from("center"))] align: String, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<PopoverCtx>();
	if !ctx.open.get() {
		return rsx! {};
	}
	let cls = cn!(POPOVER_CONTENT, "absolute top-full left-1/2 -translate-x-1/2 mt-1", class);
	rsx! {
		div {
			class: "fixed inset-0 z-40",
			onclick: move |_| ctx.open.set(false),
		}
		div {
			class: cls,
			"data-slot": "popover-content",
			"data-state": "open",
			"data-side": "{side}",
			"data-align": align,
			{children}
		}
	}
}

#[derive(Clone, Copy)]
struct PopoverCtx {
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
				Popover {
					PopoverTrigger { "open" }
					PopoverContent { "panel" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"popover-trigger\""), "{html}");
		assert!(!html.contains("panel"), "content hidden while closed: {html}");
		assert!(html.contains("aria-expanded=\"false\""), "{html}");
	}

	#[test]
	fn default_open_reveals_content() {
		fn app() -> Element {
			rsx! {
				Popover { default_open: true,
					PopoverTrigger { "open" }
					PopoverContent { "panel" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"popover-content\""), "{html}");
		assert!(html.contains("panel"), "{html}");
		assert!(html.contains("data-state=\"open\""), "{html}");
		assert!(html.contains("data-side=\"bottom\""), "{html}");
		assert!(html.contains("aria-expanded=\"true\""), "{html}");
	}
}
