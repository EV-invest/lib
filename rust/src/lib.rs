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

#![cfg_attr(docsrs, feature(doc_cfg))]

#[cfg(feature = "architecture")]
pub mod architecture;
