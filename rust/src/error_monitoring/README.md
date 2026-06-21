# `ev_lib::error_monitoring`

Sentry error monitoring — the Rust mirror of
[`@evinvest/error-monitoring`](../../../ts/error-monitoring). Two transports
split by target: the native side is the [`sentry`](https://docs.rs/sentry) crate
(init guard, the tracing layer, the tower HTTP layers, and a `report` helper);
the Dioxus/wasm side is a pure-Rust envelope POST plus a panic hook — no JS SDK.

> This is an **opt-in** library, not the `architecture` kernel: it carries
> runtime deps (the `sentry` crate natively; `reqwest` + the wasm-bindgen stack
> on the browser) and does network I/O. Enable the `error_monitoring` feature
> only where you need it. See the repo [`AGENTS.md`](../../../AGENTS.md). The
> native `sentry` crate is gated to `cfg(not(target_arch = "wasm32"))` and is
> **never linked into wasm**.

## Install

```toml
# backend (native) — the sentry crate + its tower/tracing integrations
ev = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["error_monitoring"] }
```

```toml
# Dioxus frontend — enable the wasm backend per-target (pure-Rust envelope POST):
[dependencies]
ev = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["error_monitoring"] }

[target.'cfg(target_arch = "wasm32")'.dependencies]
ev = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["error_monitoring", "wasm"] }
```

## Usage

### Native (Axum / any server)

```rust
use ev_lib::error_monitoring::{Config, NewSentryLayer, SentryHttpLayer, init, report, tracing_layer};

// 1. Init *before* the async runtime; hold the guard for the life of the process.
fn main() -> anyhow::Result<()> {
    let env = std::env::var("APP_ENV").unwrap_or_else(|_| "development".to_string());
    let config = Config {
        dsn: std::env::var("SENTRY_DSN").ok(),
        traces_sample_rate: Config::traces_sample_rate_for(&env),
        environment: env,
    };
    let _guard = init(&config); // None when no DSN — binding is simply inert
    // … build the tracing subscriber + runtime, then serve …
    Ok(())
}
```

```rust
// 2. Add the tracing layer to the subscriber registry.
use tracing_subscriber::prelude::*;
tracing_subscriber::registry()
    .with(tracing_subscriber::fmt::layer())
    .with(tracing_layer())
    .init();
```

```rust
// 3. Apply the two tower layers on the router, in this exact order:
use tower::ServiceBuilder;
let app = router.layer(
    ServiceBuilder::new()
        .layer(NewSentryLayer::<axum::extract::Request>::new_from_top())
        .layer(SentryHttpLayer::new().enable_transaction()),
);
```

```rust
// 4. Report genuinely unexpected (5xx) errors.
report(&error);
```

### Dioxus frontend (wasm)

```rust
use dioxus::prelude::*;
use ev_lib::error_monitoring::{init, report_error};

#[component]
fn App() -> Element {
    // Init once on first render, *after* main — Dioxus installs its own panic
    // hook at startup, so run ours from a use_hook.
    use_hook(|| init(option_env!("SENTRY_DSN"), option_env!("APP_ENV").unwrap_or("development")));
    rsx! { /* … */ }
}

// Manual report from a fallible handler:
report_error("payment widget failed to mount");
```

## Rust ↔ TS parity

The Rust crate is the source of truth; the TS package preserves its
*semantics*. The native side is the real `sentry` crate; the TS side wraps the
Sentry JS SDKs. Parity is by behaviour.

| Concept | Rust (`ev_lib::error_monitoring`) | TS (`@evinvest/error-monitoring`) |
| --- | --- | --- |
| server init | `init(&Config) -> Option<ClientInitGuard>` | `initServer(opts)` (`./node`) |
| sample rate policy | `Config::traces_sample_rate_for(env)` (0.1 prod / 1.0 else) | `defaultTracesSampleRate` (0.1 / 1.0) |
| report a 5xx error | `report(&dyn Error)` | `sink.reportError(err, ctx)` (`.` core) |
| HTTP capture | tower `NewSentryLayer` + `SentryHttpLayer` | Next request hooks (`./next`) |
| tracing breadcrumbs | `tracing_layer()` in the subscriber | (SDK integrations) |
| browser init | `init(dsn, environment)` (wasm) | `ErrorMonitoringProvider` (`./react`) |
| browser report | `report_error(&str)` (wasm) | `ErrorBoundary` / `reportError` |
| no-DSN behaviour | silent no-op | silent no-op |

## Limitations

- **Native and wasm are different engines.** Native is the full `sentry` crate
  (transactions, breadcrumbs, structured exceptions). The wasm side is
  **best-effort, message-level**: it builds a Sentry envelope by hand and POSTs
  it via `reqwest` fetch — **no source maps / symbolication, no session replay,
  no breadcrumbs, no transactions**.
- **wasm panic delivery is best-effort.** The panic hook fires
  `report_error(info.to_string())`, but `panic = abort` can tear the task down
  before the fire-and-forget POST completes — the same trade-off the JS SDK
  panic hook makes.
- **No-DSN → no-op** on both sides. Native `init` returns `None`; wasm `init`
  disables reporting. Local dev needs no configuration.
- **Guard lifetime is load-bearing (native).** The `ClientInitGuard` flushes on
  drop — bind it in `main` and keep it alive, or events are lost on exit.

## Develop

Verified from the repo root:

```sh
cargo test   -p ev_lib --features error_monitoring
cargo clippy -p ev_lib --features error_monitoring --all-targets -- -D warnings
cargo check  -p ev_lib --features "error_monitoring wasm" --target wasm32-unknown-unknown
```

See [`GUIDE.md`](./GUIDE.md) for the full cookbook.
