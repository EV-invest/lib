use dioxus::prelude::*;

use crate::{cn, uikit::primitives::use_controllable};

const ROOT_BASE: &str = "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 \
                         data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 \
                         data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col";
const TRACK_BASE: &str = "bg-muted relative grow overflow-hidden rounded-full \
                          data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full \
                          data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5";
const RANGE_BASE: &str = "bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full";
const THUMB_BASE: &str = "border-primary ring-ring/50 block size-4 shrink-0 rounded-full border bg-white shadow-sm \
                          transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden \
                          disabled:pointer-events-none disabled:opacity-50";

/// Orientation of a [`Slider`]; rendered as `data-orientation` so the landing
/// class selectors lay the track out horizontally or vertically.
#[derive(strum::AsRefStr, Clone, Copy, Default, PartialEq)]
#[strum(serialize_all = "kebab-case")]
pub enum SliderOrientation {
	#[default]
	Horizontal,
	Vertical,
}

#[component]
pub fn Slider(
	#[props(default)] class: String,
	value: Option<f64>,
	#[props(default)] default_value: f64,
	on_value_change: Option<EventHandler<f64>>,
	#[props(default = 0.0)] min: f64,
	#[props(default = 100.0)] max: f64,
	#[props(default = 1.0)] step: f64,
	#[props(default)] orientation: SliderOrientation,
	#[props(default)] disabled: bool,
) -> Element {
	let state = use_controllable(value, default_value, on_value_change);
	let current = clamp_step(state.get(), min, max, step);
	let span = (max - min).max(f64::EPSILON);
	let percent = ((current - min) / span * 100.0).clamp(0.0, 100.0);
	let ori: &str = orientation.as_ref();

	let range_style = match orientation {
		SliderOrientation::Horizontal => format!("width: {percent}%;"),
		SliderOrientation::Vertical => format!("height: {percent}%;"),
	};
	// The thumb is absolutely positioned within the (relative) root and centred on
	// the value point; without `position:absolute` the `%` offset is ignored and
	// flow layout parks it at the end of the row.
	let thumb_style = match orientation {
		SliderOrientation::Horizontal => format!("position: absolute; left: {percent}%; top: 50%; transform: translate(-50%, -50%);"),
		SliderOrientation::Vertical => format!("position: absolute; bottom: {percent}%; left: 50%; transform: translate(-50%, 50%);"),
	};

	// Track geometry, captured on mount and re-measured on each press, lets a
	// pointer drag map cursor position → value (the TS port reads
	// `getBoundingClientRect`; we use Dioxus' renderer-agnostic `get_client_rect`).
	let mut track = use_signal(|| Option::<std::rc::Rc<MountedData>>::None);
	let mut bounds = use_signal(|| (0.0_f64, 1.0_f64));
	let mut dragging = use_signal(|| false);

	let on_key = move |e: KeyboardEvent| {
		if disabled {
			return;
		}
		let next = match e.key() {
			Key::ArrowRight | Key::ArrowUp => current + step,
			Key::ArrowLeft | Key::ArrowDown => current - step,
			Key::Home => min,
			Key::End => max,
			_ => return,
		};
		e.prevent_default();
		state.set(clamp_step(next, min, max, step));
	};

	let axis = move |e: &PointerEvent| match orientation {
		SliderOrientation::Horizontal => e.client_coordinates().x,
		SliderOrientation::Vertical => e.client_coordinates().y,
	};

	// Pointer handling lives on the root, not the track: the thumb sits above the
	// track (absolute), so grabbing it must still start a drag.
	rsx! {
		span {
			class: cn!(ROOT_BASE, class),
			"data-slot": "slider",
			"data-orientation": ori,
			"data-disabled": disabled,
			onpointerdown: move |e: PointerEvent| async move {
				if disabled {
					return;
				}
				let Some(t) = track() else { return };
				let Ok(rect) = t.get_client_rect().await else { return };
				let (origin, size) = match orientation {
					SliderOrientation::Horizontal => (rect.origin.x, rect.size.width),
					SliderOrientation::Vertical => (rect.origin.y, rect.size.height),
				};
				bounds.set((origin, size));
				dragging.set(true);
				state.set(value_at(axis(&e), origin, size, min, max, step, orientation));
			},
			onpointermove: move |e: PointerEvent| {
				if !dragging() || disabled {
					return;
				}
				let (origin, size) = bounds();
				state.set(value_at(axis(&e), origin, size, min, max, step, orientation));
			},
			onpointerup: move |_| dragging.set(false),
			onpointerleave: move |_| dragging.set(false),
			span {
				class: TRACK_BASE,
				"data-slot": "slider-track",
				"data-orientation": ori,
				onmounted: move |e: MountedEvent| track.set(Some(e.data())),
				span {
					class: RANGE_BASE,
					"data-slot": "slider-range",
					"data-orientation": ori,
					style: range_style,
				}
			}
			span {
				class: THUMB_BASE,
				"data-slot": "slider-thumb",
				"data-orientation": ori,
				style: thumb_style,
				role: "slider",
				tabindex: if disabled { "-1" } else { "0" },
				"aria-valuenow": current,
				"aria-valuemin": min,
				"aria-valuemax": max,
				"aria-orientation": ori,
				"aria-disabled": disabled,
				onkeydown: on_key,
			}
		}
	}
}

