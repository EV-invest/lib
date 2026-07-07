//! Pins the `Slider` SSR output against the shadcn/Radix reference markup the
//! design hands us. The reference below is the *browser-serialized DOM*; our
//! dioxus-ssr string is semantically identical but differs in three encoding
//! conventions the browser normalizes away on parse, so we don't chase them:
//!   - `&` escaped as `&#38;` (dioxus) vs `&amp;` (DOM serializer)
//!   - numeric attrs unquoted (`aria-valuenow=420000`) — valid HTML, DOM quotes
//!   - attribute order: dioxus emits `class` first, the DOM keeps source order
//!
//! Everything else must match byte-for-byte, which is what `EXPECTED` encodes.
#![cfg(feature = "uikit")]

use dioxus::prelude::*;
use ev_lib::uikit::Slider;

// Reference (browser DOM), for the human reading this test:
// <span data-slot="slider" data-orientation="horizontal" class="...[&amp;_[data-slot=slider-track]]:bg-main-black/50..." aria-label="Principal investment">
//   <span data-slot="slider-track" ...><span data-slot="slider-range" ... style="width: 38.9474%;"></span></span>
//   <span data-slot="slider-thumb" ... style="position: absolute; left: 38.9474%; ..." role="slider" tabindex="0"
//         aria-valuenow="420000" aria-valuemin="50000" aria-valuemax="1000000" aria-orientation="horizontal"></span>
// </span>
const EXPECTED: &str = concat!(
	r#"<span class="relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col [&#38;_[data-slot=slider-track]]:bg-main-black/50 [&#38;_[data-slot=slider-range]]:bg-main-accent-t1 [&#38;_[data-slot=slider-thumb]]:border-main-accent-t1" data-slot="slider" data-orientation="horizontal" aria-label="Principal investment">"#,
	r#"<span class="bg-muted relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5" data-slot="slider-track" data-orientation="horizontal">"#,
	r#"<span class="bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full" data-slot="slider-range" data-orientation="horizontal" style="width: 38.9474%;"></span></span>"#,
	r#"<span class="border-primary ring-ring/50 block size-4 shrink-0 rounded-full border bg-white shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50" data-slot="slider-thumb" data-orientation="horizontal" style="position: absolute; left: 38.9474%; top: 50%; transform: translate(-50%, -50%);" role="slider" tabindex="0" aria-valuenow=420000 aria-valuemin=50000 aria-valuemax=1000000 aria-orientation="horizontal"></span></span>"#,
);

#[test]
fn matches_principal_investment_reference() {
	fn app() -> Element {
		rsx! {
			Slider {
				value: 420000.0,
				min: 50000.0,
				max: 1000000.0,
				aria_label: "Principal investment",
				class: "[&_[data-slot=slider-track]]:bg-main-black/50 [&_[data-slot=slider-range]]:bg-main-accent-t1 [&_[data-slot=slider-thumb]]:border-main-accent-t1",
			}
		}
	}
	let mut dom = VirtualDom::new(app);
	dom.rebuild_in_place();
	let html = dioxus_ssr::render(&dom);
	assert_eq!(html, EXPECTED);
}
