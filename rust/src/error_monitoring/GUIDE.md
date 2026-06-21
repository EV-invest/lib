# `ev_lib::error_monitoring` — cookbook

End-to-end Rust recipes for every surface of the `error_monitoring` feature. For
the API summary and the parity table, see [`README.md`](./README.md). The TS
mirror is [`@evinvest/error-monitoring`](../../../ts/error-monitoring).

- [The two engines](#the-two-engines)
- [DSN and environment config](#dsn-and-environment-config)
- [Full Axum wiring](#full-axum-wiring)
- [Reporting a 5xx error](#reporting-a-5xx-error)
- [Dioxus / wasm wiring](#dioxus--wasm-wiring)
- [The shared wire core](#the-shared-wire-core)
- [Testing](#testing)
- [Gotchas](#gotchas)

## The two engines

- **Native** (`cfg(not(target_arch = "wasm32"))`) — the `sentry` crate.
  [`Config`], [`init`] (returns the guard), [`tracing_layer`], the tower
  [`NewSentryLayer`]/[`SentryHttpLayer`], and [`report`].
- **wasm** (`cfg(target_arch = "wasm32")`) — pure Rust. [`init`] (stores the DSN
  + installs a panic hook) and [`report_error`], which build a Sentry
  [`envelope`] and POST it via `reqwest` fetch.
- **Shared** — the [`wire`] module ([`parse_dsn`], [`ingest_url`],
  [`auth_header`], [`envelope`]) is pure, I/O-free, and unit-tested on native.

The `sentry` crate is native-only and never linked into the browser bundle.

## DSN and environment config

Read both from the environment in the consuming app — the library never reads it
for you. A Sentry DSN's public key is publishable (same trust model as the JS
SDK), so a browser bundle may carry the DSN.

| Var | Side | Meaning |
| --- | --- | --- |
| `SENTRY_DSN` | native | DSN, or unset → Sentry disabled (no-op). |
| `APP_ENV` | native | Environment tag (`production`, `staging`, …). |

On native, the sampling policy mirrors the site: `Config::traces_sample_rate_for`
returns `0.1` in production and `1.0` everywhere else.

## Full Axum wiring

Mirrors the site backend. Four steps, all in the composition root.

**1. Init before the runtime, guard held in `main`.** Sentry must be initialised
before the async runtime starts, so do not use `#[tokio::main]` — build the
runtime by hand and keep the guard alive for the whole process:

```rust
use ev_lib::error_monitoring::{Config, init, tracing_layer};

fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    let env = std::env::var("APP_ENV").unwrap_or_else(|_| "development".to_string());

    let config = Config {
        dsn: std::env::var("SENTRY_DSN").ok(),
        traces_sample_rate: Config::traces_sample_rate_for(&env),
        environment: env,
    };
    // Dropping this guard flushes queued events — bind it for the life of main.
    let _sentry_guard = init(&config);

    init_tracing();

    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?
        .block_on(run(config))
}
```

**2. Add the tracing layer** so `error!`/`warn!` events become Sentry
breadcrumbs and events:

```rust
fn init_tracing() {
    use tracing_subscriber::{EnvFilter, fmt, prelude::*};
    use ev_lib::error_monitoring::tracing_layer;

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    tracing_subscriber::registry()
        .with(filter)
        .with(fmt::layer())
        .with(tracing_layer())
        .init();
}
```

**3. Apply the two tower layers on the router, in this exact order.** Use a
`ServiceBuilder` so the order matches the docs — binding the Sentry layers
directly on the `Router` in the wrong order can leak memory:

```rust
use axum::{Router, body::Body, http::Request};
use tower::ServiceBuilder;
use ev_lib::error_monitoring::{NewSentryLayer, SentryHttpLayer};

fn build(state: AppState) -> Router {
    Router::new()
        .nest("/api/v1", routes())
        .layer(
            ServiceBuilder::new()
                .layer(NewSentryLayer::<Request<Body>>::new_from_top())
                .layer(SentryHttpLayer::new().enable_transaction()),
        )
        .with_state(state)
}
```

`NewSentryLayer::new_from_top()` opens a fresh Sentry hub per request;
`SentryHttpLayer::new().enable_transaction()` records each request as a
transaction. The type parameter is the request type your stack uses
(`Request<Body>`, or `axum::extract::Request`).

## Reporting a 5xx error

Call [`report`] **only for genuinely unexpected failures** — 5xx territory.
Expected domain errors (not-found, validation, conflict) are client mistakes and
must not be reported:

```rust
use ev_lib::error_monitoring::report;

async fn handler(/* … */) -> Result<Json<Reply>, StatusCode> {
    match do_work().await {
        Ok(reply) => Ok(Json(reply)),
        Err(error) => {
            report(&error); // &dyn std::error::Error
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
```

`report` no-ops when Sentry was never initialised, so the same path is safe in
development.

## Dioxus / wasm wiring

Two calls. Init **once on first render**, not at module load: Dioxus installs its
own panic hook at startup, so installing ours from a `use_hook` keeps ours
outermost and forwards to the previous hook:

```rust
use dioxus::prelude::*;
use ev_lib::error_monitoring::{init, report_error};

#[component]
fn App() -> Element {
    use_hook(|| {
        init(
            option_env!("SENTRY_DSN"),                          // None/empty → disabled
            option_env!("APP_ENV").unwrap_or("development"),
        );
    });
    rsx! { Body {} }
}
```

After `init`, every panic is reported automatically (the hook calls
`report_error(info.to_string())` and then the previous hook). You can also
report manually from a fallible spot:

```rust
#[component]
fn PaymentWidget() -> Element {
    let mut mount = use_signal(|| Ok::<(), String>(()));
    use_effect(move || {
        if let Err(message) = mount() {
            report_error(&message);
        }
    });
    rsx! { /* … */ }
}
```

`report_error` parses the stored DSN, builds the envelope, and POSTs it
fire-and-forget. It no-ops when no DSN was configured or the DSN is malformed.

## The shared wire core

The envelope and DSN logic is pure, so you can reason about (and test) the exact
bytes sent to Sentry without a network — this is what the browser transport
POSTs:

```rust
use ev_lib::error_monitoring::{auth_header, envelope, ingest_url, parse_dsn};

let dsn = parse_dsn("https://pub@o9.ingest.sentry.io/4500").unwrap();
assert_eq!(ingest_url(&dsn), "https://o9.ingest.sentry.io/api/4500/envelope/");
assert!(auth_header(&dsn).contains("sentry_key=pub"));

let body = envelope("production", "0123456789abcdef0123456789abcdef", "boom");
assert_eq!(body.split('\n').count(), 3); // envelope header / item header / event
```

## Testing

- **The wire core is pure** — assert DSN parsing, the ingest URL, the auth
  header, and the three-line envelope directly (see the tests in `wire.rs`). No
  network, runs on native.
- **Native `init` no-ops without a DSN** and the sample-rate policy is a pure
  function:

  ```rust
  # use ev_lib::error_monitoring::Config;
  assert_eq!(Config::traces_sample_rate_for("production"), 0.1);
  assert_eq!(Config::traces_sample_rate_for("staging"), 1.0);
  ```

- The browser transport is `wasm32`-only; exercise the message path through the
  shared `wire` helpers on native rather than spinning up a headless browser.

## Gotchas

- **Hold the native guard.** `init` returns `Option<ClientInitGuard>`; the guard
  flushes on drop. `let _guard = init(&config);` in `main` is correct;
  `let _ = init(&config);` drops it immediately and loses buffered events.
- **Init Sentry before the tokio runtime.** Don't use `#[tokio::main]` — build
  the runtime by hand after `init`.
- **Tower layer order matters.** `NewSentryLayer` first (top), then
  `SentryHttpLayer`, via a `ServiceBuilder`.
- **wasm init goes in a `use_hook`, not module init.** Calling it earlier fights
  Dioxus's own panic hook.
- **wasm panic delivery is best-effort.** `panic = abort` may tear the task down
  before the fire-and-forget POST lands — don't rely on every panic reaching
  Sentry.
- **No source maps in wasm.** The browser transport sends a message-level event;
  stack frames are not symbolicated. Use native reporting for backend errors
  that need full fidelity.
- **`report` is for 5xx only.** Reporting expected domain errors floods Sentry
  with noise.
