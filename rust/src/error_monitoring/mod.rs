//! `error_monitoring` — Sentry error monitoring (mirrors `@evinvest/error-monitoring`).
//!
//! Two transports, split by target:
//! - **native** (Axum and other servers) — the `sentry` crate: [`init`] guard,
//!   [`tracing_layer`], the tower [`NewSentryLayer`]/[`SentryHttpLayer`], and
//!   [`report`]. The `sentry` crate is native-only and never linked into wasm.
//! - **wasm** (Dioxus frontend) — a pure-Rust [`init`]/[`report_error`] pair that
//!   builds a Sentry [`envelope`] and POSTs it via `reqwest` fetch, plus a panic
//!   hook. No JS SDK, no session replay, no symbolicated stack — best-effort,
//!   message-level reporting.
//!
//! DSN parsing and envelope building ([`wire`]) are shared, pure, and unit-tested
//! on native.
//!
//! ```toml
//! # backend
//! ev_lib = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["error_monitoring"] }
//! # Dioxus frontend (per-target)
//! [target.'cfg(target_arch = "wasm32")'.dependencies]
//! ev_lib = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["error_monitoring", "wasm"] }
//! ```

pub mod wire;
pub use wire::*;

#[cfg(not(target_arch = "wasm32"))]
mod native;
#[cfg(not(target_arch = "wasm32"))]
pub use native::*;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
pub use browser::*;
