//! `analytics` — PostHog product analytics (mirrors `@evinvest/analytics`).
//!
//! A small typed event API ([`Event`], [`capture_body`]) with two transports,
//! split by target so a build pays only for what it runs:
//! - **native** (Axum and other servers) — [`Analytics`], an async `reqwest`
//!   client POSTing to PostHog's `/capture/`.
//! - **wasm** (Dioxus frontend) — [`AnalyticsProvider`] + [`use_analytics`], which
//!   POST the same payload via pure-Rust `reqwest` fetch (no PostHog JS SDK).
//!
//! There is no PostHog JS SDK and no batching/session/replay: this is a
//! deliberately minimal, dep-light capture client. Event names are snake_case
//! `<surface>_<thing>_<action>` and properties are primitive and PII-free.
//!
//! ```toml
//! # backend
//! ev = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["analytics"] }
//! # Dioxus frontend (per-target)
//! [target.'cfg(target_arch = "wasm32")'.dependencies]
//! ev = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["analytics", "wasm"] }
//! ```

pub mod event;
pub use event::*;

#[cfg(not(target_arch = "wasm32"))]
mod client;
#[cfg(not(target_arch = "wasm32"))]
pub use client::*;

mod ui;
pub use ui::*;

#[cfg(test)]
mod test_util;
