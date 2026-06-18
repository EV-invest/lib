//! Browser (wasm) Sentry transport — pure Rust, no JS SDK. [`init`] stores the
//! DSN and installs a `std::panic` hook; [`report_error`] builds a Sentry
//! envelope (see [`wire`](crate::error_monitoring::wire)) and POSTs it via
//! `reqwest` fetch. Delivery on panic is best-effort (`panic = abort` tears the
//! task down), the same trade-off the JS SDK panic hook makes.

use std::sync::OnceLock;

use crate::error_monitoring::wire::{auth_header, envelope, ingest_url, parse_dsn};

/// Initializes browser error monitoring: stores the DSN/environment and installs
/// a panic hook that reports each panic. Call once on the app's first render
/// (Dioxus installs its own hook after `main`, so init from a `use_hook`). A
/// `None`/empty DSN disables reporting.
pub fn init(dsn: Option<&str>, environment: &str) {
	let config = dsn.filter(|value| !value.is_empty()).map(|value| BrowserConfig {
		dsn: value.to_string(),
		environment: environment.to_string(),
	});
	let _ = CONFIG.set(config);
	install_panic_hook();
}
/// Reports an error message to Sentry as an envelope POST (fire-and-forget).
/// No-ops when no DSN was configured or the DSN is malformed.
pub fn report_error(message: &str) {
	let Some(Some(config)) = CONFIG.get() else {
		return;
	};
	let Some(dsn) = parse_dsn(&config.dsn) else {
		return;
	};
	let url = ingest_url(&dsn);
	let auth = auth_header(&dsn);
	let body = envelope(&config.environment, &new_event_id(), message);
	wasm_bindgen_futures::spawn_local(async move {
		let _ = reqwest::Client::new()
			.post(url)
			.header("X-Sentry-Auth", auth)
			.header("Content-Type", "application/x-sentry-envelope")
			.body(body)
			.send()
			.await;
	});
}
struct BrowserConfig {
	dsn: String,
	environment: String,
}

static CONFIG: OnceLock<Option<BrowserConfig>> = OnceLock::new();

fn install_panic_hook() {
	use std::sync::Once;
	static HOOK: Once = Once::new();
	HOOK.call_once(|| {
		let previous = std::panic::take_hook();
		std::panic::set_hook(Box::new(move |info| {
			report_error(&info.to_string());
			previous(info);
		}));
	});
}

/// A 32-char hex event id (UUID-shaped, no dashes), minted from
/// `js_sys::Math::random`.
fn new_event_id() -> String {
	fn chunk() -> u32 {
		(js_sys::Math::random() * f64::from(u32::MAX)) as u32
	}
	format!("{:08x}{:08x}{:08x}{:08x}", chunk(), chunk(), chunk(), chunk())
}
