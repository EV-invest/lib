# rust

The `ev` crate's sources — one library per Cargo feature, so a consumer compiles
only what it enables. The thin virtual workspace that anchors the crate for
repo-root tooling is [`../Cargo.toml`](../Cargo.toml).

```
rust/
├── Cargo.toml          the `ev` package
├── src/
│   ├── lib.rs
│   ├── architecture/      the `architecture` feature (DDD tactical kernel)
│   ├── uikit/             the `uikit` feature (dep-light Dioxus UI kit + tokens.css)
│   ├── analytics/         the `analytics` feature (PostHog product analytics)
│   ├── error_monitoring/  the `error_monitoring` feature (Sentry error monitoring)
│   ├── experiments/       the `experiments` feature (frontend-only A/B testing)
│   ├── settings/          the `settings` feature (typed env settings)
│   └── otel/              the `otel` feature (OpenTelemetry logs + traces, native-only)
└── tests/              integration tests
```

Unlike `architecture`, the `uikit` feature carries runtime deps (`dioxus`,
`tailwind_fuse`) — a UI kit can't be zero-dep. It mirrors the `@evinvest/uikit`
TypeScript package and ships the shared design tokens; see its rustdoc and
[`../ts/uikit/README.md`](../ts/uikit/README.md).

`analytics`, `error_monitoring`, and `experiments` likewise carry runtime deps
and **do network I/O** (PostHog / Sentry), gated per-target so native and browser
backends stay separate — native uses `reqwest`(rustls)/`sentry`, wasm uses
pure-Rust HTTP behind the `wasm` feature. Each mirrors its TS package
(`@evinvest/analytics`, `@evinvest/error-monitoring`, `@evinvest/experiments`);
see their rustdoc and READMEs.

`settings` is zero-dep like the kernel but reads host state (the process
environment — no files, no network): the `settings!` macro builds validated
settings structs with aggregate error reporting; sops/age decrypt at the
shell/CI boundary, never in the library. It mirrors `@evinvest/settings`.

Each feature mirrors a TypeScript package in [`../ts`](../ts). cargo runs from the
repo root — pass `-p ev` for feature flags. See
[`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).
