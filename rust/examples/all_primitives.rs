//! Serves the source-of-truth component board as a *live*, interactive page —
//! every primitive, every variant, wired through dioxus-liveview so the
//! components actually respond to clicks/typing (no wasm build: the VDOM runs
//! native and patches the browser over a websocket).
//!
//!   cargo run --example all_primitives --features uikit
//!   → http://127.0.0.1:52414
//!
//! The shared board definition lives in the gallery file, reused verbatim by
//! the visual-regression test. `write_dist()` still emits the static dist the
//! Playwright pass screenshots.

include!("../tests/support/gallery.rs");

use axum::{Router, extract::ws::WebSocketUpgrade, response::Html, routing::get};
use dioxus_liveview::{LiveViewPool, axum_socket, interpreter_glue};

const PORT: u16 = 52414;

#[tokio::main]
async fn main() {
	write_dist(); // keep the static board fresh for the visual-regression pass

	let pool = LiveViewPool::new();
	let index = Html(format!(
		"{}\n<body class=\"min-h-screen p-8\">\n<div id=\"main\"></div>\n{}\n</body></html>",
		head("EV UIKit — Components"),
		interpreter_glue("/ws"),
	));

	let router = Router::new().route("/", get(move || async move { index.clone() })).route(
		"/ws",
		get(move |ws: WebSocketUpgrade| async move {
			ws.on_upgrade(move |socket| async move {
				_ = pool.launch(axum_socket(socket), app).await;
			})
		}),
	);

	let addr = std::net::SocketAddr::from(([127, 0, 0, 1], PORT));
	println!("EV UIKit live on http://{addr}");
	let listener = tokio::net::TcpListener::bind(addr).await.expect("bind port");
	axum::serve(listener, router.into_make_service()).await.expect("serve");
}
/// The whole board as one live component: each cell hosts a real, interactive
/// instance of the primitive (mirrors `cell()`/`board()` markup from gallery.rs).
fn app() -> Element {
	rsx! {
		h1 { class: "mb-6 text-2xl font-semibold", "EV UIKit — Component Library" }
		div { class: "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3",
			for (name, render) in GALLERY.iter().copied() {
				section { class: "stage flex flex-col gap-3 rounded-lg border border-border bg-card/30 p-5",
					h3 { class: "text-xs font-medium uppercase tracking-wide text-muted-foreground", "{name}" }
					div { class: "flex flex-1 flex-wrap items-center gap-3", {render()} }
				}
			}
		}
	}
}
