use dioxus::prelude::*;

/// Self-hosted brand webfonts (Inter + Playfair Display), the families named by
/// the `--font-sans` / `--font-serif` token chains in `tokens.css`. Render once
/// near the app root: it injects the `@font-face` rules over the bundled variable
/// TTFs (collected into the consumer's `dx` asset bundle via `asset!`), so a
/// Dioxus consumer gets the right typography out of the gate — no CDN, no
/// per-project staging, identical offline / behind a CSP.
///
/// The Next.js landing supplies the same families through `next/font`; this is the
/// Rust-side equivalent. Variable fonts, so one face per style spans the axis.
#[component]
pub fn Fonts() -> Element {
	rsx! {
		document::Style { {format!(
			"@font-face{{font-family:'Inter';font-style:normal;font-weight:100 900;font-display:swap;src:url('{INTER}') format('truetype')}}\
			 @font-face{{font-family:'Inter';font-style:italic;font-weight:100 900;font-display:swap;src:url('{INTER_ITALIC}') format('truetype')}}\
			 @font-face{{font-family:'Playfair Display';font-style:normal;font-weight:300 900;font-display:swap;src:url('{PLAYFAIR}') format('truetype')}}\
			 @font-face{{font-family:'Playfair Display';font-style:italic;font-weight:300 900;font-display:swap;src:url('{PLAYFAIR_ITALIC}') format('truetype')}}",
			INTER = asset!("/src/uikit/fonts/Inter.ttf"),
			INTER_ITALIC = asset!("/src/uikit/fonts/Inter-Italic.ttf"),
			PLAYFAIR = asset!("/src/uikit/fonts/PlayfairDisplay.ttf"),
			PLAYFAIR_ITALIC = asset!("/src/uikit/fonts/PlayfairDisplay-Italic.ttf"),
		)} }
	}
}
