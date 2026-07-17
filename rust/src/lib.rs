#![allow(unused_features)]
#![feature(default_field_values)]
//! EV-invest's shared Rust libraries, one per Cargo feature.
//!
//! Each library is a self-contained module gated behind a feature flag, so a
//! consumer pulls in only what it asks for and nothing else is compiled:
//!
//! ```toml
//! ev_lib = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["architecture"] }
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
//! - **`settings`** — typed env settings (mirrors `@evinvest/settings`): the
//!   `settings!` macro reads env vars into a validated struct with aggregate
//!   error reporting and secret redaction. Zero deps; sops stays at the shell/CI
//!   boundary. See [`settings`](mod@settings).
//! - **`otel`** — OpenTelemetry logs + traces over OTLP (native backends only;
//!   inert on wasm): two `tracing` layers + a flush guard, and tonic
//!   interceptors for W3C trace propagation. See [`otel`].

#![cfg_attr(docsrs, feature(doc_cfg))]

#[cfg(feature = "architecture")]
pub mod architecture;

#[cfg(feature = "uikit")]
pub mod uikit;

// The `cn!` fuse macro and styling data live in the Dioxus-free `ev_lib_classes`
// crate; re-export so the in-crate `crate::cn` path keeps resolving.
#[cfg(feature = "uikit")]
pub use ev_lib_classes::cn;

#[cfg(feature = "analytics")]
pub mod analytics;

#[cfg(feature = "error_monitoring")]
pub mod error_monitoring;

#[cfg(feature = "otel")]
pub mod otel;

#[cfg(feature = "experiments")]
pub mod experiments;

#[cfg(feature = "settings")]
pub mod settings;

// wasm-only: the module links wasm-bindgen/web-sys, which aren't deps on native.
// The `mfe!` macro is `#[macro_export]`ed from inside, so it too is wasm-only —
// the sole consumer (a producer cdylib) is always a wasm build.
#[cfg(all(feature = "mfe", target_arch = "wasm32"))]
pub mod mfe;
