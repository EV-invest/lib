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
│   ├── uikit/             the `uikit` feature (dep-light Dioxus UI kit)
│   ├── analytics/         the `analytics` feature (PostHog product analytics)
│   ├── error_monitoring/  the `error_monitoring` feature (Sentry error monitoring)
│   ├── experiments/       the `experiments` feature (frontend-only A/B testing)
│   ├── settings/          the `settings` feature (typed env settings)
│   ├── i18n/              the `i18n` feature (five-locale internationalisation)
│   └── otel/              the `otel` feature (OpenTelemetry logs + traces, native-only)
└── tests/              integration tests
```

Unlike `architecture`, the `uikit` feature carries runtime deps (`dioxus`,
`tailwind_fuse`) — a UI kit can't be zero-dep. It mirrors the `@evinvest/uikit`
TypeScript package and ships the shared design tokens; see its rustdoc and
[`../ts/uikit/README.md`](../ts/uikit/README.md), which carries the token table.

The class strings live once, in the Dioxus-free `ev_lib_classes` crate
([`classes/`](classes)); `ev_lib_gen` emits the TypeScript half from them, so the
two ports cannot drift. `uikit` re-exports only the types a caller has to *name*
to build a prop (`ButtonVariant`, `Size`, `Polarity`, `Surface`, …) — the class
constants are an implementation detail.

`uikit` needs exactly one of `legacy` (the consumer imported
`tokens-legacy.css`) or `modern` (`tokens.css`); `default = ["legacy"]`, and the
build fails loudly on both or neither. `modern` therefore reads:

```toml
ev_lib = { version = "0.10", default-features = false, features = ["uikit", "modern"] }
```

Tailwind cannot scan a crate unpacked from crates.io, so
`ev_lib_classes::CLASS_INVENTORY` carries every class literal the kit can emit.
Write it out from `build.rs` and `@source` the result:

```rust
std::fs::write("uikit-classes.txt", ev_lib_classes::CLASS_INVENTORY).unwrap();
```

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

`i18n` is zero-dep and wasm-safe: the locale registry, the `/<locale>` URL
contract, `Accept-Language` negotiation, an ICU-subset message formatter, and
the translation policy. It exists because a Dioxus zone cannot import an npm
package, and both halves read **the same `messages/<locale>/*.json`** so a
catalogue is portable between them and neither can drift alone. The CLDR plural
rules and number grouping are hand-written for exactly EV's five locales rather
than pulling ICU4X into a wasm bundle — see the module note on why that is a
deliberate ceiling, not a shortcut. It mirrors `@evinvest/i18n`.

Each feature mirrors a TypeScript package in [`../ts`](../ts). cargo runs from the
repo root — pass `-p ev` for feature flags. See
[`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).
