//! Native (non-wasm) Sentry integration for backend services (Axum) — built on
//! the `sentry` crate. Mirrors the site's backend wiring: an [`init`] guard, a
//! [`tracing_layer`] for the subscriber, the tower [`NewSentryLayer`]/
//! [`SentryHttpLayer`] for HTTP capture, and a [`report`] helper for 5xx errors.

use std::error::Error as StdError;

/// Re-exported tower layers (require the consumer's `ServiceBuilder`). Apply in
/// this order on the Axum router:
///
/// ```ignore
/// use tower::ServiceBuilder;
/// use ev::error_monitoring::{NewSentryLayer, SentryHttpLayer};
/// let svc = ServiceBuilder::new()
///     .layer(NewSentryLayer::<axum::extract::Request>::new_from_top())
///     .layer(SentryHttpLayer::new().enable_transaction());
/// ```
pub use sentry::integrations::tower::{NewSentryLayer, SentryHttpLayer};
/// The `tracing` integration layer: add it to your `tracing_subscriber` registry
/// so error/warn events become Sentry breadcrumbs and events (mirrors the site's
/// `init_tracing`).
pub use sentry::integrations::tracing::layer as tracing_layer;

/// Backend Sentry configuration. Read `dsn`/`environment` from the environment in
/// your app; `dsn` `None` disables Sentry (a silent no-op).
#[derive(Clone, Debug)]
pub struct Config {
	/// The Sentry DSN, or `None` to disable reporting.
	pub dsn: Option<String>,
	/// Deployment environment tag (e.g. `"production"`, `"staging"`).
	pub environment: String,
	/// Transaction trace sampling rate; see [`Config::traces_sample_rate_for`].
	pub traces_sample_rate: f32,
}

impl Config {
	/// The site's sampling policy: 10% in production, 100% elsewhere.
	pub fn traces_sample_rate_for(environment: &str) -> f32 {
		if environment == "production" { 0.1 } else { 1.0 }
	}
}

/// Initializes Sentry, returning the guard that must be held for the lifetime of
/// the process (bind it in `main`). Returns `None` when no DSN is configured, so
/// the caller's binding is simply inert. Mirrors the site's `sentry::init` block.
pub fn init(config: &Config) -> Option<sentry::ClientInitGuard> {
	let dsn = config.dsn.as_deref()?;
	Some(sentry::init((
		dsn,
		sentry::ClientOptions {
			release: sentry::release_name!(),
			environment: Some(config.environment.clone().into()),
			traces_sample_rate: config.traces_sample_rate,
			..Default::default()
		},
	)))
}

/// Reports an unexpected error to Sentry. Call only for genuinely unexpected
/// failures (5xx territory), mirroring the site's `error_reporter::report`.
pub fn report(error: &dyn StdError) {
	sentry::capture_error(error);
}

#[cfg(test)]
mod tests {
	use std::{
		sync::{Arc, Mutex},
		time::Duration,
	};

	use super::*;

	#[test]
	fn sample_rate_policy() {
		assert_eq!(Config::traces_sample_rate_for("production"), 0.1);
		assert_eq!(Config::traces_sample_rate_for("development"), 1.0);
		assert_eq!(Config::traces_sample_rate_for("staging"), 1.0);
		assert_eq!(Config::traces_sample_rate_for(""), 1.0);
	}

	#[test]
	fn init_is_noop_without_dsn() {
		let config = Config {
			dsn: None,
			environment: "test".to_string(),
			traces_sample_rate: 1.0,
		};
		assert!(init(&config).is_none());
	}

	#[test]
	fn init_returns_a_guard_with_a_valid_dsn() {
		let config = Config {
			dsn: Some("https://abc@example.com/1".to_string()),
			environment: "test".to_string(),
			traces_sample_rate: 1.0,
		};
		let guard = init(&config);
		assert!(guard.is_some(), "a syntactically valid DSN should yield a guard");
		// Drop the guard explicitly; it must not block on a network flush
		// (default transport with an unreachable host would, hence the short
		// shutdown — but dropping the guard here is enough for the assertion).
		drop(guard);
	}

	// In-memory transport: captures envelopes instead of POSTing them. This
	// replicates `sentry::test::TestTransport` without enabling the `test`
	// feature (which we are not allowed to add), so `report` is covered
	// deterministically with no network.
	struct CapturingTransport {
		envelopes: Arc<Mutex<Vec<sentry::Envelope>>>,
	}

	impl sentry::Transport for CapturingTransport {
		fn send_envelope(&self, envelope: sentry::Envelope) {
			self.envelopes.lock().unwrap().push(envelope);
		}
	}

	#[test]
	fn report_captures_the_error_as_an_event() {
		let captured: Arc<Mutex<Vec<sentry::Envelope>>> = Arc::new(Mutex::new(Vec::new()));
		let sink = captured.clone();

		let options = sentry::ClientOptions {
			dsn: Some("https://public@example.com/1".parse().unwrap()),
			transport: Some(Arc::new(move |_: &sentry::ClientOptions| {
				Arc::new(CapturingTransport { envelopes: sink.clone() }) as Arc<dyn sentry::Transport>
			})),
			..Default::default()
		};

		let hub = Arc::new(sentry::Hub::new(Some(Arc::new(options.into())), Arc::new(Default::default())));
		sentry::Hub::run(hub.clone(), || {
			let err = std::io::Error::other("disk on fire");
			report(&err);
		});
		hub.client().unwrap().flush(Some(Duration::from_secs(1)));

		let envelopes = captured.lock().unwrap();
		assert_eq!(envelopes.len(), 1, "report should send exactly one envelope");
		let event = envelopes[0].event().expect("the captured envelope should carry an event");
		let exception = event.exception.values.first().expect("capture_error records an exception value");
		assert!(
			exception.value.as_deref().unwrap_or_default().contains("disk on fire"),
			"the reported error message should reach Sentry, got {:?}",
			exception.value
		);
	}
}
