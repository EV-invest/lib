use dioxus::prelude::*;

use crate::cn;

/// The consumer's mark, painted as a CSS mask (`background-color: currentColor`
/// + `mask-image`) so a monochrome lockup follows the surrounding text colour
/// instead of the artwork's baked-in fill. `with_background` seats it on the
/// brand field, keeping a chip consistent with a favicon.
///
/// The kit ships no artwork. The mark is a design token like every colour: the
/// consumer declares `--brand-mark` — a `url()` at its own asset — and
/// `--brand-aspect` in the same sheet it declares the palette in (see
/// `tokens.css`). Undeclared, `mask-image` is invalid at computed-value time and
/// the span paints as a solid block: loud, and nobody else's logo.
#[component]
pub fn Logo(#[props(default)] class: String, #[props(default)] with_background: bool) -> Element {
	let mark = rsx! {
		span {
			"data-slot": "logo",
			"aria-hidden": "true",
			// the ratio's fallback is what makes a missing mark *visible*: a masked
			// span has no intrinsic size, so `h-N w-auto` without it is zero-width
			style: "background-color:currentColor;mask-image:var(--brand-mark);-webkit-mask-image:var(--brand-mark);mask-repeat:no-repeat;-webkit-mask-repeat:no-repeat;mask-position:center;-webkit-mask-position:center;mask-size:contain;-webkit-mask-size:contain;aspect-ratio:var(--brand-aspect,1)",
			class: cn!("inline-block", if with_background { "w-3/5 h-3/5".to_string() } else { class.clone() }),
		}
	};

	if !with_background {
		return mark;
	}

	rsx! {
		span { "data-slot": "logo-background", class: cn!("inline-flex items-center justify-center bg-brand", class), {mark} }
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn mask_is_the_consumers_token_and_follows_current_color() {
		fn app() -> Element {
			rsx! {
				Logo { class: "w-10 h-10 text-white" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"logo\""), "{html}");
		assert!(html.contains("background-color:currentColor"), "{html}");
		assert!(html.contains("mask-image:var(--brand-mark)"), "{html}");
		assert!(!html.contains("data:image/svg+xml"), "the kit carries no artwork: {html}");
		assert!(html.contains("w-10"), "{html}");
		assert!(!html.contains("logo-background"), "{html}");
	}

	#[test]
	fn with_background_seats_the_mark_on_the_brand_field() {
		fn app() -> Element {
			rsx! {
				Logo { class: "w-16 h-16 rounded-md", with_background: true }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"logo-background\""), "{html}");
		assert!(html.contains("bg-brand"), "{html}");
		assert!(html.contains("w-3/5 h-3/5"), "the mark scales inside the field: {html}");
		assert!(html.contains("w-16"), "caller class lands on the wrapper: {html}");
	}
}