/// Maps a client coordinate along the active axis to a stepped value, given the
/// track's origin and size on that axis. Vertical runs bottom-to-top.
fn value_at(client: f64, origin: f64, size: f64, min: f64, max: f64, step: f64, orientation: SliderOrientation) -> f64 {
	let size = size.max(f64::EPSILON);
	let ratio = match orientation {
		SliderOrientation::Horizontal => (client - origin) / size,
		SliderOrientation::Vertical => 1.0 - (client - origin) / size,
	};
	clamp_step(min + ratio * (max - min), min, max, step)
}
fn clamp_step(value: f64, min: f64, max: f64, step: f64) -> f64 {
	let clamped = value.clamp(min, max);
	if step <= 0.0 {
		return clamped;
	}
	let steps = ((clamped - min) / step).round();
	(min + steps * step).clamp(min, max)
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn renders_slots_role_and_aria() {
		fn app() -> Element {
			rsx! {
				Slider { default_value: 25.0 }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"slider\""), "{html}");
		assert!(html.contains("data-slot=\"slider-track\""), "{html}");
		assert!(html.contains("data-slot=\"slider-range\""), "{html}");
		assert!(html.contains("data-slot=\"slider-thumb\""), "{html}");
		assert!(html.contains("role=\"slider\""), "{html}");
		assert!(html.contains("aria-valuenow=25"), "{html}");
		assert!(html.contains("aria-valuemin=0"), "{html}");
		assert!(html.contains("aria-valuemax=100"), "{html}");
		assert!(html.contains("aria-orientation=\"horizontal\""), "{html}");
	}

	#[test]
	fn range_and_thumb_reflect_percent() {
		fn app() -> Element {
			rsx! {
				Slider { default_value: 25.0, min: 0.0, max: 100.0 }
			}
		}
		let html = render(app);
		assert!(html.contains("width: 25%"), "{html}");
		assert!(html.contains("left: 25%"), "{html}");
	}

	#[test]
	fn vertical_uses_height_and_bottom() {
		fn app() -> Element {
			rsx! {
				Slider { default_value: 40.0, orientation: SliderOrientation::Vertical }
			}
		}
		let html = render(app);
		assert!(html.contains("data-orientation=\"vertical\""), "{html}");
		assert!(html.contains("height: 40%"), "{html}");
		assert!(html.contains("bottom: 40%"), "{html}");
	}

	#[test]
	fn controlled_value_clamps_to_range() {
		fn app() -> Element {
			rsx! {
				Slider { value: 150.0, min: 0.0, max: 100.0 }
			}
		}
		let html = render(app);
		assert!(html.contains("aria-valuenow=100"), "{html}");
	}

	#[test]
	fn class_override_merges() {
		fn app() -> Element {
			rsx! {
				Slider { default_value: 0.0, class: "w-40" }
			}
		}
		let html = render(app);
		assert!(html.contains("w-40"), "{html}");
		// the root's standalone `w-full` is dropped by the override; the track's
		// `data-[orientation=horizontal]:w-full` is a different utility and stays.
		assert!(!html.contains("flex w-full"), "override should drop root w-full: {html}");
	}
}
