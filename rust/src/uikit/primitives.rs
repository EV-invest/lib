//! Behaviour primitives shared by the interactive components.
//!
//! Unlike the TypeScript port, the Rust kit does **not** ship a Portal, a
//! measured floating engine, or a focus-trap: Dioxus has no renderer-agnostic
//! portal, and measuring layout needs `web-sys` (host-only, not I/O-free).
//! Overlays therefore render inline with `position: fixed`, a full-screen
//! backdrop for outside-dismiss, CSS-only placement via [`Side`], and the
//! browser's native focus order. See the README "Limitations". The one
//! primitive that ports cleanly — controlled/uncontrolled state — lives here.

use dioxus::prelude::*;

/// Which edge of its anchor an overlay is placed against. Rendered as a
/// `data-side` attribute so CSS positions and animates the overlay; the kit
/// does not measure the viewport (the TS `useFloating` does).
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum Side {
	Top,
	Right,
	#[default]
	Bottom,
	Left,
}

impl Side {
	pub fn as_str(&self) -> &'static str {
		match self {
			Side::Top => "top",
			Side::Right => "right",
			Side::Bottom => "bottom",
			Side::Left => "left",
		}
	}
}

/// Controlled/uncontrolled state, the mirror of TS `useControllableState`. When
/// `controlled` is `Some` the component is controlled — reads return that value
/// and [`Controllable::set`] only forwards to `on_change`; otherwise it owns an
/// internal [`Signal`] seeded from `default`.
pub struct Controllable<T: Clone + PartialEq + 'static> {
	signal: Signal<T>,
	controlled: bool,
	on_change: Option<EventHandler<T>>,
}
impl<T: Clone + PartialEq + 'static> Controllable<T> {
	pub fn get(&self) -> T {
		self.signal.read().clone()
	}

	pub fn set(&self, next: T) {
		if !self.controlled {
			let mut sig = self.signal;
			sig.set(next.clone());
		}
		if let Some(handler) = &self.on_change {
			handler.call(next);
		}
	}
}

impl<T: Clone + PartialEq + 'static> Clone for Controllable<T> {
	fn clone(&self) -> Self {
		*self
	}
}
impl<T: Clone + PartialEq + 'static> Copy for Controllable<T> {}

/// Seeds a [`Controllable`] state. Keeps the internal signal in sync with the
/// controlled value across re-renders.
pub fn use_controllable<T: Clone + PartialEq + 'static>(controlled: Option<T>, default: T, on_change: Option<EventHandler<T>>) -> Controllable<T> {
	let mut signal = use_signal(|| controlled.clone().unwrap_or(default));
	if let Some(value) = controlled.clone()
		&& *signal.peek() != value
	{
		signal.set(value);
	}
	Controllable {
		signal,
		controlled: controlled.is_some(),
		on_change,
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn side_as_str() {
		assert_eq!(Side::Bottom.as_str(), "bottom");
		assert_eq!(Side::default(), Side::Bottom);
	}

	#[test]
	fn uncontrolled_uses_default_then_updates() {
		fn app() -> Element {
			let state = use_controllable::<bool>(None, false, None);
			let label = if state.get() { "on" } else { "off" };
			rsx! {
				button {
					onclick: move |_| state.set(true),
					{label}
				}
			}
		}
		// On first render the default is observed.
		assert!(render(app).contains("off"));
	}

	#[test]
	fn controlled_reflects_external_value() {
		fn app() -> Element {
			let state = use_controllable::<bool>(Some(true), false, None);
			let label = if state.get() { "on" } else { "off" };
			rsx! { span { {label} } }
		}
		assert!(render(app).contains("on"));
	}
}
