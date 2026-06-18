//! Dioxus bindings — `AnalyticsProvider` + `use_analytics`, mirroring the TS
//! `PostHogProvider` / `useCapture`. The component is renderer-agnostic (so it
//! renders under `dioxus-ssr` for tests); the actual capture POST is pure-Rust
//! `reqwest` fetch, fired only on `wasm32`. Capture no-ops when no key is set.

use dioxus::prelude::*;

use crate::analytics::event::{DEFAULT_HOST, Event};

/// A `Copy` handle to the analytics configuration, read from context by
/// [`use_analytics`]. Call [`AnalyticsHandle::capture`] from event handlers.
#[derive(Clone, Copy)]
pub struct AnalyticsHandle {
	config: Signal<AnalyticsConfig>,
}
impl AnalyticsHandle {
	/// Whether a key is configured; when `false`, [`AnalyticsHandle::capture`] no-ops.
	pub fn is_enabled(&self) -> bool {
		self.config.read().api_key.is_some()
	}

	/// Captures an event from the browser: builds the PostHog body and POSTs it via
	/// pure-Rust `reqwest` fetch (fire-and-forget). No-ops when no key is set or on
	/// non-wasm targets (server-side rendering). Properties must be PII-free.
	pub fn capture(&self, event: Event) {
		if !self.is_enabled() {
			return;
		}
		#[cfg(target_arch = "wasm32")]
		{
			let config = self.config.read();
			let Some(key) = config.api_key.clone() else {
				return;
			};
			let body = crate::analytics::event::capture_body(&key, &distinct_id(), &event);
			let url = format!("{}/capture/", config.host.trim_end_matches('/'));
			wasm_bindgen_futures::spawn_local(async move {
				let _ = reqwest::Client::new().post(url).json(&body).send().await;
			});
		}
		#[cfg(not(target_arch = "wasm32"))]
		let _ = event;
	}
}

/// Provides analytics configuration to descendants. Mount once near the root and
/// pass the project key/host (read them from the environment in your app). With
/// no key, captures are silent no-ops.
#[component]
pub fn AnalyticsProvider(api_key: Option<String>, host: Option<String>, children: Element) -> Element {
	let config = use_signal(|| AnalyticsConfig {
		api_key,
		host: host.unwrap_or_else(|| DEFAULT_HOST.to_string()),
	});
	use_context_provider(|| AnalyticsHandle { config });
	rsx! {
		{children}
	}
}
/// Reads the [`AnalyticsHandle`] from context. Panics if called outside an
/// [`AnalyticsProvider`].
pub fn use_analytics() -> AnalyticsHandle {
	use_context::<AnalyticsHandle>()
}
#[derive(Clone, PartialEq)]
struct AnalyticsConfig {
	api_key: Option<String>,
	host: String,
}

/// A stable, PII-free anonymous id persisted in a first-party cookie (`ev_did`),
/// minted from `js_sys::Math::random` on first use.
#[cfg(target_arch = "wasm32")]
fn distinct_id() -> String {
	use wasm_bindgen::JsCast;

	fn doc() -> Option<web_sys::HtmlDocument> {
		web_sys::window()?.document()?.dyn_into().ok()
	}
	let read = || -> Option<String> {
		let cookie = doc()?.cookie().ok()?;
		cookie.split(';').find_map(|pair| {
			let (key, value) = pair.trim().split_once('=')?;
			(key == "ev_did").then(|| value.to_string())
		})
	};
	if let Some(existing) = read() {
		return existing;
	}
	let id = format!(
		"{:08x}{:08x}",
		(js_sys::Math::random() * f64::from(u32::MAX)) as u32,
		(js_sys::Math::random() * f64::from(u32::MAX)) as u32,
	);
	if let Some(document) = doc() {
		let _ = document.set_cookie(&format!("ev_did={id}; path=/; max-age=31536000; samesite=lax"));
	}
	id
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::analytics::test_util::render;

	#[test]
	fn provider_exposes_enabled_state() {
		#[component]
		fn Probe() -> Element {
			let analytics = use_analytics();
			let label = if analytics.is_enabled() { "on" } else { "off" };
			rsx! {
				span { {label} }
			}
		}
		fn with_key() -> Element {
			rsx! {
				AnalyticsProvider { api_key: "phc_x".to_string(), Probe {} }
			}
		}
		fn without_key() -> Element {
			rsx! {
				AnalyticsProvider { Probe {} }
			}
		}
		assert!(render(with_key).contains("on"));
		assert!(render(without_key).contains("off"));
	}
}
