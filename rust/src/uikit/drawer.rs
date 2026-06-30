use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		DRAWER_CONTENT_BASE, DRAWER_DESCRIPTION, DRAWER_FOOTER, DRAWER_HANDLE, DRAWER_HEADER, DRAWER_OVERLAY, DRAWER_TITLE, DrawerDirection,
		primitives::{Controllable, use_controllable},
	},
};

// dep-light: inline positioning + backdrop; no portal/floating/drag — see README Limitations
// drag-to-dismiss: omitted vs vaul — see README Limitations

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
#[component]
pub fn DrawerContent(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<DrawerCtx>();
	if !ctx.open.get() {
		return rsx! {};
	}
	let direction = ctx.direction;
	let cls = cn!(DRAWER_CONTENT_BASE, direction.as_class(), class);
	rsx! {
		div {
			class: DRAWER_OVERLAY,
			"data-slot": "drawer-overlay",
			onclick: move |_| ctx.open.set(false),
		}
		div {
			role: "dialog",
			class: cls,
			"data-slot": "drawer-content",
			"data-state": "open",
			"data-vaul-drawer-direction": direction.as_ref(),
			onkeydown: move |e| {
				if e.key() == Key::Escape {
					ctx.open.set(false);
				}
			},
			if direction == DrawerDirection::Bottom {
				div { class: DRAWER_HANDLE, "data-slot": "drawer-handle" }
			}
			{children}
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
}
