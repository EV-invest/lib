use dioxus::prelude::*;

use crate::{
	cn,
	uikit::primitives::{Controllable, use_controllable},
};

// dep-light: inline positioning + backdrop; no portal/floating/drag — see README Limitations
// drag-to-dismiss: omitted vs vaul — see README Limitations

/// Edge the drawer slides in from.
#[derive(derive_more::Display, Clone, Copy, Default, PartialEq)]
#[display(rename_all = "kebab-case")]
pub enum DrawerDirection {
	#[default]
	Bottom,
	Top,
	Left,
	Right,
}

impl DrawerDirection {
	fn content_class(&self) -> &'static str {
		match self {
			DrawerDirection::Bottom => "inset-x-0 bottom-0 mt-24 max-h-[80vh] flex-col rounded-t-lg border-b-0",
			DrawerDirection::Top => "inset-x-0 top-0 mb-24 max-h-[80vh] flex-col rounded-b-lg border-t-0",
			DrawerDirection::Left => "inset-y-0 left-0 w-3/4 flex-row border-r sm:max-w-sm",
			DrawerDirection::Right => "inset-y-0 right-0 w-3/4 flex-row border-l sm:max-w-sm",
		}
	}
}

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
	let cls = cn!("fixed inset-0 z-50 bg-black/50", class);
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
	let cls = cn!("bg-background fixed z-50 flex h-auto border", direction.content_class(), class);
	rsx! {
		div {
			class: "fixed inset-0 z-50 bg-black/50",
			"data-slot": "drawer-overlay",
			onclick: move |_| ctx.open.set(false),
		}
		div {
			role: "dialog",
			class: cls,
			"data-slot": "drawer-content",
			"data-state": "open",
			"data-vaul-drawer-direction": "{direction}",
			onkeydown: move |e| {
				if e.key() == Key::Escape {
					ctx.open.set(false);
				}
			},
			if direction == DrawerDirection::Bottom {
				div { class: "bg-muted mx-auto mt-4 hidden h-2 w-[100px] shrink-0 rounded-full", "data-slot": "drawer-handle" }
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
	let cls = cn!("flex flex-col gap-0.5 p-4 text-center sm:gap-1.5 sm:text-left", class);
	rsx! {
		div { class: cls, "data-slot": "drawer-header", {children} }
	}
}
#[component]
pub fn DrawerFooter(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("mt-auto flex flex-col gap-2 p-4", class);
	rsx! {
		div { class: cls, "data-slot": "drawer-footer", {children} }
	}
}
#[component]
pub fn DrawerTitle(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("text-foreground font-semibold", class);
	rsx! {
		div { class: cls, "data-slot": "drawer-title", {children} }
	}
}
#[component]
pub fn DrawerDescription(#[props(default)] class: String, children: Element) -> Element {
	let cls = cn!("text-muted-foreground text-sm", class);
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
