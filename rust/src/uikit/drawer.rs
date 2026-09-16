//! Drawer — the Vaul-style edge sheet.
//!
//! Motion is the shared `motion.css` contract, keyed on `data-slot` +
//! `data-vaul-drawer-direction` + `data-state` (no tw-animate-css): the enter
//! is a keyframe that plays on insertion, and closing flips
//! `data-state="closed"`, which transitions the panel off-screen and fades the
//! scrim. The panel therefore stays mounted after `open` turns false and is
//! dropped on its exit `transform`'s `transitionend` — the same host-timer-free
//! presence the toast uses. Drag-to-dismiss (pointer physics) is TS-only; see
//! the README "Limitations".

use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		DRAWER_BODY, DRAWER_CONTENT_BASE, DRAWER_DESCRIPTION, DRAWER_FOOTER, DRAWER_HANDLE, DRAWER_HEADER, DRAWER_OVERLAY, DRAWER_TITLE, DrawerDirection,
		primitives::{Controllable, is_transform_transition, use_controllable},
	},
};

// dep-light: inline positioning + backdrop; no portal/floating — see README Limitations
// drag-to-dismiss: TS-only pointer physics; the enter/exit motion itself is shared via motion.css

#[component]
pub fn Drawer(
	open: Option<bool>,
	#[props(default)] default_open: bool,
	on_open_change: Option<EventHandler<bool>>,
	#[props(default)] direction: DrawerDirection,
	children: Element,
) -> Element {
	let open = use_controllable(open, default_open, on_open_change);
	use_context_provider(|| DrawerCtx { open, direction });
	rsx! {
		div { "data-slot": "drawer", {children} }
	}
}
#[component]
pub fn DrawerTrigger(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<DrawerCtx>();
	rsx! {
		button {
			r#type: "button",
			class,
			"data-slot": "drawer-trigger",
			onclick: move |_| ctx.open.set(true),
			{children}
		}
	}
}
/// Standalone scrim, redundant with the one [`DrawerContent`] renders (as in
/// shadcn). Mounted only while open; the animated exit lives on the content's
/// own scrim.
#[component]
pub fn DrawerOverlay(#[props(default)] class: String) -> Element {
	let ctx = use_context::<DrawerCtx>();
	if !ctx.open.get() {
		return rsx! {};
	}
	let cls = cn!(DRAWER_OVERLAY, class);
	rsx! {
		div {
			class: cls,
			"data-slot": "drawer-overlay",
			"data-state": "open",
			onclick: move |_| ctx.open.set(false),
		}
	}
}
/// The panel plus its scrim. Presence outlives `open`: once it turns false the
/// panel flips to `data-state="closed"` and is unmounted when its exit
/// `transform` transition ends. Re-opening mid-exit just flips the state back
/// and the same transition carries the panel home.
#[component]
pub fn DrawerContent(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<DrawerCtx>();
	// Seeded from `open` so a drawer that starts open is in the server-rendered
	// markup — the effect below never runs under SSR.
	let mut present = use_signal(|| ctx.open.get());
	let mut closing = use_signal(|| false);
	use_effect(move || {
		let open = ctx.open.get();
		// `peek` + equality guards: the effect must not subscribe to (or loop on)
		// its own writes.
		if open {
			if !*present.peek() {
				present.set(true);
			}
			if *closing.peek() {
				closing.set(false);
			}
		} else if *present.peek() && !*closing.peek() {
			closing.set(true);
		}
	});
	if !present() {
		return rsx! {};
	}
	let state = if closing() { "closed" } else { "open" };
	let direction = ctx.direction;
	let cls = cn!(DRAWER_CONTENT_BASE, direction.as_class(), class);
	rsx! {
		div {
			class: DRAWER_OVERLAY,
			"data-slot": "drawer-overlay",
			"data-state": state,
			onclick: move |_| ctx.open.set(false),
		}
		div {
			role: "dialog",
			class: cls,
			"data-slot": "drawer-content",
			"data-state": state,
			"data-vaul-drawer-direction": direction.as_ref(),
			onkeydown: move |e| {
				if e.key() == Key::Escape {
					ctx.open.set(false);
				}
			},
			ontransitionend: move |e| {
				if *closing.peek() && is_transform_transition(&e) {
					present.set(false);
					closing.set(false);
				}
			},
			if direction == DrawerDirection::Bottom {
				div { class: DRAWER_HANDLE, "data-slot": "drawer-handle" }
			}
			div { class: DRAWER_BODY, "data-slot": "drawer-body", {children} }
		}
	}
}
#[component]
pub fn DrawerClose(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<DrawerCtx>();
	rsx! {
		button {
			r#type: "button",
			class,
			"data-slot": "drawer-close",
			onclick: move |_| ctx.open.set(false),
			{children}
		}
	}
}
#[component]
pub fn DrawerHeader(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(DRAWER_HEADER, class);
	rsx! {
		div { class: cls, "data-slot": "drawer-header", {children} }
	}
}
#[component]
pub fn DrawerFooter(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(DRAWER_FOOTER, class);
	rsx! {
		div { class: cls, "data-slot": "drawer-footer", {children} }
	}
}
#[component]
pub fn DrawerTitle(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(DRAWER_TITLE, class);
	rsx! {
		div { class: cls, "data-slot": "drawer-title", {children} }
	}
}
#[component]
pub fn DrawerDescription(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!(DRAWER_DESCRIPTION, class);
	rsx! {
		div { class: cls, "data-slot": "drawer-description", {children} }
	}
}
#[derive(Clone, Copy)]
struct DrawerCtx {
	open: Controllable<bool>,
	direction: DrawerDirection,
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn closed_hides_content() {
		fn app() -> Element {
			rsx! {
				Drawer {
					DrawerTrigger { "open" }
					DrawerContent {
						DrawerTitle { "Title" }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"drawer-trigger\""), "{html}");
		assert!(!html.contains("Title"), "content hidden while closed: {html}");
	}

	#[test]
	fn open_shows_dialog_with_direction() {
		fn app() -> Element {
			rsx! {
				Drawer { default_open: true, direction: DrawerDirection::Right,
					DrawerContent {
						DrawerTitle { "Title" }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("role=\"dialog\""), "{html}");
		assert!(html.contains("data-vaul-drawer-direction=\"right\""), "{html}");
		assert!(html.contains("Title"), "{html}");
	}

	#[test]
	fn overlay_renders_when_open() {
		fn app() -> Element {
			rsx! {
				Drawer { default_open: true,
					DrawerContent { "body" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"drawer-overlay\""), "{html}");
	}

	// `data-state="open"` is what arms the motion.css enter on both nodes.
	#[test]
	fn open_arms_motion_state_on_panel_and_scrim() {
		fn app() -> Element {
			rsx! {
				Drawer { default_open: true,
					DrawerContent { "body" }
				}
			}
		}
		let html = render(app);
		// The whole opening tag around a `data-slot` marker, whatever the
		// attribute order.
		let opening_tag = |slot: &str| {
			let at = html.find(slot).unwrap_or_else(|| panic!("{slot} rendered: {html}"));
			let start = html[..at].rfind('<').expect("tag start");
			let end = at + html[at..].find('>').expect("tag end");
			&html[start..end]
		};
		let scrim_tag = opening_tag("data-slot=\"drawer-overlay\"");
		let panel_tag = opening_tag("data-slot=\"drawer-content\"");
		assert!(scrim_tag.contains("data-state=\"open\""), "scrim: {scrim_tag}");
		assert!(panel_tag.contains("data-state=\"open\""), "panel: {panel_tag}");
		assert!(html.contains("data-slot=\"drawer-handle\""), "handle visible for bottom: {html}");
		assert!(html.contains("data-slot=\"drawer-body\""), "children wrapped in the scroller: {html}");
	}
}
