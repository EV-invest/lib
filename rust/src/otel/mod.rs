//! `otel` — OpenTelemetry logs + traces over OTLP (native backends only).
//!
//! One seam beside [`error_monitoring`](crate::error_monitoring): [`telemetry`]
//! builds two `tracing` layers (a logs appender and a spans bridge) plus a guard
//! that flushes/shuts down both providers on drop. Enabled iff
//! `OTEL_EXPORTER_OTLP_ENDPOINT` is set — absent, [`telemetry`] returns `None` and
//! the caller's `.with(None)` is inert (stdout JSON logging is unchanged).
//!
//! gRPC trace propagation ([`inject_trace_context`]/[`extract_trace_context`]) are
//! tonic interceptors carrying the W3C `traceparent` so one `trace_id` spans a
//! whole money flow (cabinet-backend → piggybank → signer).
//!
//! Native-only: the `sentry`-style wasm split doesn't apply — the browser never
//! links an OTLP/gRPC stack.

#[cfg(not(target_arch = "wasm32"))]
mod native;
#[cfg(not(target_arch = "wasm32"))]
pub use native::*;
