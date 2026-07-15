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
	let next = AnalyticsConfig {
		api_key,
		host: host.unwrap_or_else(|| DEFAULT_HOST.to_string()),
	};
	let seed = next.clone();
	// Dioxus context is immutable once provided, so the provider provides a handle
	// and keeps its config tracking prop updates (the `use_controllable` idiom) —
	// the mirror of the TS provider resolving key/host every render, so a key that
	// arrives after mount enables capture instead of leaving it a permanent no-op.
	let mut config = use_context_provider(move || AnalyticsHandle { config: Signal::new(seed) }).config;
	if *config.peek() != next {
		config.set(next);
	}
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
	use std::cell::RefCell;

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

	#[test]
	fn provider_tracks_prop_updates() {
		// A key (or host) arriving after mount — the "fetch config, then pass it
		// down" pattern — must enable capture, not stay frozen at the mount-time
		// props. Mirrors the TS provider re-resolving key/host every render.
		#[component]
		fn Probe() -> Element {
			let analytics = use_analytics();
			let label = if analytics.is_enabled() { "on" } else { "off" };
			let host = analytics.config.read().host.clone();
			rsx! {
				span { {label} }
				span { {host} }
			}
		}
		#[derive(Clone, Default, PartialEq)]
		struct Props {
			api_key: Option<String>,
			host: Option<String>,
		}
		thread_local! {
			static PROPS: RefCell<Option<Signal<Props>>> = const { RefCell::new(None) };
		}
		fn app() -> Element {
			// Both props arrive after mount, as from an async config fetch.
			let props = use_signal(Props::default);
			use_hook(|| PROPS.with(|slot| *slot.borrow_mut() = Some(props)));
			let Props { api_key, host } = props();
			rsx! {
				AnalyticsProvider { api_key, host, Probe {} }
			}
		}
		// Each render_immediate flushes the scopes the write dirtied — a few passes
		// reach quiescence with no timing dependence (no async executor needed).
		fn settle(dom: &mut VirtualDom) {
			for _ in 0..8 {
				dom.render_immediate(&mut dioxus::core::NoOpMutations);
			}
		}
		let mut dom = VirtualDom::new(app);
		dom.rebuild_in_place();
		let before = dioxus_ssr::render(&dom);
		assert!(before.contains("off"), "{before}");
		assert!(before.contains(DEFAULT_HOST), "{before}");

		let mut props = PROPS.with(|slot| slot.borrow().expect("app captured its props signal"));
		dom.in_runtime(|| {
			props.set(Props {
				api_key: Some("phc_late".to_string()),
				host: Some("https://eu.i.posthog.com".to_string()),
			});
		});
		settle(&mut dom);
		let after = dioxus_ssr::render(&dom);
		assert!(after.contains("on"), "late key enables capture: {after}");
		assert!(after.contains("https://eu.i.posthog.com"), "late host is picked up: {after}");
	}

	#[test]
	fn provider_renders_children_unchanged() {
		fn app() -> Element {
			rsx! {
				AnalyticsProvider { api_key: "phc_x".to_string(),
					div { "child-content" }
				}
			}
		}
		assert!(render(app).contains("child-content"));
	}

	#[test]
	fn host_defaults_when_unset() {
		// The provider stores the default host when none is passed; the explicit host
		// is kept otherwise. Read it back through the context handle's config.
		#[component]
		fn Probe() -> Element {
			let analytics = use_analytics();
			let host = analytics.config.read().host.clone();
			rsx! {
				span { {host} }
			}
		}
		fn default_host() -> Element {
			rsx! {
				AnalyticsProvider { Probe {} }
			}
		}
		fn explicit_host() -> Element {
			rsx! {
				AnalyticsProvider { host: "https://eu.i.posthog.com".to_string(), Probe {} }
			}
		}
		assert!(render(default_host).contains(DEFAULT_HOST));
		assert!(render(explicit_host).contains("https://eu.i.posthog.com"));
	}

	#[test]
	fn capture_is_noop_on_native_without_panicking() {
		// On non-wasm targets `capture` must do nothing (no network, no panic),
		// whether or not a key is set. Exercising both paths under SSR proves the
		// `#[cfg(not(target_arch = "wasm32"))]` arm is reachable and inert.
		#[component]
		fn Probe() -> Element {
			let analytics = use_analytics();
			analytics.capture(Event::new("native_noop_with_key").prop("k", 1));
			rsx! {
				span { "rendered" }
			}
		}
		#[component]
		fn ProbeNoKey() -> Element {
			let analytics = use_analytics();
			analytics.capture(Event::new("native_noop_no_key"));
			rsx! {
				span { "rendered" }
			}
		}
		fn with_key() -> Element {
			rsx! {
				AnalyticsProvider { api_key: "phc_x".to_string(), Probe {} }
			}
		}
		fn without_key() -> Element {
			rsx! {
				AnalyticsProvider { ProbeNoKey {} }
			}
		}
		assert!(render(with_key).contains("rendered"));
		assert!(render(without_key).contains("rendered"));
	}
}
