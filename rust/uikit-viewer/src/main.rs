//! Dioxus web viewer for `ev::uikit` — the mirror of `ts/uikit/example`.
//!
//! wasm-only: the gallery (and its `dioxus`/`ev` deps) compile only for
//! `wasm32`, so a native build sees just the stub `main` below and the
//! workspace's `cargo` commands keep working. Serve it with `dx serve` after
//! generating the Tailwind CSS — see `README.md`.

#[cfg(target_arch = "wasm32")]
mod viewer;

fn main() {
	#[cfg(target_arch = "wasm32")]
	viewer::run();

	#[cfg(not(target_arch = "wasm32"))]
	eprintln!("uikit-viewer is a wasm app — run `dx serve` from rust/uikit-viewer (see README.md).",);
}
