# `ev::analytics` — cookbook

End-to-end Rust recipes for every surface of the `analytics` feature. For the
API summary and the parity table, see [`README.md`](./README.md). The TS mirror
is [`@evinvest/analytics`](../../../ts/analytics).

- [The model](#the-model)
- [The event taxonomy + PII rules](#the-event-taxonomy--pii-rules)
- [Reading the key and host from the environment](#reading-the-key-and-host-from-the-environment)
- [Backend: capture from an Axum handler](#backend-capture-from-an-axum-handler)
- [Frontend: capture from a Dioxus `onclick`](#frontend-capture-from-a-dioxus-onclick)
- [The payload builder](#the-payload-builder)
- [Testing](#testing)
- [Gotchas](#gotchas)

## The model

There is one event type and two transports:

- [`Event`] — a snake_case name plus a `BTreeMap<String, PropValue>` of
  primitive properties. Built fluently: `Event::new(name).prop(k, v)`.
- [`Analytics`] (native, non-wasm) — an async `reqwest` client that POSTs to
  `<host>/capture/`.
- [`AnalyticsProvider`] + [`use_analytics`] (Dioxus) — context-provided config
  plus a `Copy` handle; `capture(Event)` POSTs via pure-Rust `reqwest` fetch on
  `wasm32`.

Both transports share [`capture_body`], so the JSON sent to PostHog is identical
on the server and in the browser.

## The event taxonomy + PII rules

- **Name:** `snake_case`, scoped `<surface>_<thing>_<action>`, e.g.
  `hero_cta_clicked`, `calculator_submitted`, `checkout_order_placed`.
- **Names are the contract.** Dashboards key off them — renaming breaks
  analysis.
- **Props are primitives only.** `PropValue` is `Bool | Int | Num | Str` by
  construction — there is no variant for nested objects or arrays. `i32`/`i64`,
  `f64`, `bool`, `&str`/`String` all `Into<PropValue>`.
- **Never PII.** No names, emails, or free text the user typed. Pass enums and
  flags (`tier`, `variant`, `count`), not raw input.

```rust
use ev::analytics::Event;

// good — enum-like labels and counts
Event::new("calculator_submitted").prop("tier", "pro").prop("amount", 1200).prop("recurring", true);

// NEVER — free text / PII
Event::new("calculator_submitted").prop("email", user_email);
```

## Reading the key and host from the environment

The library never reads the environment for you — pass the values in. On the
server, read them at startup:

```rust
use ev::analytics::Analytics;

let analytics = Analytics::new(
    std::env::var("POSTHOG_KEY").ok(),     // None → capture is a silent no-op
    std::env::var("POSTHOG_HOST").ok(),    // None → DEFAULT_HOST (https://us.i.posthog.com)
);
```

In a Dioxus/wasm build the env is fixed at compile time, so use `option_env!`:

```rust
AnalyticsProvider { api_key: option_env!("POSTHOG_KEY").map(str::to_string), /* … */ }
```

A PostHog *project* key is publishable, so inlining it into the client bundle is
fine.

## Backend: capture from an Axum handler

Build one `Analytics` at startup, store it in the router state (it is `Clone`
and holds a pooled client), and capture from handlers. Capture is **best-effort
analytics, not request-critical** — log a failure, don't fail the request:

```rust
use axum::{Json, extract::State, http::StatusCode};
use ev::analytics::{Analytics, Event};

#[derive(Clone)]
struct AppState {
    analytics: Analytics,
}

async fn place_order(State(state): State<AppState>, Json(req): Json<OrderRequest>) -> StatusCode {
    // … do the work …

    if let Err(error) = state
        .analytics
        .capture(&req.user_id, &Event::new("checkout_order_placed").prop("amount", req.amount))
        .await
    {
        tracing::warn!(%error, "analytics capture failed");
    }
    StatusCode::CREATED
}
```

`distinct_id` names the subject; for system events with no user, pass a
constant such as `"server"`. `capture` returns `reqwest::Result<()>` — network
and non-2xx responses surface as `reqwest::Error`; a missing key returns `Ok`
without a network call.

## Frontend: capture from a Dioxus `onclick`

Mount [`AnalyticsProvider`] once near the root, then read the handle with
[`use_analytics`] in any descendant:

```rust
use dioxus::prelude::*;
use ev::analytics::{AnalyticsProvider, Event, use_analytics};

#[component]
fn App() -> Element {
    rsx! {
        AnalyticsProvider {
            api_key: option_env!("POSTHOG_KEY").map(str::to_string),
            host: option_env!("POSTHOG_HOST").map(str::to_string),
            Hero {}
        }
    }
}

#[component]
fn Hero() -> Element {
    let analytics = use_analytics();
    rsx! {
        button {
            onclick: move |_| analytics.capture(Event::new("hero_cta_clicked").prop("variant", "b")),
            "Invest"
        }
        // gate optional work on whether analytics is configured
        if analytics.is_enabled() {
            span { "tracking on" }
        }
    }
}
```

`AnalyticsHandle` is `Copy`, so it moves cleanly into closures. `capture` takes
the `Event` by value, POSTs it fire-and-forget via
`wasm_bindgen_futures::spawn_local`, and no-ops on non-wasm targets (SSR) and
when no key is set. The browser identity is an anonymous id persisted in the
`ev_did` cookie — no `identify` call is needed.

## The payload builder

[`capture_body`] is pure and network-free, so the wire shape is unit-testable
without a server. It is what both transports send:

```rust
use ev::analytics::{Event, capture_body};

let body = capture_body("phc_key", "anon-1", &Event::new("hero_cta_clicked").prop("variant", "b"));
assert_eq!(body["event"], "hero_cta_clicked");
assert_eq!(body["distinct_id"], "anon-1");
assert_eq!(body["properties"]["variant"], "b");
assert_eq!(body["properties"]["$lib"], "ev-analytics"); // appended marker
```

The timestamp is left to PostHog's receive time.

## Testing

- **The event model and payload are pure** — assert against `Event` and
  `capture_body` directly, no client or server needed (the tests in `event.rs`).
- **`Analytics` no-ops without a key**, so unit tests don't need a PostHog
  endpoint:

  ```rust
  # use ev::analytics::{Analytics, Event};
  #[tokio::test]
  async fn capture_is_noop_when_disabled() {
      let analytics = Analytics::new(None, None);
      assert!(!analytics.is_enabled());
      assert!(analytics.capture("anon", &Event::new("noop_event")).await.is_ok());
  }
  ```

- **The Dioxus surface renders under `dioxus-ssr`** — the components are
  renderer-agnostic and the capture POST is gated to `wasm32`, so you can assert
  that `AnalyticsProvider` exposes the right `is_enabled()` state without a
  browser.

## Gotchas

- **No batching / retry.** Each `capture` is one POST. On the browser it is
  fire-and-forget (a failed fetch is dropped silently); on the server, check the
  `Result`.
- **Native vs wasm capture differ in error handling.** The native client
  returns `reqwest::Result<()>`; the Dioxus handle returns `()` and swallows
  errors (analytics must never break the UI).
- **Keep props primitive and PII-free.** The type system stops you from sending
  nested objects, but it cannot stop you from putting an email into a `Str` —
  that discipline is on you.
- **One provider.** Mount `AnalyticsProvider` once near the root; nesting it
  creates multiple configs.
- **`use_analytics` panics outside a provider** (it reads context). Mount the
  provider above any component that calls it.
