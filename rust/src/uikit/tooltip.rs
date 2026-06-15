use dioxus::prelude::*;

use crate::{
	cn,
	uikit::primitives::{Controllable, use_controllable},
};

const TOOLTIP_CONTENT: &str = "bg-foreground text-background animate-in fade-in-0 zoom-in-95 \
                               data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 \
                               data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 \
                               data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 \
                               z-50 w-fit rounded-md px-3 py-1.5 text-xs text-balance";

/// Optional, no-op wrapper kept for API parity with the TS `TooltipProvider`.
#[component]
pub fn TooltipProvider(children: Element) -> Element {
	rsx! {
		{children}
	}
}

#[component]
pub fn Tooltip(open: Option<bool>, #[props(default)] default_open: bool, on_open_change: Option<EventHandler<bool>>, children: Element) -> Element {
	let state = use_controllable(open, default_open, on_open_change);
	use_context_provider(|| TooltipCtx { open: state });
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
pub fn TooltipTrigger(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<TooltipCtx>();
	rsx! {
		button {
			r#type: "button",
			class,
			"data-slot": "tooltip-trigger",
			onmouseenter: move |_| ctx.open.set(true),
			onmouseleave: move |_| ctx.open.set(false),
			onfocusin: move |_| ctx.open.set(true),
			onfocusout: move |_| ctx.open.set(false),
			{children}
		}
	}
}

#[component]
pub fn TooltipContent(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<TooltipCtx>();
	if !ctx.open.get() {
		return rsx! {};
	}
	let cls = cn!(TOOLTIP_CONTENT, "absolute bottom-full left-1/2 -translate-x-1/2 mb-1", class);
	rsx! {
		div {
			class: cls,
			role: "tooltip",
			"data-slot": "tooltip-content",
			"data-state": "open",
			"data-side": "top",
			{children}
		}
	}
}

#[derive(Clone, Copy)]
struct TooltipCtx {
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
				Tooltip {
					TooltipTrigger { "hover" }
					TooltipContent { "hint-body" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"tooltip-trigger\""), "{html}");
		assert!(!html.contains("hint-body"), "content hidden while closed: {html}");
	}

	#[test]
	fn default_open_reveals_content() {
		fn app() -> Element {
			rsx! {
				Tooltip { default_open: true,
					TooltipTrigger { "hover" }
					TooltipContent { "hint-body" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"tooltip-content\""), "{html}");
		assert!(html.contains("hint-body"), "{html}");
		assert!(html.contains("data-state=\"open\""), "{html}");
		assert!(html.contains("data-side=\"top\""), "{html}");
		assert!(html.contains("role=\"tooltip\""), "{html}");
	}
}
