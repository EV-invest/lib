#![feature(default_field_values)]
//! `ev` — EV-invest's shared Rust libraries, one per Cargo feature.
//!
//! Each library is a self-contained module gated behind a feature flag, so a
//! consumer pulls in only what it asks for and nothing else is compiled:
//!
//! ```toml
//! ev = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["architecture"] }
//! ```
//!
//! # Available features
//!
//! - **`architecture`** — generic, I/O-free, `wasm32`-safe DDD tactical kernel
//!   (typed ids, entities, aggregate roots, repositories, gateways, the unit of
//!   work, domain events, specifications). See [`architecture`].
//! - **`uikit`** — dep-light Dioxus UI kit (mirrors `@evinvest/uikit`). See [`uikit`].
//! - **`analytics`** — PostHog product analytics (mirrors `@evinvest/analytics`):
//!   native async capture over `reqwest`; pure-Rust fetch on the Dioxus/wasm
//!   frontend. Does network I/O — opt-in, not the kernel. See [`analytics`].
//! - **`error_monitoring`** — Sentry error monitoring (mirrors
//!   `@evinvest/error-monitoring`): native backend on the `sentry` crate; pure-Rust
//!   envelope POST + panic hook on the Dioxus/wasm frontend. See [`error_monitoring`].
//! - **`experiments`** — frontend-only A/B testing (mirrors `@evinvest/experiments`):
//!   cookie-bucketed variant assignment; exposure is reported through an injected
//!   sink, so it never imports `analytics`. See [`experiments`].

#![cfg_attr(docsrs, feature(doc_cfg))]

#[cfg(feature = "architecture")]
pub mod architecture;

#[cfg(feature = "uikit")]
pub mod uikit;

#[cfg(feature = "analytics")]
pub mod analytics;

#[cfg(feature = "error_monitoring")]
pub mod error_monitoring;

#[cfg(feature = "experiments")]
pub mod experiments;
