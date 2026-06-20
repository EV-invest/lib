//! Toast notifications.
//!
//! Where the TS mirror exposes a module-global `toast(...)` function backed by a
//! singleton store, Dioxus has no clean cross-component mutable singleton, so the
//! Rust kit uses a [`ToasterProvider`] that owns a [`Toasts`] signal in context
//! plus a [`use_toaster`] hook returning a [`ToasterHandle`] with `.success`,
//! `.error`, `.info`, `.warning` and `.dismiss`.
//!
//! ## Animation
//!
//! Enter and exit are animated without a host timer — the constraint that keeps
//! this kit render-only. Each toast carries a [`ToastState`] (`Open` →
//! `Closing`): a fresh toast mounts as `data-state="open"` and the shared
//! `tokens.css` plays a slide+fade keyframe (direction picked from the toaster's
//! `data-position`). [`ToasterHandle::dismiss`] (and the close button) flip it to
//! `Closing`/`data-state="closed"`, which swaps in the exit keyframe; the live
//! removal then rides the DOM `animationend` event (`onanimationend`) instead of
//! a `setTimeout`. The keyframes ship in `tokens.css` so the lifecycle completes
//! even when the consumer hasn't installed a Tailwind animation plugin, and a
//! `prefers-reduced-motion` block swaps the slide for a plain fade.
//!
//! Auto-dismiss (needs a host timer) and swipe-to-dismiss (pointer physics) stay
//! TS-only, as does stacking; the palette is the single dark theme (no
//! `next-themes`). See the README "Limitations".

use dioxus::prelude::*;

use crate::cn;

const TOAST_CLOSE: &str = "text-foreground/50 hover:text-foreground shrink-0 transition-colors";
#[derive(Clone, Copy, Default, PartialEq)]
pub enum ToastVariant {
	#[default]
	Default,
	Success,
	Error,
	Info,
	Warning,
}

impl ToastVariant {
	fn class(&self) -> &'static str {
		match self {
			ToastVariant::Default => "bg-popover text-popover-foreground border-border",
			ToastVariant::Success => "bg-popover text-popover-foreground border-main-accent-t2/40",
			ToastVariant::Error => "bg-popover text-popover-foreground border-destructive/50",
			ToastVariant::Info => "bg-popover text-popover-foreground border-border",
			ToastVariant::Warning => "bg-popover text-popover-foreground border-border",
		}
	}

	fn as_str(&self) -> &'static str {
		match self {
			ToastVariant::Default => "default",
			ToastVariant::Success => "success",
			ToastVariant::Error => "error",
			ToastVariant::Info => "info",
			ToastVariant::Warning => "warning",
		}
	}
}

/// Where the stack is pinned. Mirrors the TS `position` prop; default
/// bottom-right.
#[derive(Clone, Copy, Default, PartialEq)]
pub enum ToastPosition {
	TopLeft,
	TopCenter,
	TopRight,
	BottomLeft,
	BottomCenter,
	#[default]
	BottomRight,
}

impl ToastPosition {
	fn class(&self) -> &'static str {
		match self {
			ToastPosition::TopLeft => "top-0 left-0 items-start",
			ToastPosition::TopCenter => "top-0 left-1/2 -translate-x-1/2 items-center",
			ToastPosition::TopRight => "top-0 right-0 items-end",
			ToastPosition::BottomLeft => "bottom-0 left-0 items-start",
			ToastPosition::BottomCenter => "bottom-0 left-1/2 -translate-x-1/2 items-center",
			ToastPosition::BottomRight => "bottom-0 right-0 items-end",
		}
	}

	fn as_str(&self) -> &'static str {
		match self {
			ToastPosition::TopLeft => "top-left",
			ToastPosition::TopCenter => "top-center",
			ToastPosition::TopRight => "top-right",
			ToastPosition::BottomLeft => "bottom-left",
			ToastPosition::BottomCenter => "bottom-center",
			ToastPosition::BottomRight => "bottom-right",
		}
	}
}

/// Lifecycle phase of a single toast. A toast mounts `Open` (plays the enter
/// keyframe); [`ToasterHandle::dismiss`] flips it to `Closing` (plays the exit
/// keyframe), and it is dropped from the list once the exit `animationend`
/// fires. Mirrors the TS `data-state` of `"open"` / `"closed"`.
#[derive(Clone, Copy, Default, PartialEq)]
pub enum ToastState {
	#[default]
	Open,
	Closing,
}

impl ToastState {
	fn as_str(&self) -> &'static str {
		match self {
			ToastState::Open => "open",
			ToastState::Closing => "closed",
		}
	}
}

#[derive(Clone, PartialEq)]
pub struct Toast {
	pub id: u64,
	pub message: String,
	pub variant: ToastVariant,
	pub state: ToastState,
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
			state: ToastState::Open,
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

	/// Begins the exit animation: the toast flips to [`ToastState::Closing`]
	/// (`data-state="closed"`) and stays mounted so the exit keyframe can play.
	/// The live node is removed by [`ToasterHandle::remove`] when its
	/// `animationend` fires — there is no host timer.
	pub fn dismiss(&self, id: u64) {
		let mut items = self.toasts.items;
		if let Some(toast) = items.write().iter_mut().find(|t| t.id == id) {
			toast.state = ToastState::Closing;
		}
	}

	/// Drops a toast from the list outright. Wired to the exit `animationend`;
	/// the no-op-when-still-open guard lives at the call site (the enter
	/// `animationend` fires too, but only `Closing` toasts are removed).
	fn remove(&self, id: u64) {
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
	let cls = cn!("pointer-events-none fixed z-100 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 p-4", position.class(), class);
	rsx! {
		ol { class: cls, "data-slot": "toaster", "data-position": position.as_str(),
			for t in toasts.items.read().iter().cloned() {
				li {
					key: "{t.id}",
					role: "status",
					"aria-live": "polite",
					"data-slot": "toast",
					"data-variant": t.variant.as_str(),
					"data-state": t.state.as_str(),
					onanimationend: move |_| {
						if t.state == ToastState::Closing {
							handle.remove(t.id);
						}
					},
					class: cn!("pointer-events-auto flex w-full items-start gap-3 rounded-md border p-4 text-sm shadow-lg", t.variant.class()),
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
		assert!(html.contains("data-state=\"open\""), "fresh toast mounts open: {html}");
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
				toaster.toast("plain");
				toaster.info("info");
				toaster.warning("warning");
			});
			rsx! {}
		}
		let html = render(app);
		assert!(html.contains("data-variant=\"info\""), "{html}");
		assert!(html.contains("data-variant=\"warning\""), "{html}");
	}

	#[test]
	fn dismiss_marks_toast_closing_for_exit_animation() {
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
				let id = toaster.success("keep");
				toaster.dismiss(id);
			});
			rsx! {}
		}
		// Dismiss animates out rather than removing: the toast stays mounted in
		// the closing state (the live node is dropped on `animationend`, which
		// the static SSR render cannot fire).
		let html = render(app);
		assert!(html.contains("keep"), "closing toast still mounted: {html}");
		assert!(html.contains("data-state=\"closed\""), "{html}");
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
	fn each_position_maps_to_its_attribute() {
		for (pos, expected) in [
			(ToastPosition::TopLeft, "top-left"),
			(ToastPosition::TopRight, "top-right"),
			(ToastPosition::BottomLeft, "bottom-left"),
			(ToastPosition::BottomCenter, "bottom-center"),
			(ToastPosition::BottomRight, "bottom-right"),
		] {
			assert_eq!(pos.as_str(), expected);
		}
	}
}
