# `ev::experiments`

Frontend-only A/B testing — the Rust mirror of
[`@evinvest/experiments`](../../../ts/experiments). Cookie-bucketed weighted
variant assignment for Dioxus, preserving the feature's semantics (cookie shape,
weighted pick, control fallback). The bucketing core is pure and `wasm32`-safe;
the cookie helpers and assignment run in the browser.

> This is an **opt-in**, **frontend-only** library, not the `architecture`
> kernel: it carries runtime deps (Dioxus + the wasm-bindgen stack) and touches
> `document.cookie`. It does no I/O of its own — exposure and action events go
> through an **injected sink**, so it **never imports `analytics`** (no
> cross-library coupling). See the repo [`AGENTS.md`](../../../AGENTS.md) and the
> [GUIDE](./GUIDE.md) for the bridge.

## Install

```toml
# Dioxus frontend — enable the wasm backend per-target for the cookie helpers:
[dependencies]
ev = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["experiments"] }

[target.'cfg(target_arch = "wasm32")'.dependencies]
ev = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["experiments", "wasm"] }
```

The pure core ([`Experiment`], [`pick_variant`], …) compiles natively too, so it
is testable without a browser.

## Usage

### The bucketing core (pure, `wasm32`-safe)

```rust
use ev::experiments::{Experiment, pick_variant, resolve_variant, next_variant, cookie_name};

let hero = Experiment::new(["a", "b"], [0.5, 0.5]); // variants[0] is the control
let team = Experiment::uniform(["a", "b", "c"]);    // equal weights

cookie_name("hero");                                 // "ab_hero"
pick_variant(&hero, || 0.9);                         // "b" — weighted draw, rng in [0,1)
resolve_variant(&hero, Some("zzz"));                 // "a" — unknown → control
next_variant(&team, "c", 1);                         // "a" — wraps
```

### Browser variant assignment (wasm)

```rust
use ev::experiments::{assign_variant, current_variant};

let variant = assign_variant(&hero, "hero");  // sticky: assigns + writes ab_hero on first visit
let current = current_variant(&hero, "hero"); // reads ab_hero without assigning
```

### Dioxus tracker + action events

```rust
use dioxus::prelude::*;
use ev::experiments::{ExperimentTracker, ExposureSink, use_experiment_event};

#[component]
fn Hero(variant: String, on_event: ExposureSink) -> Element {
    rsx! {
        // fires `hero_exposed` once on mount through on_event
        ExperimentTracker { experiment: "hero".to_string(), variant, on_event,
            Cta {}
        }
    }
}

#[component]
fn Cta() -> Element {
    let track = use_experiment_event();
    rsx! {
        button {
            // emits `hero_cta_clicked` with the bucketed variant merged in
            onclick: move |_| track("cta_clicked", [("cta".to_string(), "explore".to_string())].into()),
            "Explore"
        }
    }
}
```

`on_event` is an [`ExposureSink`] (`EventHandler<TrackedEvent>`) you supply — see
the [GUIDE](./GUIDE.md) for wiring it to `analytics` without the libraries
importing each other.

## Rust ↔ TS parity

The Rust crate is the source of truth; the TS package preserves its
*semantics*.

| Concept | Rust (`ev::experiments`) | TS (`@evinvest/experiments`) |
| --- | --- | --- |
| experiment | `Experiment::new(variants, weights)` / `::uniform` | config entry `{ variants, weights }` (`.`) |
| cookie name | `cookie_name(key)` → `ab_<key>` | `cookieName(key)` (`.`) |
| weighted pick | `pick_variant(&exp, rng)` | `pickVariant(cfg, key, rng?)` (`.`) |
| control fallback | `resolve_variant(&exp, raw)` | `resolveVariant(cfg, key, raw)` (`.`) |
| cyclic step | `next_variant(&exp, current, step)` | `nextVariant(cfg, key, current, step)` (`.`) |
| sticky assignment | `assign_variant(&exp, key)` (wasm) | proxy `createAbMiddleware` (`./next`) |
| read current | `current_variant` / `read_cookie` (wasm) | `getVariant` / `readCookie` |
| exposure boundary | `ExperimentTracker { experiment, variant, on_event }` | `ExperimentTracker` (`./react`) |
| action event | `use_experiment_event()` → `track(action, props)` | `useExperimentEvent()` |
| injected sink | `ExposureSink = EventHandler<TrackedEvent>` | `onEvent: CaptureFn` |

## Limitations

- **Frontend-only.** There is no server proxy here (no Rust equivalent of the TS
  `./next` middleware); assignment happens in the browser via the `ab_<key>`
  cookie.
- **Per-device bucketing.** `pick_variant` draws from an injected `rng`
  (`js_sys::Math::random` in the browser) — there is **no user-id hashing**.
  Stickiness comes from the 30-day cookie, not the rng.
- **No event transport, by design.** The tracker emits through an injected
  [`ExposureSink`]; there is no batching, retry, or PII scrubbing — the sink you
  wire owns all of that, and `experiments` never imports `analytics`.
- **No dev override panel.** The TS package ships a `DevAbPanel`; the Rust
  feature does not — `next_variant` is provided for building your own dev cycle.

## Develop

Verified from the repo root:

```sh
cargo test   -p ev --features experiments
cargo clippy -p ev --features experiments --all-targets -- -D warnings
cargo check  -p ev --features "experiments wasm" --target wasm32-unknown-unknown
```

See [`GUIDE.md`](./GUIDE.md) for the full cookbook, including the analytics
bridge.
