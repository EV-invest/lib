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
	use std::time::Duration;

	use tokio::{
		io::{AsyncReadExt, AsyncWriteExt},
		net::{TcpListener, TcpStream},
	};

	use super::*;

	#[test]
	fn disabled_without_key() {
		assert!(!Analytics::new(None, None).is_enabled());
		assert!(Analytics::new(Some("phc_x".to_string()), None).is_enabled());
	}

	#[test]
	fn default_host_used_when_none() {
		assert_eq!(Analytics::new(Some("k".into()), None).host, DEFAULT_HOST);
	}

	#[tokio::test]
	async fn capture_is_noop_when_disabled() {
		// No key → no network call, returns Ok.
		let analytics = Analytics::new(None, Some("http://127.0.0.1:1/".to_string()));
		assert!(analytics.capture("anon", &Event::new("noop_event")).await.is_ok());
	}

	/// Reads one HTTP/1.1 request off the wire, returns `(request_line, body)`, and
	/// replies `200 OK`. Headers are consumed up to the blank line; the body is read
	/// using the request's `Content-Length` (reqwest always sets it for a JSON POST).
	async fn read_one_request_and_ok(mut stream: TcpStream) -> (String, String) {
		let mut buf = Vec::new();
		let mut chunk = [0u8; 1024];
		// Read until we have the full header block.
		let header_end = loop {
			let n = stream.read(&mut chunk).await.unwrap();
			assert!(n > 0, "connection closed before headers arrived");
			buf.extend_from_slice(&chunk[..n]);
			if let Some(pos) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
				break pos + 4;
			}
		};
		let headers = String::from_utf8(buf[..header_end].to_vec()).unwrap();
		let request_line = headers.lines().next().unwrap().to_string();
		let content_length: usize = headers
			.lines()
			.find_map(|l| l.to_ascii_lowercase().strip_prefix("content-length:").map(|v| v.trim().to_string()))
			.and_then(|v| v.parse().ok())
			.unwrap_or(0);
		// Read the rest of the body if it has not all arrived yet.
		let mut body = buf[header_end..].to_vec();
		while body.len() < content_length {
			let n = stream.read(&mut chunk).await.unwrap();
			if n == 0 {
				break;
			}
			body.extend_from_slice(&chunk[..n]);
		}
		stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n").await.unwrap();
		stream.flush().await.unwrap();
		(request_line, String::from_utf8(body).unwrap())
	}

	#[tokio::test]
	async fn capture_posts_to_capture_path_with_posthog_body() {
		let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
		let addr = listener.local_addr().unwrap();
		let analytics = Analytics::new(Some("phc_live".to_string()), Some(format!("http://{addr}")));
		let event = Event::new("server_event_fired").prop("ok", true);

		// Structured concurrency: drive the mock server and the client together with
		// `join!` (no detached task) and bound the whole exchange with a timeout.
		let server = async {
			let (stream, _) = listener.accept().await.unwrap();
			read_one_request_and_ok(stream).await
		};
		let client = async { analytics.capture("anon-1", &event).await };
		let ((request_line, body), result) = tokio::time::timeout(Duration::from_secs(5), async { tokio::join!(server, client) })
			.await
			.expect("mock exchange timed out");
		result.expect("capture should succeed against the mock server");

		assert!(request_line.starts_with("POST /capture/ "), "unexpected request line: {request_line}");
		let json: serde_json::Value = serde_json::from_str(&body).unwrap();
		assert_eq!(json["api_key"], "phc_live");
		assert_eq!(json["event"], "server_event_fired");
		assert_eq!(json["distinct_id"], "anon-1");
		assert_eq!(json["properties"]["ok"], true);
		assert_eq!(json["properties"]["$lib"], "ev-analytics");
	}

	#[tokio::test]
	async fn capture_trims_trailing_slash_from_host() {
		// A host with a trailing slash must not yield `//capture/`. The mock asserts
		// the request target is exactly `/capture/`.
		let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
		let addr = listener.local_addr().unwrap();
		let analytics = Analytics::new(Some("phc_live".to_string()), Some(format!("http://{addr}/")));

		let server = async {
			let (stream, _) = listener.accept().await.unwrap();
			read_one_request_and_ok(stream).await
		};
		let client = async { analytics.capture("d", &Event::new("e")).await };
		let ((request_line, _body), result) = tokio::time::timeout(Duration::from_secs(5), async { tokio::join!(server, client) })
			.await
			.expect("mock exchange timed out");
		result.expect("capture should succeed");
		assert!(request_line.starts_with("POST /capture/ "), "unexpected request line: {request_line}");
	}

	#[test]
	fn url_construction_trims_trailing_slash() {
		// Pure string-level guard mirroring the live tests, so the trailing-slash
		// contract is covered even if the network tests are skipped.
		let with_slash = format!("{}/capture/", "http://h/".trim_end_matches('/'));
		let without_slash = format!("{}/capture/", "http://h".trim_end_matches('/'));
		assert_eq!(with_slash, "http://h/capture/");
		assert_eq!(without_slash, "http://h/capture/");
	}

	#[tokio::test]
	async fn capture_surfaces_http_error_status() {
		// A non-2xx response must become an `Err` via `error_for_status()`.
		let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
		let addr = listener.local_addr().unwrap();
		let analytics = Analytics::new(Some("phc_bad".to_string()), Some(format!("http://{addr}")));

		let server = async {
			let (mut stream, _) = listener.accept().await.unwrap();
			let mut chunk = [0u8; 1024];
			// Drain a little so the client finishes sending before we reply.
			let _ = stream.read(&mut chunk).await;
			let _ = stream.write_all(b"HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\n\r\n").await;
			let _ = stream.flush().await;
		};
		let client = async { analytics.capture("d", &Event::new("e")).await };
		let (_, result) = tokio::time::timeout(Duration::from_secs(5), async { tokio::join!(server, client) })
			.await
			.expect("mock exchange timed out");
		assert!(result.is_err(), "a 401 response must surface as Err");
	}
}
