use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{
		Size,
		button::{Button, ButtonVariant},
		primitives::{Controllable, use_controllable},
	},
};

#[derive(Clone, Copy, Default, Eq, PartialEq)]
pub enum CarouselOrientation {
	#[default]
	Horizontal,
	Vertical,
}

#[component]
pub fn Carousel(
	#[props(default)] orientation: CarouselOrientation,
	index: Option<usize>,
	#[props(default)] default_index: usize,
	on_index_change: Option<EventHandler<usize>>,
	#[props(default)] class: String,
	children: Element,
) -> Element {
	let index = use_controllable(index, default_index, on_index_change);
	let count = use_signal(|| 0usize);
	let ctx = use_context_provider(|| CarouselContext { orientation, index, count });
	let cls = cn!("relative", class);
	rsx! {
		div {
			class: cls,
			role: "region",
			"aria-roledescription": "carousel",
			tabindex: "0",
			"data-slot": "carousel",
			onkeydown: move |e| match e.key() {
					Key::ArrowLeft => {
							e.prevent_default();
							ctx.scroll_prev();
					}
					Key::ArrowRight => {
							e.prevent_default();
							ctx.scroll_next();
					}
					_ => {}
			},
			{children}
		}
	}
}
#[component]
pub fn CarouselContent(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<CarouselContext>();
	let index = ctx.index.get();
	// drag/momentum: omitted vs embla — see README Limitations
	let transform = match ctx.orientation {
		CarouselOrientation::Horizontal => format!("translate3d(-{}%, 0, 0)", index * 100),
		CarouselOrientation::Vertical => format!("translate3d(0, -{}%, 0)", index * 100),
	};
	let track = match ctx.orientation {
		CarouselOrientation::Horizontal => "-ml-4",
		CarouselOrientation::Vertical => "-mt-4 flex-col",
	};
	let cls = cn!("flex transition-transform", track, class);
	rsx! {
		div { class: "overflow-hidden", "data-slot": "carousel-content",
			div { class: cls, style: "transform: {transform}", {children} }
		}
	}
}
#[component]
pub fn CarouselItem(#[props(default)] class: String, children: Element) -> Element {
	let ctx = use_context::<CarouselContext>();
	let pad = match ctx.orientation {
		CarouselOrientation::Horizontal => "pl-4",
		CarouselOrientation::Vertical => "pt-4",
	};
	let cls = cn!("min-w-0 shrink-0 grow-0 basis-full", pad, class);
	rsx! {
		div {
			role: "group",
			"aria-roledescription": "slide",
			"data-slot": "carousel-item",
			class: cls,
			{children}
		}
	}
}
#[component]
pub fn CarouselPrevious(#[props(default)] class: String) -> Element {
	let ctx = use_context::<CarouselContext>();
	let pos = match ctx.orientation {
		CarouselOrientation::Horizontal => "top-1/2 -left-12 -translate-y-1/2",
		CarouselOrientation::Vertical => "-top-12 left-1/2 -translate-x-1/2 rotate-90",
	};
	let cls = cn!("absolute size-8 rounded-full", pos, class);
	rsx! {
		Button {
			variant: ButtonVariant::Outline,
			size: Size::Md,
			icon: true,
			class: cls,
			disabled: !ctx.can_scroll_prev(),
			onclick: move |_| ctx.scroll_prev(),
			svg {
				xmlns: "http://www.w3.org/2000/svg",
				view_box: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				stroke_width: "2",
				stroke_linecap: "round",
				stroke_linejoin: "round",
				"aria-hidden": "true",
				path { d: "m15 18-6-6 6-6" }
			}
			span { class: "sr-only", "Previous slide" }
		}
	}
}
#[component]
pub fn CarouselNext(#[props(default)] class: String) -> Element {
	let ctx = use_context::<CarouselContext>();
	let pos = match ctx.orientation {
		CarouselOrientation::Horizontal => "top-1/2 -right-12 -translate-y-1/2",
		CarouselOrientation::Vertical => "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
	};
	let cls = cn!("absolute size-8 rounded-full", pos, class);
	rsx! {
		Button {
			variant: ButtonVariant::Outline,
			size: Size::Md,
			icon: true,
			class: cls,
			disabled: !ctx.can_scroll_next(),
			onclick: move |_| ctx.scroll_next(),
			svg {
				xmlns: "http://www.w3.org/2000/svg",
				view_box: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				stroke_width: "2",
				stroke_linecap: "round",
				stroke_linejoin: "round",
				"aria-hidden": "true",
				path { d: "m9 18 6-6-6-6" }
			}
			span { class: "sr-only", "Next slide" }
		}
	}
}
/// Netflix-style edge scrims that dissolve the current slide into the surface
/// colour, signalling adjacent slides without revealing them. Each side shows
/// only when there is somewhere to scroll. Drop inside a [`Carousel`].
#[component]
pub fn CarouselEdgeFade(#[props(default)] class: String) -> Element {
	let ctx = use_context::<CarouselContext>();
	let prev = cn!(
		"pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-background via-background/60 to-transparent transition-opacity duration-300",
		if ctx.can_scroll_prev() { "opacity-100" } else { "opacity-0" },
		class.clone()
	);
	let next = cn!(
		"pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-background via-background/60 to-transparent transition-opacity duration-300",
		if ctx.can_scroll_next() { "opacity-100" } else { "opacity-0" },
		class
	);
	rsx! {
		div { class: prev, "aria-hidden": "true" }
		div { class: next, "aria-hidden": "true" }
	}
}
#[derive(Clone, Copy)]
struct CarouselContext {
	orientation: CarouselOrientation,
	index: Controllable<usize>,
	count: Signal<usize>,
}

impl CarouselContext {
	fn can_scroll_prev(&self) -> bool {
		self.index.get() > 0
	}

	fn can_scroll_next(&self) -> bool {
		self.index.get() + 1 < (self.count)()
	}

	fn scroll_prev(&self) {
		let i = self.index.get();
		if i > 0 {
			self.index.set(i - 1);
		}
	}

	fn scroll_next(&self) {
		let i = self.index.get();
		if i + 1 < (self.count)() {
			self.index.set(i + 1);
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn carousel_renders_region_and_slots() {
		fn app() -> Element {
			rsx! {
				Carousel {
					CarouselContent {
						CarouselItem { "a" }
						CarouselItem { "b" }
					}
					CarouselPrevious {}
					CarouselNext {}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"carousel\""), "{html}");
		assert!(html.contains("aria-roledescription=\"carousel\""), "{html}");
		assert!(html.contains("data-slot=\"carousel-content\""), "{html}");
		assert!(html.contains("data-slot=\"carousel-item\""), "{html}");
		assert!(html.contains("basis-full"), "{html}");
	}

	#[test]
	fn item_uses_horizontal_padding_by_default() {
		fn app() -> Element {
			rsx! {
				Carousel {
					CarouselItem { "a" }
				}
			}
		}
		let html = render(app);
		assert!(html.contains("pl-4"), "{html}");
	}

	#[test]
	fn previous_disabled_at_start() {
		fn app() -> Element {
			rsx! {
				Carousel {
					CarouselPrevious {}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"button\""), "{html}");
		assert!(html.contains("disabled"), "prev should be disabled at index 0: {html}");
		assert!(html.contains("m15 18-6-6 6-6"), "{html}");
	}

	#[test]
	fn content_transform_translates_by_index() {
		fn app() -> Element {
			rsx! {
				Carousel { index: 1,
					CarouselContent {
						CarouselItem { "a" }
						CarouselItem { "b" }
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("translate3d(-100%, 0, 0)"), "{html}");
	}
}
