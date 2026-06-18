# `ev::analytics`

PostHog product analytics — the Rust mirror of
[`@evinvest/analytics`](../../../ts/analytics). A small typed event API with two
transports split by target: a native async `reqwest` capture client for
backends (Axum), and Dioxus bindings that POST the same payload via pure-Rust
`reqwest` fetch on `wasm32`. No PostHog JS SDK on either side.

> This is an **opt-in** library, not the `architecture` kernel: it carries
> runtime deps (`reqwest`, `serde`, Dioxus + the wasm-bindgen stack) and does
> network I/O. Enable the `analytics` feature only where you need it. See the
> repo [`AGENTS.md`](../../../AGENTS.md).

## Install

```toml
# backend (native)
ev = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["analytics"] }
```

```toml
# Dioxus frontend — enable the wasm backend per-target so native builds never
# link the browser stack:
[dependencies]
ev = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["analytics"] }

[target.'cfg(target_arch = "wasm32")'.dependencies]
ev = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["analytics", "wasm"] }
```

## Usage

### Native (Axum / any server)

```rust
use ev::analytics::{Analytics, Event};

// Build once and share (it holds a pooled reqwest client). A `None` key no-ops.
let analytics = Analytics::new(std::env::var("POSTHOG_KEY").ok(), std::env::var("POSTHOG_HOST").ok());

analytics
    .capture("anon-42", &Event::new("checkout_order_placed").prop("amount", 1200).prop("tier", "pro"))
    .await?;
```

### Dioxus frontend

```rust
use dioxus::prelude::*;
use ev::analytics::{AnalyticsProvider, Event, use_analytics};

#[component]
fn App() -> Element {
    rsx! {
        AnalyticsProvider { api_key: option_env!("POSTHOG_KEY").map(str::to_string),
            Cta {}
        }
    }
}

#[component]
fn Cta() -> Element {
    let analytics = use_analytics();
    rsx! {
        button {
            onclick: move |_| analytics.capture(Event::new("hero_cta_clicked").prop("variant", "b")),
            "Invest"
        }
    }
}
```

The capture is fire-and-forget on `wasm32` and a no-op on non-wasm targets
(server-side rendering) and whenever no key is configured.

## Rust ↔ TS parity

The Rust crate is the source of truth; the TS package preserves its
*semantics*. The two ports do not share an API — the TS package layers a
vendor-neutral `AnalyticsSink` seam over a PostHog SDK, while Rust POSTs to
PostHog's `/capture/` directly — so the parity below is by behaviour.

| Concept | Rust (`ev::analytics`) | TS (`@evinvest/analytics`) |
| --- | --- | --- |
| native capture | `Analytics::capture(distinct_id, &Event)` | `createServerSink(client).capture(event, props)` (`./node`) |
| browser capture | `use_analytics().capture(Event)` | `useCapture()` / `useAnalytics()` (`./react`) |
| provider | `AnalyticsProvider { api_key, host }` | `PostHogProvider` (`./react`) |
| event | `Event::new(name).prop(k, v)` | `capture(event, props)` |
| payload builder | `capture_body(api_key, distinct_id, &Event)` | (inside the sink) |
| no-key behaviour | silent no-op (`is_enabled() == false`) | silent no-op |
| default host | `DEFAULT_HOST` (`https://us.i.posthog.com`) | `https://us.i.posthog.com` |

## Limitations

- **No PostHog JS SDK.** Both transports POST to `/capture/` over `reqwest`.
  There is **no autocapture, no `$pageview`, no session/replay, no batching, no
  retry** — one event, one POST, fire-and-forget on the browser.
- **Properties are primitive and PII-free by construction.** `PropValue` is
  `Bool | Int | Num | Str` — no nested objects, no free text. Event names are
  the dashboard contract; keep them stable.
- **No-key → no-op.** A `None` key disables capture on both sides, so the same
  code runs in unconfigured environments (local, CI).
- **Browser identity** is an anonymous, PII-free id persisted in a first-party
  `ev_did` cookie (one year); there is no `identify` / user merging.

## Develop

Verified from the repo root:

```sh
cargo test   -p ev --features analytics
cargo clippy -p ev --features analytics --all-targets -- -D warnings
cargo check  -p ev --features "analytics wasm" --target wasm32-unknown-unknown
```

See [`GUIDE.md`](./GUIDE.md) for the full cookbook.
