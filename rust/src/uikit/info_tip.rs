use std::sync::atomic::{AtomicUsize, Ordering};

use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		POPOVER_CONTENT,
		primitives::{Controllable, Side, use_controllable},
	},
};

/// `InfoTip` — the ⓘ-beside-a-label *toggletip*, the Dioxus mirror of the TS
/// `InfoTip`. Like the TS port it is a real `<button aria-expanded aria-controls>`
/// toggling a `role="status"` live-region bubble — never a `role="tooltip"`, so it
/// stays correct for keyboard and touch. Dep-light like every Rust overlay: inline
/// `fixed` positioning + a backdrop for outside-dismiss, no portal/floating.
///
/// Hover-with-intent (the TS 0.5s open-on-hover) is a TS-only enhancement: it needs
/// host timers the I/O-free Rust kit does not carry, the same reason there is no
/// Portal or measured floating here (see the README "Limitations"). The Rust
/// toggletip opens on click/tap/Enter/Space.
#[component]
pub fn InfoTip(open: Option<bool>, #[props(default)] default_open: bool, on_open_change: Option<EventHandler<bool>>, children: Element) -> Element {
	let state = use_controllable(open, default_open, on_open_change);
	let id = use_hook(|| format!("info-tip-{}", NEXT_TIP_ID.fetch_add(1, Ordering::Relaxed)));
	use_context_provider(|| InfoTipCtx { open: state, id });
	rsx! {
		span {
			class: "relative inline-flex",
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
pub fn InfoTipTrigger(#[props(default = String::from("More information"))] label: String, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<InfoTipCtx>();
	let open = ctx.open.get();
	let cls = cn!(
		"inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full align-middle text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:text-main-accent-t1",
		class
	);
	rsx! {
		button {
			r#type: "button",
			class: cls,
			"data-slot": "info-tip-trigger",
			"data-state": if open { "open" } else { "closed" },
			"aria-label": label,
			"aria-expanded": if open { "true" } else { "false" },
			"aria-controls": ctx.id.clone(),
			onclick: move |_| ctx.open.set(!ctx.open.get()),
			// lucide `info`, inlined per the kit's no-lucide-dep icon convention.
			svg {
				xmlns: "http://www.w3.org/2000/svg",
				view_box: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				stroke_width: "2",
				stroke_linecap: "round",
				stroke_linejoin: "round",
				class: "size-4",
				"aria-hidden": "true",
				circle { cx: "12", cy: "12", r: "10" }
				path { d: "M12 16v-4" }
				path { d: "M12 8h.01" }
			}
		}
	}
}
#[component]
pub fn InfoTipContent(#[props(default)] side: Side, #[props(default = String::from("center"))] align: String, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<InfoTipCtx>();
	if !ctx.open.get() {
		return rsx! {};
	}
	let cls = cn!(POPOVER_CONTENT, "w-64 p-3 text-sm absolute top-full left-1/2 -translate-x-1/2 mt-1.5", class);
	rsx! {
		div {
			class: "fixed inset-0 z-40",
			onclick: move |_| ctx.open.set(false),
		}
		div {
			id: ctx.id.clone(),
			role: "status",
			"aria-live": "polite",
			class: cls,
			"data-slot": "info-tip-content",
			"data-state": "open",
			"data-side": side.as_ref(),
			"data-align": align,
			{children}
		}
	}
}
static NEXT_TIP_ID: AtomicUsize = AtomicUsize::new(0);

#[derive(Clone)]
struct InfoTipCtx {
	open: Controllable<bool>,
	id: String,
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn closed_by_default_hides_content() {
		fn app() -> Element {
			rsx! {
				InfoTip {
					InfoTipTrigger { label: "About network" }
					InfoTipContent { "panel" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"info-tip-trigger\""), "{html}");
		assert!(html.contains("aria-label=\"About network\""), "{html}");
		assert!(html.contains("aria-expanded=\"false\""), "{html}");
		assert!(!html.contains("panel"), "content hidden while closed: {html}");
	}

	#[test]
	fn default_open_reveals_a_status_live_region() {
		fn app() -> Element {
			rsx! {
				InfoTip { default_open: true,
					InfoTipTrigger { label: "About" }
					InfoTipContent { "panel" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"info-tip-content\""), "{html}");
		assert!(html.contains("panel"), "{html}");
		assert!(html.contains("role=\"status\""), "{html}");
		assert!(html.contains("aria-live=\"polite\""), "{html}");
		assert!(!html.contains("role=\"tooltip\""), "toggletip, not tooltip: {html}");
		assert!(html.contains("aria-expanded=\"true\""), "{html}");
	}

	#[test]
	fn trigger_and_content_share_the_aria_controls_id() {
		fn app() -> Element {
			rsx! {
				InfoTip { default_open: true,
					InfoTipTrigger { label: "About" }
					InfoTipContent { "panel" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("aria-controls=\"info-tip-"), "{html}");
		assert!(html.contains("id=\"info-tip-"), "{html}");
	}
}
