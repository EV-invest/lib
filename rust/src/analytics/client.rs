//! Native (non-wasm) PostHog capture client — an async `reqwest` POST to
//! `/capture/`, for backend (Axum) services. Disabled (a silent no-op) when no
//! API key is configured, mirroring the TS `ensure()`/no-op-without-key behavior.

use crate::analytics::event::{DEFAULT_HOST, Event, capture_body};

/// An async PostHog capture client. Construct once and share it (it holds a
/// pooled `reqwest::Client`); a `None` key makes every `capture` a no-op so the
/// same code runs in environments where analytics is unconfigured.
#[derive(Clone)]
pub struct Analytics {
	client: reqwest::Client,
	host: String,
	api_key: Option<String>,
}

impl Analytics {
	/// Builds a client from an optional API key and host (defaulting to
	/// [`DEFAULT_HOST`]). Read these from the environment in the consuming app.
	pub fn new(api_key: Option<String>, host: Option<String>) -> Self {
		Self {
			client: reqwest::Client::new(),
			host: host.unwrap_or_else(|| DEFAULT_HOST.to_string()),
			api_key,
		}
	}

	/// Whether a key is configured; when `false`, [`Analytics::capture`] no-ops.
	pub fn is_enabled(&self) -> bool {
		self.api_key.is_some()
	}

	/// Captures one event for `distinct_id`. No-ops (returning `Ok`) when no key is
	/// configured. Network and serialization failures surface as `reqwest::Error`.
	///
	/// Properties must be primitive and free of PII (see [`Event`]).
	pub async fn capture(&self, distinct_id: &str, event: &Event) -> reqwest::Result<()> {
		let Some(key) = self.api_key.as_deref() else {
			return Ok(());
		};
		let body = capture_body(key, distinct_id, event);
		let url = format!("{}/capture/", self.host.trim_end_matches('/'));
		self.client.post(url).json(&body).send().await?.error_for_status()?;
		Ok(())
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn disabled_without_key() {
		assert!(!Analytics::new(None, None).is_enabled());
		assert!(Analytics::new(Some("phc_x".to_string()), None).is_enabled());
	}

	#[tokio::test]
	async fn capture_is_noop_when_disabled() {
		// No key → no network call, returns Ok.
		let analytics = Analytics::new(None, Some("http://127.0.0.1:1/".to_string()));
		assert!(analytics.capture("anon", &Event::new("noop_event")).await.is_ok());
	}
}
