//! Generates the source-of-truth component board into `tests/visual/dist/`.
//!
//!   cargo run --example all_primitives --features uikit
//!
//! Then open `tests/visual/dist/index.html` — every primitive, every variant,
//! exactly as the lib renders it. The shared definition lives in the gallery
//! file, reused verbatim by the visual-regression test.

include!("../tests/support/gallery.rs");

fn main() {
	write_dist();
	println!("wrote {} primitives to {DIST}/index.html", GALLERY.len());
}
