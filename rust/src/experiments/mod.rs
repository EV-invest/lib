//! `experiments` — frontend-only A/B testing (mirrors `@evinvest/experiments`).
//!
//! Cookie-bucketed weighted variant assignment for Dioxus, plus deterministic
//! hash bucketing ([`pick_variant_for`]) for cookie-free, per-subject splits.
//! The bucketing core ([`config`]) is pure and `wasm32`-safe; the browser
//! cookie helpers ([`assign_variant`], [`read_cookie`]) are `wasm32`-only.
//! Exposure and action events are reported through an **injected**
//! [`ExposureSink`], so this library never imports `analytics` — the consumer
//! forwards each [`TrackedEvent`] to whatever capture it uses (no cross-library
//! coupling).
//!
//! ```toml
//! [target.'cfg(target_arch = "wasm32")'.dependencies]
//! ev_lib = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["experiments", "wasm"] }
//! ```

pub mod config;
pub use config::*;

mod hash;
pub use hash::*;

mod ui;
pub use ui::*;

#[cfg(target_arch = "wasm32")]
mod cookie;
#[cfg(target_arch = "wasm32")]
pub use cookie::*;

#[cfg(test)]
mod test_util;
