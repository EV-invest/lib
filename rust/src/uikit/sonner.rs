//! Toast notifications.
//!
//! Where the TS mirror exposes a module-global `toast(...)` function backed by a
//! singleton store, Dioxus has no clean cross-component mutable singleton, so the
//! Rust kit uses a [`ToasterProvider`] that owns a [`Toasts`] signal in context
//! plus a [`use_toaster`] hook returning a [`ToasterHandle`] with `.success`,
//! `.error`, `.info`, `.warning` and `.dismiss`. Auto-dismiss, swipe-to-dismiss
//! and stacking animations are omitted; the palette is the single dark theme
//! (no `next-themes`). See the README "Limitations".

use dioxus::prelude::*;
use tailwind_fuse::{AsTailwindClass, TwVariant};

use crate::cn;

const TOAST_CLOSE: &str = "text-foreground/50 hover:text-foreground shrink-0 transition-colors";
#[derive(strum::AsRefStr, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
#[tw(class = "pointer-events-auto flex w-full items-start gap-3 rounded-md border p-4 text-sm shadow-lg")]
pub enum ToastVariant {
	#[tw(default, class = "bg-popover text-popover-foreground border-border")]
	Default,
	#[tw(class = "bg-popover text-popover-foreground border-main-accent-t2/40")]
	Success,
	#[tw(class = "bg-popover text-popover-foreground border-destructive/50")]
	Error,
	#[tw(class = "bg-popover text-popover-foreground border-border")]
	Info,
	#[tw(class = "bg-popover text-popover-foreground border-border")]
	Warning,
}

/// Where the stack is pinned. Mirrors the TS `position` prop; default
/// bottom-right. The shared stack base rides on the enum.
#[derive(strum::AsRefStr, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
#[tw(class = "pointer-events-none fixed z-100 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 p-4")]
pub enum ToastPosition {
	#[tw(class = "top-0 left-0 items-start")]
	TopLeft,
	#[tw(class = "top-0 left-1/2 -translate-x-1/2 items-center")]
	TopCenter,
	#[tw(class = "top-0 right-0 items-end")]
	TopRight,
	#[tw(class = "bottom-0 left-0 items-start")]
	BottomLeft,
	#[tw(class = "bottom-0 left-1/2 -translate-x-1/2 items-center")]
	BottomCenter,
	#[tw(default, class = "bottom-0 right-0 items-end")]
	BottomRight,
}

#[derive(Clone, PartialEq)]
pub struct Toast {
	pub id: u64,
	pub message: String,
	pub variant: ToastVariant,
}

/// The live toast list, held in context by [`ToasterProvider`] alongside the
/// next-id counter.
#[derive(Clone, Copy)]
pub struct Toasts {
	items: Signal<Vec<Toast>>,
	next_id: Signal<u64>,
}

/// Imperative handle, the mirror of the TS global `toast` object. Obtained via
/// [`use_toaster`]; each method enqueues a toast of the matching variant, and
/// [`ToasterHandle::dismiss`] removes one by id.
#[derive(Clone, Copy)]
pub struct ToasterHandle {
	toasts: Toasts,
}

impl ToasterHandle {
	fn push(&self, message: impl Into<String>, variant: ToastVariant) -> u64 {
		let mut next_id = self.toasts.next_id;
		let id = *next_id.peek();
		next_id.set(id + 1);
		let mut items = self.toasts.items;
		items.write().push(Toast {
			id,
			message: message.into(),
			variant,
		});
		id
	}

	pub fn toast(&self, message: impl Into<String>) -> u64 {
		self.push(message, ToastVariant::Default)
	}

	pub fn success(&self, message: impl Into<String>) -> u64 {
		self.push(message, ToastVariant::Success)
	}

	pub fn error(&self, message: impl Into<String>) -> u64 {
		self.push(message, ToastVariant::Error)
	}

	pub fn info(&self, message: impl Into<String>) -> u64 {
		self.push(message, ToastVariant::Info)
	}

	pub fn warning(&self, message: impl Into<String>) -> u64 {
		self.push(message, ToastVariant::Warning)
	}

	pub fn dismiss(&self, id: u64) {
		let mut items = self.toasts.items;
		items.write().retain(|t| t.id != id);
	}
}

