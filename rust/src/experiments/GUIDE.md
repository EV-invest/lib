# `ev_lib::experiments` — cookbook

End-to-end Rust recipes for every surface of the `experiments` feature. For the
API summary and the parity table, see [`README.md`](./README.md). The TS mirror
is [`@evinvest/experiments`](../../../ts/experiments).

- [The model](#the-model)
- [Define experiments](#define-experiments)
- [Assign a variant in the browser](#assign-a-variant-in-the-browser)
- [Bucket by subject, without a cookie](#bucket-by-subject-without-a-cookie)
- [Wrap a section in `ExperimentTracker`](#wrap-a-section-in-experimenttracker)
- [Track actions with `use_experiment_event`](#track-actions-with-use_experiment_event)
- [Bridge the injected sink to `analytics`](#bridge-the-injected-sink-to-analytics)
- [The event taxonomy](#the-event-taxonomy)
- [Testing the pure core](#testing-the-pure-core)
- [Gotchas](#gotchas)

## The model

- **Core** ([`config`], pure + `wasm32`-safe): [`Experiment`], [`pick_variant`],
  [`resolve_variant`], [`next_variant`], [`cookie_name`], the event-name helpers
  ([`exposed_event`], [`action_event`]), and [`TrackedEvent`].
- **Hash bucketing** (pure + `wasm32`-safe): [`pick_variant_for`], built on
  [`hash_to_unit`] / [`hash_rng`] / [`fnv1a32`] — a deterministic, cookie-free
  split per subject (location, user…).
- **Cookie helpers** (wasm only): [`assign_variant`], [`current_variant`],
  [`read_cookie`], [`write_variant`] — the sticky `ab_<key>` cookie (30 days).
- **Dioxus** ([`ExperimentTracker`], [`use_experiment`], [`use_experiment_event`])
  — exposure + action events flow through an injected [`ExposureSink`].

The library **never imports `analytics`.** It defines its own [`TrackedEvent`]
and emits it through the injected sink; the consumer forwards each event to
whatever capture it uses.

## Define experiments

`variants[0]` is the control. Weights are relative (they need not sum to 1) —
`pick_variant` normalises by their total. Keep variant keys stable: they are the
dashboard contract.

```rust
use ev_lib::experiments::Experiment;

let hero = Experiment::new(["a", "b"], [0.5, 0.5]);
let team = Experiment::new(["a", "b", "c"], [2.0, 1.0, 1.0]); // 50% / 25% / 25%
let nav = Experiment::uniform(["a", "b"]);                    // equal weights
```

Two optional knobs mirror the TS `ExperimentSpec`:

```rust
let paused = Experiment::uniform(["a", "b"]).with_enabled(false); // kill switch
let held = Experiment::new(["a", "b"], [0.5, 0.5]).with_holdout(0.1); // 10% pinned to control
```

- `enabled: Some(false)` returns the control everywhere: `pick_variant` draws
  nothing and `resolve_variant` ignores a valid stored cookie, so switching an
  experiment off takes effect for visitors already bucketed.
- `holdout` (clamped to `[0, 1]`, `NaN` → 0) reuses the single draw: `u < h` is
  the control, otherwise `u` is rescaled to `(u - h) / (1 - h)` before the
  weighted walk. A zero holdout leaves every pick bit-identical to no holdout.
- While an experiment is disabled, [`assign_variant`] serves the control and
  **writes no cookie** (the pure decision is [`plan_assignment`]). So after you
  re-enable it, no cookies from the pause are left pinning visitors to the
  control: visitors first seen during the pause are bucketed fresh, and those
  bucketed before it get their old variant back.

## Assign a variant in the browser

On the browser, assign once per device. [`assign_variant`] reads `ab_<key>`; if
the cookie is set it resolves it (unknown values fall back to the control) and
leaves it alone, otherwise it draws a weighted variant (via `js_sys::Math::random`)
and writes the sticky cookie:

```rust
use ev_lib::experiments::{assign_variant, current_variant};

let variant = assign_variant(&hero, "hero");  // assigns + persists on first visit
let current = current_variant(&hero, "hero"); // resolve without assigning (control fallback)
```

These are `wasm32`-only (they touch `document.cookie`). On non-browser builds
(SSR / native tests), resolve to the control with the pure core:

```rust
use ev_lib::experiments::resolve_variant;
let variant = resolve_variant(&hero, None); // "a"
```

## Bucket by subject, without a cookie

When the unit of the experiment is not the visitor but something you already
know at render time — a location of a network, a tenant, a user id — bucket by
hashing it. [`pick_variant_for`] is [`pick_variant`] driven by
[`hash_rng`]`("{key}:{subject}")`: the same `(key, subject)` always lands on the
same variant, no cookie is read or written, and the page can stay static.

```rust
use ev_lib::experiments::{Experiment, pick_variant_for};

let hero = Experiment::new(["a", "b"], [0.5, 0.5]);
let variant = pick_variant_for(&hero, "hero", "loc-1"); // stable for loc-1, in Rust and TS
```

`key` is part of the seed, so one subject is bucketed independently across
experiments. The primitives are public for custom draws:

```rust
use ev_lib::experiments::{fnv1a32, hash_rng, hash_to_unit};

fnv1a32(b"a");                     // 0xE40C292C — 32-bit FNV-1a over UTF-8 bytes
hash_to_unit("exp:loc-1");         // 0.7218671222217381 — fnv1a32 / 2^32, in [0, 1)
let mut rng = hash_rng("exp:loc-1");
rng();                             // == hash_to_unit("exp:loc-1#0")
rng();                             // == hash_to_unit("exp:loc-1#1")
```

This definition is shared byte for byte with the TS `hashToUnit` / `hashRng` /
`pickVariantFor`; the parity vectors are pinned in tests on both sides.

## Wrap a section in `ExperimentTracker`

[`ExperimentTracker`] is the A/B boundary: it provides the experiment context to
descendants and fires `<experiment>_exposed` through `on_event` **on mount and
again whenever the tracked experiment or variant changes** (or a sink first
appears — the mirror of the TS exposure-effect deps). Resolve the `variant`
first (browser cookie or control), then wrap the variant content:

```rust
use dioxus::prelude::*;
use ev_lib::experiments::{Experiment, ExperimentTracker, ExposureSink, assign_variant};

#[component]
fn Hero(on_event: ExposureSink) -> Element {
    let hero = use_hook(|| Experiment::new(["a", "b"], [0.5, 0.5]));
    let variant = use_hook(|| assign_variant(&hero, "hero"));
    rsx! {
        ExperimentTracker { experiment: "hero".to_string(), variant: variant.clone(), on_event,
            match variant.as_str() {
                "b" => rsx! { HeroB {} },
                _ => rsx! { HeroA {} },
            }
        }
    }
}
```

`on_event` is `Option<ExposureSink>` on the component — omit it to render without
reporting (e.g. a preview). Read the current `(experiment, variant)` anywhere in
the subtree with [`use_experiment`].

## Track actions with `use_experiment_event`

Inside the tracker subtree, [`use_experiment_event`] returns a
`track(action, props)` closure that emits `<experiment>_<action>` with the
bucketed `variant` merged in, through the same injected sink:

```rust
use dioxus::prelude::*;
use ev_lib::experiments::use_experiment_event;
use std::collections::BTreeMap;

#[component]
fn Cta() -> Element {
    let track = use_experiment_event();
    rsx! {
        button {
            onclick: move |_| {
                let mut props = BTreeMap::new();
                props.insert("cta".to_string(), "explore".to_string());
                track("cta_clicked", props); // → "hero_cta_clicked" { variant, cta }
            },
            "Explore"
        }
    }
}
```

`track` panics if called outside an `ExperimentTracker` (it reads context),
matching the TS hook's throw. Props are `BTreeMap<String, String>` — primitive
and PII-free.

## Bridge the injected sink to `analytics`

This is the load-bearing decoupling. `experiments` emits [`TrackedEvent`]s
through an [`ExposureSink`] (`EventHandler<TrackedEvent>`); `analytics` consumes
[`Event`](../analytics/README.md)s. **Neither library imports the other** — the
edge is in *your* app: build a Dioxus `EventHandler` that maps a `TrackedEvent`
into an `analytics` `Event` and forwards it to `use_analytics().capture(...)`.

```rust
use dioxus::prelude::*;
use ev_lib::analytics::{Event, use_analytics};
use ev_lib::experiments::{ExperimentTracker, ExposureSink, TrackedEvent};

#[component]
fn TrackedHero() -> Element {
    let analytics = use_analytics();

    // The bridge: TrackedEvent -> analytics::Event, captured through analytics.
    // This closure is the ONLY place the two libraries meet — in app code.
    let on_event: ExposureSink = use_callback(move |tracked: TrackedEvent| {
        let mut event = Event::new(tracked.name).prop("variant", tracked.variant.as_str());
        for (key, value) in tracked.props {
            event = event.prop(key, value);
        }
        analytics.capture(event);
    })
    .into();

    rsx! {
        ExperimentTracker { experiment: "hero".to_string(), variant: "b".to_string(), on_event,
            Cta {}
        }
    }
}
```

`TrackedEvent` carries `{ name, variant, props }`: merge `variant` (and the
action `props`) onto the analytics `Event` and capture it. The grep-able
guarantee holds — `experiments` has no `analytics` dependency, and vice versa.

Any handler of the right shape works — a logger, a test spy, or a custom
backend:

```rust
let on_event: ExposureSink = use_callback(|tracked: TrackedEvent| {
    dioxus::logger::tracing::info!(name = %tracked.name, variant = %tracked.variant, "ab");
})
.into();
```

## The event taxonomy

- **Exposure:** `<experiment>_exposed`, fired on mount and again when the
  tracked experiment or variant changes.
- **Action:** `<experiment>_<action>` (e.g. `hero_cta_clicked`).
- **`variant` is merged into every event** by the tracker — don't add it
  yourself.
- Action `props` are `String → String`, primitive and PII-free (same rules as
  `analytics`).

```rust
use ev_lib::experiments::{action_event, exposed_event, TrackedEvent};

assert_eq!(exposed_event("hero"), "hero_exposed");
assert_eq!(action_event("team", "cta_clicked"), "team_cta_clicked");
let ev = TrackedEvent::exposure("hero", "a");
assert_eq!(ev.name, "hero_exposed");
```

## Testing the pure core

Bucketing is deterministic given an `rng`, so the whole core tests natively with
no browser — inject a closure instead of `Math::random`:

```rust
use ev_lib::experiments::{Experiment, next_variant, pick_variant, resolve_variant};

let exp = Experiment::new(["a", "b"], [0.5, 0.5]);
assert_eq!(pick_variant(&exp, || 0.1), "a");        // below the first weight → control
assert_eq!(pick_variant(&exp, || 0.9), "b");        // above it → second variant
assert_eq!(resolve_variant(&exp, Some("zzz")), "a"); // unknown → control
assert_eq!(next_variant(&exp, "b", 1), "a");         // wraps
```

The Dioxus tracker is renderer-agnostic, so it renders under `dioxus-ssr`: mount
it with a mock `EventHandler` sink and assert the `(experiment, variant)`
context (see the tests in `ui.rs`). To assert emitted events, pass an
`EventHandler` that pushes into a shared `Vec`.

## Gotchas

- **Resolve the variant before mounting the tracker.** `ExperimentTracker` does
  not assign — pass it a variant from `assign_variant` (browser) or the control
  (SSR).
- **Exposure fires per tracked `(experiment, variant)`, not once ever.**
  Re-mounting the tracker or updating its `experiment`/`variant` props re-fires
  it (mirroring the TS effect deps) — keep one stable boundary per section.
- **`use_experiment` / `use_experiment_event` panic outside a tracker.** They
  read context; mount the tracker above any component that calls them.
- **Stickiness is the cookie, not the rng — unless you bucket by subject.**
  Seeding `rng` only makes a single pick deterministic; cross-visit consistency
  comes from the 30-day `ab_<key>` cookie. [`pick_variant_for`] is the exception:
  the hash of `(key, subject)` *is* the assignment.
- **Changing the weights, the variant list, or the `key` of a hashed experiment
  reshuffles subjects.** The hash only fixes the draw in `[0, 1)`; which variant
  that draw lands on depends on the weights.
- **The cookie helpers are `wasm32`-only.** `assign_variant`, `current_variant`,
  `read_cookie`, and `write_variant` touch `document.cookie`; on native, use the
  pure core (`resolve_variant`, `pick_variant`).
- **The analytics bridge lives in your app.** Keep the `TrackedEvent → Event`
  mapping in a consumer component; never make `experiments` depend on
  `analytics` (or the reverse).
