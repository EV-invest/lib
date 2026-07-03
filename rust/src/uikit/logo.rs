use dioxus::prelude::*;

use crate::cn;

/// The EV Investment mark from site_conductor, rendered as a CSS mask
/// (`background-color: currentColor` + `mask-image`) so the monochrome lockup
/// follows the surrounding text color instead of the SVG's baked-in black. The
/// SVG is inlined as a URL-encoded `data:` URI (byte-identical to the TS port's)
/// so consumers need no asset pipeline; `src` swaps in an externally hosted mark
/// when one is preferred.
///
/// `with_background` paints the clean brand field generated from
/// OKLCH(0.256, 0.1, 260) behind the mark, keeping the chip consistent with the
/// favicon.
const LOGO_DATA_URI: &str = "data:image/svg+xml,%3Csvg width=%22387%22 height=%22335%22 viewBox=%220 0 387 335%22 fill=%22none%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath d=%22M0.120605 130.841L140.84 112.176V61.7481L156.149 65.3501V104.786L163.641 103.662V66.6599L178.625 69.607V102.353L185.791 101.043V61.0932L156.475 48.3224L119.992 60.4383V101.043L0.120605 130.841Z%22 fill=%22black%22/%3E%3Cpath d=%22M213.479 112.176L237.584 114.469L237.258 0.841309L202.078 19.8338V72.8816L213.479 78.1209V112.176Z%22 fill=%22black%22/%3E%3Cpath d=%22M240.841 0.841309L276.347 20.1612V117.743L260.711 115.778V26.3829L240.841 15.9043V0.841309Z%22 fill=%22black%22/%3E%3Cpath d=%22M284.816 118.725L386.121 127.239L304.36 109.884V74.1914L284.816 63.7128V118.725Z%22 fill=%22black%22/%3E%3Cpath d=%22M0.120605 130.841L140.84 112.176V61.7481L156.149 65.3501V104.786L163.641 103.662V66.6599L178.625 69.607V102.353L185.791 101.043V61.0932L156.475 48.3224L119.992 60.4383V101.043L0.120605 130.841Z%22 stroke=%22black%22/%3E%3Cpath d=%22M213.479 112.176L237.584 114.469L237.258 0.841309L202.078 19.8338V72.8816L213.479 78.1209V112.176Z%22 stroke=%22black%22/%3E%3Cpath d=%22M240.841 0.841309L276.347 20.1612V117.743L260.711 115.778V26.3829L240.841 15.9043V0.841309Z%22 stroke=%22black%22/%3E%3Cpath d=%22M284.816 118.725L386.121 127.239L304.36 109.884V74.1914L284.816 63.7128V118.725Z%22 stroke=%22black%22/%3E%3Cpath d=%22M25.1206 333.987H31.6206V306.987H25.1206V333.987Z%22 fill=%22black%22/%3E%3Cpath d=%22M92.6206 333.987H100.121L110.621 307.487H104.621L96.6206 325.987L88.6206 307.487H81.6206L92.6206 333.987Z%22 fill=%22black%22/%3E%3Cpath d=%22M44.6206 333.987H51.6206V318.987L65.1206 333.987H71.6206V307.487H65.1206V322.987L50.6206 307.487H44.6206V333.987Z%22 fill=%22black%22/%3E%3Cpath d=%22M120.621 333.987H142.121V329.487H127.621V322.987H140.121V318.487H127.621V312.487H142.121V307.487H120.621V333.987Z%22 fill=%22black%22/%3E%3Cpath d=%22M152.121 331.987L153.621 327.987C165.659 329.418 167.304 330.676 168.121 326.487C168.937 322.297 152.785 322.989 152.621 313.987C152.456 304.984 165.853 306.198 174.121 308.487L173.121 312.487C162.364 310.724 159.121 310.487 159.121 313.987C159.121 317.487 175.621 318.748 175.621 326.487C175.621 334.225 167.278 335.691 152.121 331.987Z%22 fill=%22black%22/%3E%3Cpath d=%22M192.621 333.987H199.621V312.487H208.621V307.487H183.621V312.487H192.621V333.987Z%22 fill=%22black%22/%3E%3Cpath d=%22M219.121 333.987H225.121V318.987L233.621 329.987H237.621L245.121 318.987V333.987L252.121 333.987V307.487H245.121L235.621 322.487L225.121 307.487H219.121V333.987Z%22 fill=%22black%22/%3E%3Cpath d=%22M265.121 333.987H286.621V329.487H272.121V322.987H284.621V318.487H272.121V312.487H286.621V307.487H265.121V333.987Z%22 fill=%22black%22/%3E%3Cpath d=%22M298.621 333.987H305.621V318.987L319.121 333.987H325.621V307.487H319.121V322.987L304.621 307.487H298.621V333.987Z%22 fill=%22black%22/%3E%3Cpath d=%22M345.121 333.987H352.121V312.487H361.121V307.487H336.121V312.487H345.121V333.987Z%22 fill=%22black%22/%3E%3Cpath d=%22M25.1206 333.987H31.6206V306.987H25.1206V333.987Z%22 stroke=%22black%22/%3E%3Cpath d=%22M92.6206 333.987H100.121L110.621 307.487H104.621L96.6206 325.987L88.6206 307.487H81.6206L92.6206 333.987Z%22 stroke=%22black%22/%3E%3Cpath d=%22M44.6206 333.987H51.6206V318.987L65.1206 333.987H71.6206V307.487H65.1206V322.987L50.6206 307.487H44.6206V333.987Z%22 stroke=%22black%22/%3E%3Cpath d=%22M120.621 333.987H142.121V329.487H127.621V322.987H140.121V318.487H127.621V312.487H142.121V307.487H120.621V333.987Z%22 stroke=%22black%22/%3E%3Cpath d=%22M152.121 331.987L153.621 327.987C165.659 329.418 167.304 330.676 168.121 326.487C168.937 322.297 152.785 322.989 152.621 313.987C152.456 304.984 165.853 306.198 174.121 308.487L173.121 312.487C162.364 310.724 159.121 310.487 159.121 313.987C159.121 317.487 175.621 318.748 175.621 326.487C175.621 334.225 167.278 335.691 152.121 331.987Z%22 stroke=%22black%22/%3E%3Cpath d=%22M192.621 333.987H199.621V312.487H208.621V307.487H183.621V312.487H192.621V333.987Z%22 stroke=%22black%22/%3E%3Cpath d=%22M219.121 333.987H225.121V318.987L233.621 329.987H237.621L245.121 318.987V333.987L252.121 333.987V307.487H245.121L235.621 322.487L225.121 307.487H219.121V333.987Z%22 stroke=%22black%22/%3E%3Cpath d=%22M265.121 333.987H286.621V329.487H272.121V322.987H284.621V318.487H272.121V312.487H286.621V307.487H265.121V333.987Z%22 stroke=%22black%22/%3E%3Cpath d=%22M298.621 333.987H305.621V318.987L319.121 333.987H325.621V307.487H319.121V322.987L304.621 307.487H298.621V333.987Z%22 stroke=%22black%22/%3E%3Cpath d=%22M345.121 333.987H352.121V312.487H361.121V307.487H336.121V312.487H345.121V333.987Z%22 stroke=%22black%22/%3E%3Cpath d=%22M232.621 276.02L166.121 145.841H204.905L255.905 246.341L306.905 145.841H345.905L279.405 276.02H232.621Z%22 fill=%22black%22 stroke=%22black%22/%3E%3Cpath d=%22M41.1206 276.02H208.336L195.73 251.341H74.8362V220.341H179.894L168.144 197.341H74.8362V170.841L154.352 170.341L141.836 145.841H41.1206V276.02Z%22 fill=%22black%22 stroke=%22black%22/%3E%3C/svg%3E";

