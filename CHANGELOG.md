# Changelog

All notable changes to this repo are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the packages follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This is a monorepo. The Rust crate (`ev_lib`, imported as `ev`) is versioned as a
single unit; each TypeScript package under `ts/` is versioned independently.
Entries are grouped into dated release waves, since most changes land across the
Rust crate and its TypeScript mirror at once.

| Package                            | Source                 | Version |
| ---------------------------------- | ---------------------- | ------- |
| `ev_lib` (Rust crate, `use ev::…`) | `rust/`                | 0.4.0   |
| `@evinvest/uikit`                  | `ts/uikit/`            | 0.4.0   |
| `@evinvest/analytics`              | `ts/analytics/`        | 0.1.2   |
| `@evinvest/architecture`           | `ts/architecture/`     | 0.1.0   |
| `@evinvest/error-monitoring`       | `ts/error-monitoring/` | 0.1.0   |
| `@evinvest/experiments`            | `ts/experiments/`      | 0.1.0   |

## [Unreleased]

_Nothing yet._

## 2026-07-04 — uikit 0.4.0

Rust `ev_lib` 0.4.0 · `@evinvest/uikit` 0.4.0. The EV brand chrome, mirrored
across both ports, so every surface (site_conductor, cabinet, REA) renders one
identical shell (EV-invest/site_conductor#55).

### Added

- **Brand chrome — `Header` / `Footer` / `Logo`** (Rust + TS): the site shell
  ported from site_conductor's `application/layout`. Scroll-aware fixed header
  with brand lockup, desktop nav and a built-in full-screen mobile menu; the
  12-col footer (sitemap groups, offices, optional newsletter slot, build-version
  line); the mark as a self-contained data-URI CSS mask (no asset pipeline).
  Nav items and CTAs stay app-side — the kit owns only the chrome.
    - TS: `linkComponent` prop lets Next hosts pass `next/link`; default `<a>`.
    - Dioxus: web behaviors (scroll state, body-scroll lock, Escape,
      close-on-navigate delegation) via `document::eval`, SSR-safe no-op.
## 2026-06-22 — uikit 0.3.0

Rust `ev_lib` 0.3.0 · `@evinvest/uikit` 0.3.0. The toast (`sonner`) animation
suite, mirrored across both ports. ([#12])

### Added

- **Toast / `sonner` animation suite** (Rust + TS): Sonner-style enter/exit
  animation, stacking that collapses into a pile and expands on hover/focus, and
  a host-timer-free CSS lifecycle.
    - TS: swipe-to-dismiss, hover-to-pause auto-dismiss, and persistent
      (no-duration) toasts.
    - Dioxus: stacking + expand-on-hover mirrored; auto-dismiss driven by a no-op
      CSS `ev-toast-life` animation (no host timer); the enter plays as a keyframe
      on DOM insertion (fixes the Dioxus appear).
- **Viewers** for previewing the kit against live code: a React example app
  (`ts/uikit/example`) and a Dioxus viewer crate (`rust/uikit-viewer`).

### Changed

- The Rust crate is published to crates.io as **`ev_lib`** (the `ev` name was
  taken); the import path stays **`use ev::…`**.
- Native `analytics` / `error_monitoring` backends moved to **`reqwest` 0.13**
  (rustls).
- Applied `codestyle` formatting.

### Fixed

- Toast restack settles instead of bouncing back; stacked toasts stay inside the
  viewport edge; the enter no longer couples to the restack (rapid-fire lag).

## 2026-06-20 — uikit 0.2.0

Rust `ev` 0.2.0 · `@evinvest/uikit` 0.2.0. ([#8])

### Added

- `Container` component.
- Responsive page-gutter and radius tokens.

> The Rust crate's `0.2.0` also folds in everything since `0.1.0` — the whole
> `uikit` feature and the three I/O libraries below — because the crate ships as
> one versioned unit.

## 2026-06-18 — analytics · error-monitoring · experiments 0.1.0

Three opt-in I/O libraries, each mirrored Rust ↔ TS and gated per target.
([#6], [#7])

### Added

- **`analytics`** — PostHog product analytics (`@evinvest/analytics`; Rust
  `analytics` feature). `@evinvest/analytics` **0.1.2** (2026-06-19) added the
  `/next` subpath and buffered captures behind a single pageview. ([#7])
- **`error-monitoring`** — Sentry (`@evinvest/error-monitoring`; Rust
  `error_monitoring` feature, native-only `sentry` crate).
- **`experiments`** — frontend-only, zero-runtime-dep A/B testing
  (`@evinvest/experiments`; Rust `experiments` feature), reporting exposure
  through an injected sink.

### Fixed

- `experiments`: the TS `pickVariant` zero-total fallback now matches Rust.

## 2026-06-16 — uikit 0.1.1 / 0.1.2 · public npm

The big `uikit` PR landed and the packages went public on npm. ([#2])

### Added

- npm publishing: packages scoped under **`@evinvest`** (the `@ev` scope was
  taken); `@evinvest/uikit` ships as a `"use client"` bundle for RSC / the App
  Router.

### Fixed

- `0.1.1` — Slider thumb position and Portal/floating sync; overlays no longer
  jump to the top-left.
- `0.1.2` — Slider drag from the thumb; dropped the exit animation that caused an
  overlay close flicker.

### Build

- Pinned the Rust nightly toolchain via `rust-toolchain.toml` (codestyle emits
  nightly-only features).

## 2026-06-15 — uikit 0.1.0 · architecture (TypeScript) 0.1.0

### Added

- **`@evinvest/uikit` 0.1.0** / Rust `uikit` feature — a dep-light UI kit
  mirrored Rust (Dioxus) ↔ TS (React) with a shared design-token contract:
    - Tier A — 22 static components.
    - Behaviour primitives — controllable state, portal, floating, dismiss, focus
      scope, presence, roving focus.
    - Tiers B / C / D — 41 interactive, overlay & engine components.
- **`@evinvest/architecture` 0.1.0** — the DDD kernel ported to TypeScript,
  mirroring the Rust `architecture` feature's semantics (zero runtime deps,
  I/O-free).

### Build

- Adopted the `v_flakes` org Nix toolchain; relocated the `ev` crate into `rust/`
  under a root workspace; configured prettier; added the docs/README fragments
  and per-package READMEs.

## 2026-06-14 — Initial scaffold

Rust `ev` 0.1.0.

### Added

- Scaffolded the `ev` shared-libs monorepo with the **`architecture`** DDD kernel
  as the first Rust feature — zero-dep, I/O-free, and `wasm32`-safe (host-only id
  minting gated behind `cfg(not(target_arch = "wasm32"))`).

[#2]: https://github.com/EV-invest/lib/pull/2
[#6]: https://github.com/EV-invest/lib/pull/6
[#7]: https://github.com/EV-invest/lib/pull/7
[#8]: https://github.com/EV-invest/lib/pull/8
[#12]: https://github.com/EV-invest/lib/pull/12

