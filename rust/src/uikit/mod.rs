//! `uikit` — EV-invest's dep-light Dioxus UI kit.
//!
//! Renderer-agnostic RSX components, mirrored semantically by the `@ev/uikit`
//! TypeScript package. Styling is Tailwind-utility based; every class references
//! a design token from [`tokens.css`](./tokens.css), the theme contract a
//! consumer must `@import` into its Tailwind v4 entrypoint.
//!
//! Variants are plain `enum`s matched to class strings (no `cva`); the `class`
//! prop is fused last via [`cn!`](crate::cn) so a caller override wins.
//!
//! ```toml
//! [target.'cfg(target_arch = "wasm32")'.dependencies]
//! ev = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["uikit", "wasm"] }
//! ```

pub mod utils;
