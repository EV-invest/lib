//! DSN parsing and the Sentry envelope builder — the framework-agnostic,
//! I/O-free, `wasm32`-safe core. The browser transport POSTs the [`envelope`] to
//! the [`ingest_url`] with the [`auth_header`]; this logic is pure so it is
//! unit-tested without a network.

use serde_json::json;

/// A parsed Sentry DSN: `<scheme>://<public_key>@<host>/<project_id>`. The public
/// key is the only credential and is safe to ship in a browser bundle (same trust
/// model as the official JS SDK).
#[derive(Clone, Debug, PartialEq)]
pub struct Dsn {
	/// `https` or `http` (self-hosted).
	pub scheme: String,
	/// The DSN public key, sent in the auth header.
	pub public_key: String,
	/// Host (and any path prefix) the events are ingested at.
	pub host: String,
	/// Numeric project id.
	pub project_id: String,
}

/// Parses a Sentry DSN, returning `None` when it is empty or malformed.
///
/// ```
/// use ev::error_monitoring::parse_dsn;
/// let dsn = parse_dsn("https://abc123@o1.ingest.sentry.io/42").unwrap();
/// assert_eq!(dsn.public_key, "abc123");
/// assert_eq!(dsn.host, "o1.ingest.sentry.io");
/// assert_eq!(dsn.project_id, "42");
/// assert!(parse_dsn("not-a-dsn").is_none());
/// ```
pub fn parse_dsn(dsn: &str) -> Option<Dsn> {
	let (scheme, rest) = dsn.split_once("://")?;
	let (public_key, rest) = rest.split_once('@')?;
	let (host, project_id) = rest.rsplit_once('/')?;
	if scheme.is_empty() || public_key.is_empty() || host.is_empty() || project_id.is_empty() {
		return None;
	}
	Some(Dsn {
		scheme: scheme.to_string(),
		public_key: public_key.to_string(),
		host: host.to_string(),
		project_id: project_id.to_string(),
	})
}

/// The envelope ingest URL for a DSN: `<scheme>://<host>/api/<project_id>/envelope/`.
pub fn ingest_url(dsn: &Dsn) -> String {
	format!("{}://{}/api/{}/envelope/", dsn.scheme, dsn.host, dsn.project_id)
}

/// The `X-Sentry-Auth` header value authenticating an ingest request with the
/// DSN's public key (`sentry_version=7`).
pub fn auth_header(dsn: &Dsn) -> String {
	format!("Sentry sentry_version=7, sentry_key={}, sentry_client=ev-error-monitoring/0.1", dsn.public_key)
}

/// Builds a newline-delimited Sentry envelope carrying one error event: an
/// envelope header, an item header, and the event payload. `event_id` is a
/// 32-char hex id (no dashes); the browser transport mints one per report.
///
/// ```
/// use ev::error_monitoring::envelope;
/// let body = envelope("production", "0123456789abcdef0123456789abcdef", "boom");
/// let lines: Vec<&str> = body.split('\n').collect();
/// assert_eq!(lines.len(), 3);
/// assert!(lines[1].contains("\"type\":\"event\""));
/// assert!(lines[2].contains("boom"));
/// ```
pub fn envelope(environment: &str, event_id: &str, message: &str) -> String {
	let header = json!({ "event_id": event_id });
	let item_header = json!({ "type": "event" });
	let event = json!({
		"event_id": event_id,
		"level": "error",
		"platform": "other",
		"environment": environment,
		"exception": { "values": [ { "type": "Error", "value": message } ] },
	});
	format!("{header}\n{item_header}\n{event}")
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn parses_a_valid_dsn() {
		let dsn = parse_dsn("https://pub@o9.ingest.sentry.io/4500").unwrap();
		assert_eq!(dsn.scheme, "https");
		assert_eq!(dsn.public_key, "pub");
		assert_eq!(dsn.host, "o9.ingest.sentry.io");
		assert_eq!(dsn.project_id, "4500");
	}

	#[test]
	fn rejects_malformed_dsns() {
		assert!(parse_dsn("").is_none());
		assert!(parse_dsn("https://o9.ingest.sentry.io/4500").is_none()); // no key
		assert!(parse_dsn("https://pub@host").is_none()); // no project id
	}

	#[test]
	fn builds_ingest_url_and_auth() {
		let dsn = parse_dsn("https://pub@host/7").unwrap();
		assert_eq!(ingest_url(&dsn), "https://host/api/7/envelope/");
		let auth = auth_header(&dsn);
		assert!(auth.contains("sentry_version=7"));
		assert!(auth.contains("sentry_key=pub"));
	}

	#[test]
	fn envelope_has_three_lines_and_payload() {
		let body = envelope("staging", "deadbeefdeadbeefdeadbeefdeadbeef", "kaboom");
		let lines: Vec<&str> = body.split('\n').collect();
		assert_eq!(lines.len(), 3);
		assert!(lines[0].contains("event_id"));
		assert!(lines[1].contains("\"type\":\"event\""));
		assert!(lines[2].contains("\"level\":\"error\""));
		assert!(lines[2].contains("staging"));
		assert!(lines[2].contains("kaboom"));
	}
}
