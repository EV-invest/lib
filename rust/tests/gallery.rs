//! Integration test exercising the uikit from outside the crate: renders every
//! primitive (all variants) to HTML via dioxus-ssr, asserts none renders empty,
//! and writes the gallery into `tests/visual/dist/` for the Playwright visual
//! pass. The board definition is shared with `examples/all_primitives.rs`.
#![cfg(feature = "uikit")]

include!("support/gallery.rs");

#[test]
fn renders_every_primitive() {
	// `write_dist` asserts each fragment is non-empty as it goes, then emits the
	// standalone pages, manifest, and combined board the screenshot step reads.
	write_dist();
	assert!(std::path::Path::new(DIST).join("index.html").exists());
	assert!(std::path::Path::new(DIST).join("manifest.json").exists());
}
