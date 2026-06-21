//! Toast notifications.
//!
//! Where the TS mirror exposes a module-global `toast(...)` function backed by a
//! singleton store, Dioxus has no clean cross-component mutable singleton, so the
//! Rust kit uses a [`ToasterProvider`] that owns a [`Toasts`] signal in context
//! plus a [`use_toaster`] hook returning a [`ToasterHandle`] with `.success`,
//! `.error`, `.info`, `.warning` and `.dismiss`.
//!
//! ## Stacking + animation
//!
//! Mirrors Sonner (and the TS port) via the shared `data-stack` CSS in
//! `tokens.css`: toasts are absolutely stacked at the pinned edge and pile up
//! collapsed (front [`VISIBLE_TOASTS`] peeking, scaled by depth), expanding into
//! a list on hover / keyboard focus — pure CSS, no host state. Each [`ToastItem`]
//! feeds the layout vars (`--index`, `--offset`, …); because heights can't be
//! measured here (that needs host-only `web-sys`), they're derived from a
//! constant [`TOAST_HEIGHT_EST`], so the collapsed pile is exact and the expanded
//! list is uniformly spaced.
//!
//! Animation stays host-timer-free: a [`ToastItem`] flips `data-mounted` in
//! ([`use_effect`]) to play the enter transition, [`ToasterHandle::dismiss`] (and
//! the close button) flip [`ToastState`] to `Closing`/`data-state="closed"` to
//! slide it out, and the live node is dropped on the exit transform's
//! `transitionend` (`ontransitionend`, guarded to the closing state) rather than
//! a `setTimeout`. A `prefers-reduced-motion` block reduces the motion.
//!
//! Auto-dismiss (needs a host timer, so no hover-pause either) and swipe-to-dismiss
//! (pointer physics) stay TS-only; the palette is the single dark theme (no
//! `next-themes`). See the README "Limitations".

use dioxus::prelude::*;

use crate::cn;

const TOAST_CLOSE: &str = "text-foreground/50 hover:text-foreground shrink-0 transition-colors";
/// Only the front three toasts show while the stack is collapsed.
const VISIBLE_TOASTS: usize = 3;
/// Gap (px) between toasts once the stack is expanded.
const GAP: u32 = 14;
/// Dioxus can't measure a toast's height (it needs host-only `web-sys`), so the
/// stack assumes this height (px) for the collapse clamp and the expanded
/// spacing: the collapsed pile is exact, the expanded list is uniformly spaced.
/// Tuned to a single-line toast (p-4 + one text-sm line).
const TOAST_HEIGHT_EST: u32 = 56;
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
		// the toaster carries the viewport inset itself (no padding) so the
		// absolutely positioned toasts size to its box and don't spill past the edge
		match self {
			ToastPosition::TopLeft => "top-4 left-4",
			ToastPosition::TopCenter => "top-4 left-1/2 -translate-x-1/2",
			ToastPosition::TopRight => "top-4 right-4",
			ToastPosition::BottomLeft => "bottom-4 left-4",
			ToastPosition::BottomCenter => "bottom-4 left-1/2 -translate-x-1/2",
			ToastPosition::BottomRight => "bottom-4 right-4",
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

/// Renders the toast stack from context as a Sonner-style pile: collapsed by
/// default (front three peeking, scaled by depth), expanding into a list on
/// hover / keyboard focus (pure CSS). Fixed-positioned per `position` (default
/// bottom-right). Unlike the TS mirror there is no `setTimeout` auto-dismiss (so
/// nothing to pause on hover) and no swipe — the kit is render-only and
/// host-timer-free; dismiss happens on the close button or via
/// [`ToasterHandle::dismiss`], which slides the toast out and drops it on its
/// `transitionend`.
#[component]
pub fn Toaster(#[props(default)] position: ToastPosition, #[props(default)] class: String) -> Element {
	let toasts = use_context::<Toasts>();
	let y = match position {
		ToastPosition::TopLeft | ToastPosition::TopCenter | ToastPosition::TopRight => "top",
		_ => "bottom",
	};
	let cls = cn!("pointer-events-none fixed z-100 w-[calc(100%-2rem)] max-w-sm", position.class(), class);
	let items = toasts.items.read();
	let total = items.len();
	rsx! {
		ol {
			class: cls,
			"data-slot": "toaster",
			"data-position": position.as_str(),
			"data-y-position": y,
			"data-stack": "",
			style: "--front-height: {TOAST_HEIGHT_EST}px; --gap: {GAP}px;",
			// newest first → front of the stack (index 0)
			for (index, t) in items.iter().rev().cloned().enumerate() {
				ToastItem { key: "{t.id}", toast: t, index, total }
			}
		}
	}
}

/// One toast in the stack. Mirrors the TS `ToastItem`: a `data-mounted` flip
/// plays the enter, `data-state="closed"` slides it out, and the live node is
/// dropped on the exit transform's `transitionend` (guarded to the closing state
/// so an open-state restack never removes it). Layout vars come from the
/// constant height — no measuring.
#[component]
fn ToastItem(toast: Toast, index: usize, total: usize) -> Element {
	let handle = use_toaster();
	let mut mounted = use_signal(|| false);
	use_effect(move || mounted.set(true));

	let id = toast.id;
	let state = toast.state;
	let is_mounted = mounted();
	let front = index == 0;
	let visible = index < VISIBLE_TOASTS;
	let offset = index as u32 * (TOAST_HEIGHT_EST + GAP);
	let z = total - index;

	rsx! {
		li {
			role: "status",
			"aria-live": "polite",
			"data-slot": "toast",
			"data-variant": toast.variant.as_str(),
			"data-state": state.as_str(),
			"data-mounted": "{is_mounted}",
			"data-front": "{front}",
			"data-visible": "{visible}",
			style: "--index: {index}; --z-index: {z}; --offset: {offset}px; --initial-height: {TOAST_HEIGHT_EST}px;",
			ontransitionend: move |_| {
				if state == ToastState::Closing {
					handle.remove(id);
				}
			},
			class: cn!("pointer-events-auto flex w-full items-start gap-3 rounded-md border p-4 text-sm shadow-lg", toast.variant.class()),
			div { class: "flex-1 space-y-1",
				div { class: "font-medium", "{toast.message}" }
			}
			button {
				r#type: "button",
				"aria-label": "Close",
				"data-slot": "toast-close",
				class: TOAST_CLOSE,
				onclick: move |_| handle.dismiss(id),
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
		assert!(html.contains("data-y-position=\"top\""), "{html}");
		assert!(html.contains("data-stack"), "stack model is on: {html}");
		assert!(html.contains("data-slot=\"toaster\""), "{html}");
	}

	#[test]
	fn stack_marks_front_and_depth() {
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
				toaster.info("older");
				toaster.warning("newer");
			});
			rsx! {}
		}
		// newest toast is the front of the stack (index 0); both carry stacking vars
		let html = render(app);
		assert!(html.contains("data-front=\"true\""), "a front toast: {html}");
		assert!(html.contains("data-front=\"false\""), "a back toast: {html}");
		assert!(html.contains("--index: 0"), "{html}");
		assert!(html.contains("--index: 1"), "{html}");
		assert!(html.contains("data-visible=\"true\""), "{html}");
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