/// Provides the [`Toasts`] context. Wrap the subtree that both enqueues toasts
/// (via [`use_toaster`]) and renders the [`Toaster`].
#[component]
pub fn ToasterProvider(children: Element) -> Element {
	let items = use_signal(Vec::new);
	let next_id = use_signal(|| 0u64);
	use_context_provider(|| Toasts { items, next_id });
	rsx! {
		{children}
	}
}

/// Returns the imperative [`ToasterHandle`] from the nearest
/// [`ToasterProvider`]. The mirror of importing the TS global `toast`.
pub fn use_toaster() -> ToasterHandle {
	ToasterHandle { toasts: use_context::<Toasts>() }
}

/// Renders the toast stack from context. Fixed-positioned per `position`
/// (default bottom-right). Unlike the TS mirror there is no `setTimeout`
/// auto-dismiss — the kit is render-only and host-timer-free; dismiss happens on
/// the close button or via [`ToasterHandle::dismiss`].
#[component]
pub fn Toaster(#[props(default)] position: ToastPosition, #[props(default)] class: String) -> Element {
	let toasts = use_context::<Toasts>();
	let handle = ToasterHandle { toasts };
	let cls = cn!(position.as_class(), class);
	rsx! {
		ol { class: cls, "data-slot": "toaster", "data-position": position.as_ref(),
			for t in toasts.items.read().iter().cloned() {
				li {
					key: "{t.id}",
					role: "status",
					"aria-live": "polite",
					"data-slot": "toast",
					"data-variant": t.variant.as_ref(),
					class: t.variant.as_class(),
					div { class: "flex-1 space-y-1",
						div { class: "font-medium", "{t.message}" }
					}
					button {
						r#type: "button",
						"aria-label": "Close",
						"data-slot": "toast-close",
						class: TOAST_CLOSE,
						onclick: move |_| handle.dismiss(t.id),
						svg {
							xmlns: "http://www.w3.org/2000/svg",
							width: "16",
							height: "16",
							view_box: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							"stroke-width": "2",
							"stroke-linecap": "round",
							"stroke-linejoin": "round",
							"aria-hidden": "true",
							path { d: "M18 6 6 18M6 6l12 12" }
						}
					}
				}
			}
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn enqueued_toast_renders_with_role_and_variant() {
		fn app() -> Element {
			rsx! {
				ToasterProvider {
					Seed {}
					Toaster {}
				}
			}
		}
		#[component]
		fn Seed() -> Element {
			let toaster = use_toaster();
			use_hook(move || toaster.success("Done"));
			rsx! {}
		}
		let html = render(app);
		assert!(html.contains("role=\"status\""), "{html}");
		assert!(html.contains("data-variant=\"success\""), "{html}");
		assert!(html.contains("Done"), "{html}");
		assert!(html.contains("data-slot=\"toast\""), "{html}");
	}

	#[test]
	fn close_button_carries_the_dismiss_path() {
		fn app() -> Element {
			rsx! {
				ToasterProvider {
					Seed {}
					Toaster {}
				}
			}
		}
		#[component]
		fn Seed() -> Element {
			let toaster = use_toaster();
			use_hook(move || toaster.error("Oops"));
			rsx! {}
		}
		let html = render(app);
		assert!(html.contains("M18 6 6 18M6 6l12 12"), "{html}");
		assert!(html.contains("aria-label=\"Close\""), "{html}");
	}

	#[test]
	fn every_variant_helper_enqueues() {
		fn app() -> Element {
			rsx! {
				ToasterProvider {
					Seed {}
					Toaster {}
				}
			}
		}
		#[component]
		fn Seed() -> Element {
			let toaster = use_toaster();
			use_hook(move || {
				let id = toaster.toast("plain");
				toaster.info("info");
				toaster.warning("warning");
				toaster.dismiss(id);
			});
			rsx! {}
		}
		let html = render(app);
		assert!(!html.contains("plain"), "dismissed toast gone: {html}");
		assert!(html.contains("data-variant=\"info\""), "{html}");
		assert!(html.contains("data-variant=\"warning\""), "{html}");
	}

	#[test]
	fn position_drives_the_root_attribute() {
		fn app() -> Element {
			rsx! {
				ToasterProvider {
					Toaster { position: ToastPosition::TopCenter }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-position=\"top-center\""), "{html}");
		assert!(html.contains("data-slot=\"toaster\""), "{html}");
	}

	#[test]
	fn position_serializes_kebab() {
		assert_eq!(ToastPosition::TopLeft.as_ref(), "top-left");
	}
}
