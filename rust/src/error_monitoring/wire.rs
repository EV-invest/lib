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
/// use ev_lib::error_monitoring::parse_dsn;
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
/// use ev_lib::error_monitoring::envelope;
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
	use serde_json::Value;

	use super::*;

	// --- parse_dsn: happy paths ---------------------------------------------

	#[test]
	fn parses_a_valid_https_dsn() {
		let dsn = parse_dsn("https://pub@o9.ingest.sentry.io/4500").unwrap();
		assert_eq!(dsn.scheme, "https");
		assert_eq!(dsn.public_key, "pub");
		assert_eq!(dsn.host, "o9.ingest.sentry.io");
		assert_eq!(dsn.project_id, "4500");
	}

	#[test]
	fn parses_an_http_self_hosted_dsn() {
		let dsn = parse_dsn("http://key@localhost/1").unwrap();
		assert_eq!(dsn.scheme, "http");
		assert_eq!(dsn.public_key, "key");
		assert_eq!(dsn.host, "localhost");
		assert_eq!(dsn.project_id, "1");
	}

	#[test]
	fn keeps_a_path_prefix_in_the_host() {
		// Self-hosted Sentry behind a path prefix: everything between the host
		// and the final `/<project_id>` is part of the host segment.
		let dsn = parse_dsn("https://k@host/prefix/42").unwrap();
		assert_eq!(dsn.host, "host/prefix");
		assert_eq!(dsn.project_id, "42");
	}

	#[test]
	fn keeps_a_deep_path_prefix_in_the_host() {
		let dsn = parse_dsn("https://k@host/a/b/c/99").unwrap();
		assert_eq!(dsn.host, "host/a/b/c");
		assert_eq!(dsn.project_id, "99");
	}

	#[test]
	fn keeps_a_port_on_the_host() {
		let dsn = parse_dsn("https://k@host:9000/3").unwrap();
		assert_eq!(dsn.host, "host:9000");
		assert_eq!(dsn.project_id, "3");
	}

	#[test]
	fn parses_keys_with_special_chars() {
		// Sentry keys are hex, but the parser must not choke on `+`/`.`/`-` etc.
		let dsn = parse_dsn("https://a1b2.c3-d4+e5@host/7").unwrap();
		assert_eq!(dsn.public_key, "a1b2.c3-d4+e5");
		assert_eq!(dsn.project_id, "7");
	}

	#[test]
	fn first_at_splits_the_key_so_at_in_host_is_kept() {
		// `split_once('@')` splits on the FIRST `@`: a userinfo-style `@` in the
		// remainder stays with the host (no realistic Sentry DSN has this, but
		// the behaviour must be deterministic).
		let dsn = parse_dsn("https://key@us@host/1").unwrap();
		assert_eq!(dsn.public_key, "key");
		assert_eq!(dsn.host, "us@host");
	}

	// --- parse_dsn: rejections ---------------------------------------------

	#[test]
	fn rejects_empty_input() {
		assert!(parse_dsn("").is_none());
	}

	#[test]
	fn rejects_missing_scheme_separator() {
		assert!(parse_dsn("not-a-dsn").is_none());
		assert!(parse_dsn("pub@host/1").is_none()); // no `://`
	}

	#[test]
	fn rejects_empty_scheme() {
		assert!(parse_dsn("://pub@host/1").is_none());
	}

	#[test]
	fn rejects_missing_key() {
		assert!(parse_dsn("https://o9.ingest.sentry.io/4500").is_none()); // no `@`
	}

	#[test]
	fn rejects_empty_key() {
		assert!(parse_dsn("https://@host/1").is_none());
	}

	#[test]
	fn rejects_missing_project_id() {
		assert!(parse_dsn("https://pub@host").is_none()); // no `/`
	}

	#[test]
	fn rejects_empty_host() {
		assert!(parse_dsn("https://pub@/1").is_none());
	}

	#[test]
	fn rejects_empty_project_id() {
		// Trailing slash leaves an empty project id segment.
		assert!(parse_dsn("https://pub@host/").is_none());
	}

	#[test]
	fn trailing_slash_after_project_id_is_treated_as_part_of_id() {
		// `rsplit_once('/')` on `host/7/` splits at the last slash, yielding
		// host `host/7` and an empty project id → rejected (no silent mis-parse
		// that would build a `//envelope/` URL).
		assert!(parse_dsn("https://pub@host/7/").is_none());
	}

	#[test]
	fn query_string_stays_with_the_project_id() {
		// A query string is not stripped; it rides along in `project_id`. This
		// documents current behaviour — official DSNs never carry one.
		let dsn = parse_dsn("https://k@host/7?x=1").unwrap();
		assert_eq!(dsn.project_id, "7?x=1");
	}

	// --- ingest_url --------------------------------------------------------

	#[test]
	fn ingest_url_https() {
		let dsn = parse_dsn("https://pub@host/7").unwrap();
		assert_eq!(ingest_url(&dsn), "https://host/api/7/envelope/");
	}

	#[test]
	fn ingest_url_http() {
		let dsn = parse_dsn("http://pub@localhost/1").unwrap();
		assert_eq!(ingest_url(&dsn), "http://localhost/api/1/envelope/");
	}

	#[test]
	fn ingest_url_path_prefixed_has_no_double_slashes() {
		let dsn = parse_dsn("https://k@host/prefix/42").unwrap();
		let url = ingest_url(&dsn);
		assert_eq!(url, "https://host/prefix/api/42/envelope/");
		// No accidental `//` anywhere after the scheme separator.
		assert!(!url.trim_start_matches("https://").contains("//"));
	}

	#[test]
	fn ingest_url_with_port() {
		let dsn = parse_dsn("https://k@host:9000/3").unwrap();
		assert_eq!(ingest_url(&dsn), "https://host:9000/api/3/envelope/");
	}

	// --- auth_header -------------------------------------------------------

	#[test]
	fn auth_header_contains_version_key_and_client() {
		let dsn = parse_dsn("https://pub@host/7").unwrap();
		let auth = auth_header(&dsn);
		assert!(auth.starts_with("Sentry "));
		assert!(auth.contains("sentry_version=7"));
		assert!(auth.contains("sentry_key=pub"));
		assert!(auth.contains("sentry_client=ev-error-monitoring/0.1"));
	}

	// --- envelope ----------------------------------------------------------

	#[test]
	fn envelope_has_exactly_three_lines() {
		let body = envelope("staging", "deadbeefdeadbeefdeadbeefdeadbeef", "kaboom");
		assert_eq!(body.split('\n').count(), 3);
	}

	#[test]
	fn each_envelope_line_is_independently_valid_json() {
		let body = envelope("production", "0123456789abcdef0123456789abcdef", "boom");
		for line in body.split('\n') {
			serde_json::from_str::<Value>(line).unwrap_or_else(|e| panic!("line is not valid JSON: {line:?}: {e}"));
		}
	}

	#[test]
	fn envelope_header_carries_the_event_id() {
		let body = envelope("staging", "feedfacefeedfacefeedfacefeedface", "x");
		let header: Value = serde_json::from_str(body.split('\n').next().unwrap()).unwrap();
		assert_eq!(header["event_id"], "feedfacefeedfacefeedfacefeedface");
	}

	#[test]
	fn envelope_item_header_marks_an_event() {
		let body = envelope("staging", "feedfacefeedfacefeedfacefeedface", "x");
		let item_header: Value = serde_json::from_str(body.split('\n').nth(1).unwrap()).unwrap();
		assert_eq!(item_header["type"], "event");
	}

	#[test]
	fn envelope_payload_has_all_event_fields() {
		let id = "0123456789abcdef0123456789abcdef";
		let body = envelope("staging", id, "kaboom");
		let payload: Value = serde_json::from_str(body.split('\n').nth(2).unwrap()).unwrap();

		// event_id is consistent between header and payload (relays cross-check).
		assert_eq!(payload["event_id"], id);
		assert_eq!(payload["level"], "error");
		assert_eq!(payload["platform"], "other");
		assert_eq!(payload["environment"], "staging");
		assert_eq!(payload["exception"]["values"][0]["type"], "Error");
		assert_eq!(payload["exception"]["values"][0]["value"], "kaboom");
	}

	#[test]
	fn event_id_matches_in_header_and_payload() {
		let id = "abcdefabcdefabcdefabcdefabcdef00";
		let body = envelope("dev", id, "x");
		let header: Value = serde_json::from_str(body.split('\n').next().unwrap()).unwrap();
		let payload: Value = serde_json::from_str(body.split('\n').nth(2).unwrap()).unwrap();
		assert_eq!(header["event_id"], payload["event_id"]);
	}

	#[test]
	fn message_with_quotes_newlines_and_unicode_round_trips() {
		let nasty = "he said \"boom\"\nline two\tTAB — café 🚀 \\backslash";
		let body = envelope("prod", "0000000000000000000000000000abcd", nasty);
		// The payload is the third newline-delimited line; the escaped newline in
		// the message must NOT have split the JSON across lines.
		let lines: Vec<&str> = body.split('\n').collect();
		assert_eq!(lines.len(), 3);
		let payload: Value = serde_json::from_str(lines[2]).unwrap();
		assert_eq!(payload["exception"]["values"][0]["value"], nasty);
	}

	#[test]
	fn empty_message_is_valid() {
		let body = envelope("dev", "0000000000000000000000000000abcd", "");
		let payload: Value = serde_json::from_str(body.split('\n').nth(2).unwrap()).unwrap();
		assert_eq!(payload["exception"]["values"][0]["value"], "");
	}
}
