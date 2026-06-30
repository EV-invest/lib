use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{RESIZABLE_GROUP, RESIZABLE_HANDLE, RESIZABLE_HANDLE_GRIP, RESIZABLE_PANEL},
};

/// Layout axis of a [`ResizablePanelGroup`]; rendered as `data-panel-group-direction`
/// so the canonical class selectors flip the flex axis and the handle geometry.
#[derive(strum::AsRefStr, Clone, Copy, Default, PartialEq)]
#[strum(serialize_all = "kebab-case")]
pub enum ResizableDirection {
	#[default]
	Horizontal,
	Vertical,
}

#[component]
pub fn ResizablePanelGroup(#[props(default)] direction: ResizableDirection, #[props(default = 10.0)] keyboard_step: f64, #[props(default)] class: String, children: Element) -> Element {
	use_context_provider(|| ResizableCtx {
		sizes: Signal::new(Vec::new()),
		direction,
		step: keyboard_step,
	});
	let cls = cn!(RESIZABLE_GROUP, class);
	rsx! {
		div {
			class: cls,
			"data-slot": "resizable-panel-group",
			"data-panel-group-direction": direction.as_ref(),
			{children}
		}
	}
}
#[component]
pub fn ResizablePanel(index: usize, #[props(default = 50.0)] default_size: f64, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<ResizableCtx>();
	use_hook(|| {
		let mut sizes = ctx.sizes;
		let mut current = sizes.peek().clone();
		if current.len() <= index {
			current.resize(index + 1, 0.0);
		}
		current[index] = default_size;
		sizes.set(current);
	});
	let basis = ctx.size_at(index);
	let cls = cn!(RESIZABLE_PANEL, class);
	rsx! {
		div {
			class: cls,
			"data-slot": "resizable-panel",
			style: "flex: {basis} 1 0%;",
			{children}
		}
	}
}
#[component]
pub fn ResizableHandle(index: usize, #[props(default)] with_handle: bool, #[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<ResizableCtx>();
	let dir: &str = ctx.direction.as_ref();

	// pointer-drag: TS-only, keyboard in Rust — see README Limitations
	let on_key = move |e: KeyboardEvent| {
		let delta = match (ctx.direction, e.key()) {
			(ResizableDirection::Horizontal, Key::ArrowLeft) | (ResizableDirection::Vertical, Key::ArrowUp) => -ctx.step,
			(ResizableDirection::Horizontal, Key::ArrowRight) | (ResizableDirection::Vertical, Key::ArrowDown) => ctx.step,
			_ => return,
		};
		e.prevent_default();
		ctx.resize(index, delta);
	};

	let cls = cn!(RESIZABLE_HANDLE, class);
	rsx! {
		div {
			class: cls,
			"data-slot": "resizable-handle",
			"data-panel-group-direction": dir,
			role: "separator",
			"aria-orientation": if ctx.direction == ResizableDirection::Horizontal { "vertical" } else { "horizontal" },
			tabindex: "0",
			onkeydown: on_key,
			if with_handle {
				div { class: RESIZABLE_HANDLE_GRIP,
					svg {
						class: "size-2.5",
						xmlns: "http://www.w3.org/2000/svg",
						width: "15",
						height: "15",
						view_box: "0 0 24 24",
						fill: "none",
						stroke: "currentColor",
						"stroke-width": "2",
						"stroke-linecap": "round",
						"stroke-linejoin": "round",
						circle { cx: "9", cy: "12", r: "1" }
						circle { cx: "9", cy: "5", r: "1" }
						circle { cx: "9", cy: "19", r: "1" }
						circle { cx: "15", cy: "12", r: "1" }
						circle { cx: "15", cy: "5", r: "1" }
						circle { cx: "15", cy: "19", r: "1" }
					}
				}
			}
			{children}
		}
	}
}
/// Shared group state: the per-panel sizes (in %) and the layout direction. The
/// sizes [`Signal`] is mutated by panels on registration and by handles on
/// keyboard resize. `Copy`, so the whole context is `Copy`.
#[derive(Clone, Copy)]
struct ResizableCtx {
	sizes: Signal<Vec<f64>>,
	direction: ResizableDirection,
	step: f64,
}

impl ResizableCtx {
	fn size_at(&self, index: usize) -> f64 {
		self.sizes.peek().get(index).copied().unwrap_or(0.0)
	}

	/// Grows the panel before the handle by `delta` %, shrinking the one after it
	/// (negative `delta` reverses), clamped so neither drops below 0.
	fn resize(&self, index: usize, delta: f64) {
		let mut sizes = self.sizes;
		let mut next = sizes.peek().clone();
		if index + 1 >= next.len() {
			return;
		}
		let moved = delta.clamp(-next[index], next[index + 1]);
		next[index] += moved;
		next[index + 1] -= moved;
		sizes.set(next);
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn group_carries_slot_and_direction() {
		fn app() -> Element {
			rsx! {
				ResizablePanelGroup {
					ResizablePanel { index: 0, default_size: 50.0, "a" }
					ResizableHandle { index: 0 }
					ResizablePanel { index: 1, default_size: 50.0, "b" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"resizable-panel-group\""), "{html}");
		assert!(html.contains("data-panel-group-direction=\"horizontal\""), "{html}");
	}

	#[test]
	fn panels_render_flex_basis_from_default_size() {
		fn app() -> Element {
			rsx! {
				ResizablePanelGroup {
					ResizablePanel { index: 0, default_size: 30.0, "a" }
					ResizableHandle { index: 0 }
					ResizablePanel { index: 1, default_size: 70.0, "b" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"resizable-panel\""), "{html}");
		assert!(html.contains("flex: 30 1 0%"), "{html}");
		assert!(html.contains("flex: 70 1 0%"), "{html}");
	}

	#[test]
	fn handle_is_a_separator_with_orientation() {
		fn app() -> Element {
			rsx! {
				ResizablePanelGroup {
					ResizablePanel { index: 0, "a" }
					ResizableHandle { index: 0 }
					ResizablePanel { index: 1, "b" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"resizable-handle\""), "{html}");
		assert!(html.contains("role=\"separator\""), "{html}");
		assert!(html.contains("aria-orientation=\"vertical\""), "{html}");
	}

	#[test]
	fn vertical_group_flips_orientation() {
		fn app() -> Element {
			rsx! {
				ResizablePanelGroup { direction: ResizableDirection::Vertical,
					ResizablePanel { index: 0, "a" }
					ResizableHandle { index: 0 }
					ResizablePanel { index: 1, "b" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-panel-group-direction=\"vertical\""), "{html}");
		assert!(html.contains("aria-orientation=\"horizontal\""), "{html}");
	}

	#[test]
	fn with_handle_renders_grip() {
		fn app() -> Element {
			rsx! {
				ResizablePanelGroup {
					ResizablePanel { index: 0, "a" }
					ResizableHandle { index: 0, with_handle: true }
					ResizablePanel { index: 1, "b" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("rounded-xs"), "{html}");
		assert!(html.contains("<svg"), "{html}");
		assert!(html.contains("<circle"), "{html}");
	}

	#[test]
	fn class_override_merges_on_group() {
		fn app() -> Element {
			rsx! {
				ResizablePanelGroup { class: "h-40",
					ResizablePanel { index: 0, "a" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("h-40"), "{html}");
		assert!(!html.contains("h-full"), "override should drop base h-full: {html}");
	}
}