const LOGO_BG: &str = "oklch(0.256 0.1 260)";

#[component]
pub fn Logo(#[props(default)] class: String, #[props(default)] with_background: bool, src: Option<String>) -> Element {
	let mask_url = format!("url(\"{}\")", src.as_deref().unwrap_or(LOGO_DATA_URI));
	let mask_style = format!(
		"background-color:currentColor;mask-image:{u};-webkit-mask-image:{u};mask-repeat:no-repeat;-webkit-mask-repeat:no-repeat;mask-position:center;-webkit-mask-position:center;mask-size:contain;-webkit-mask-size:contain",
		u = mask_url
	);
	let mark = rsx! {
		span {
			"data-slot": "logo",
			role: "img",
			aria_label: "EV Investment",
			style: mask_style,
			class: cn!("inline-block", if with_background { "w-3/5 h-3/5".to_string() } else { class.clone() }),
		}
	};

	if !with_background {
		return mark;
	}

	rsx! {
		span {
			"data-slot": "logo-background",
			class: cn!("inline-flex items-center justify-center", class),
			style: format!("background-color:{LOGO_BG}"),
			{mark}
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	#[test]
	fn mask_is_self_contained_and_follows_current_color() {
		fn app() -> Element {
			rsx! {
				Logo { class: "w-10 h-10 text-white" }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"logo\""), "{html}");
		assert!(html.contains("background-color:currentColor"), "{html}");
		assert!(html.contains("data:image/svg+xml"), "{html}");
		assert!(html.contains("w-10"), "{html}");
		assert!(!html.contains("logo-background"), "{html}");
	}

	#[test]
	fn with_background_paints_the_brand_field() {
		fn app() -> Element {
			rsx! {
				Logo { class: "w-16 h-16 rounded-md", with_background: true }
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"logo-background\""), "{html}");
		assert!(html.contains("oklch(0.256 0.1 260)"), "{html}");
		assert!(html.contains("w-3/5 h-3/5"), "the mark scales inside the field: {html}");
		assert!(html.contains("w-16"), "caller class lands on the wrapper: {html}");
	}

	#[test]
	fn src_overrides_the_data_uri() {
		fn app() -> Element {
			rsx! {
				Logo { src: "/assets/logo.svg" }
			}
		}
		let html = render(app);
		assert!(html.contains("/assets/logo.svg"), "{html}");
		assert!(!html.contains("data:image/svg+xml"), "{html}");
	}
}
