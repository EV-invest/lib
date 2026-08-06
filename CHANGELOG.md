# Changelog

All notable changes to this repo are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the packages follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This is a monorepo. The Rust crate (`ev_lib`) is versioned as a single unit; each
TypeScript package under `ts/` is versioned independently.
Entries are grouped into dated release waves, since most changes land across the
Rust crate and its TypeScript mirror at once.

| Package                      | Source                 | Version |
| ---------------------------- | ---------------------- | ------- |
| `ev_lib` (Rust crate)        | `rust/`                | 0.6.6   |
| `@evinvest/uikit`            | `ts/uikit/`            | 0.8.0   |
| `@evinvest/types`            | `ts/types/`            | 0.2.0   |
| `@evinvest/settings`         | `ts/settings/`         | 0.2.0   |
| `@evinvest/analytics`        | `ts/analytics/`        | 0.1.2   |
| `@evinvest/architecture`     | `ts/architecture/`     | 0.1.0   |
| `@evinvest/error-monitoring` | `ts/error-monitoring/` | 0.1.0   |
| `@evinvest/experiments`      | `ts/experiments/`      | 0.1.0   |

## [Unreleased]

### Added

- **`settings` — deployment-profile guards (both ports)**: `#[required_in("production")]`
  (Rust) / `requiredIn(v, 'production')` (TS) turns an optional or defaulted
  setting back into a boot failure in the named profiles. The setting that hurts
  is not the missing required one — that already stops the boot — but the
  optional whose absence is a *silent* no-op: no `SMTP_HOST` means mail is logged
  instead of sent, no `SENTRY_DSN` means the alerts never arrive. On a defaulted
  field the dev-shaped default stops applying there, so the value must be
  explicit. The profile is the canonical `APP_ENV` read from the same source
  (unset ⇒ `development`, so an unconfigured environment is never mistaken for
  production); TS additionally takes a `profile` override for Next.js, where
  `NODE_ENV` already owns that name. Refused at compile time (Rust) / declaration
  time (TS) on a setting that is already required everywhere.
- **`settings` — `required_var_names(profile)`** (Rust): the deploy-time
  checklist, so a preflight can diff a Secret's keys against what the image
  actually needs instead of discovering the gap as a CrashLoopBackOff.
- **`settings` — `or_exit` / `orExit`**: fail a boot with `EX_CONFIG` (78)
  instead of a nondescript 1, so "the config is wrong, a restart cannot help" is
  distinguishable from the dependency blip a restart does fix.
- **`settings::drift`** (Rust): detects that the source a process was configured
  from has moved on without it. Polling `std::env` is useless by construction —
  it is fixed at `exec`, and a runtime that injected values through `envFrom`
  never revisits them — so the watcher takes an **injected** source, to be
  pointed at something that does move (a Secret mounted as files, a rendered
  dotenv). The baseline is boot, not the previous poll, so a stale process keeps
  reporting until it is replaced. It only detects: nothing is applied in place,
  because a process that reconfigures itself erases the gitops env edit that was
  the audit trail. Snapshots hold hashes and a change is a name plus a verb, so
  the whole path is safe to log.

- **`error_monitoring::Config.service`** (Rust, native): names the service on
  every event and transaction as a `service` tag. A Sentry project is a DSN, so
  sibling services commonly share one and were separable only by hostname in the
  issue list. Set from the same value as `OTEL_SERVICE_NAME` so an issue, a trace
  and a log line agree. It is a scope tag rather than a `before_send` hook
  because `before_send` never sees transactions, which need the name just as
  much. **Breaking:** `Config` gains a public field, so struct literals must add
  `service` (`None` keeps the old behaviour).

### Fixed

- `error_monitoring` (Rust, native): a malformed or empty `Config.dsn` now
  disables reporting instead of panicking at boot, matching the wasm and TS
  ports' documented no-op contract — a monitoring typo no longer crash-loops
  the service.
- `uikit` (**both ports**): `CommandEmpty` renders only when a query matched
  nothing. It gated on "is there a query", so "No results found." showed next to
  matching items; items now register their value through the Command context, so
  the empty state can tell "nothing matched" from "nothing is here". The query is
  trimmed once and shared by the item filter and the empty-state gate, so blank
  input is uniformly not a search (it previously hid every item **and** the empty
  state, leaving a blank palette).

## 2026-07-07 — uikit 0.6.0 · Rust brand-chrome catch-up

Rust `ev_lib` 0.5.0 · `@evinvest/uikit` 0.6.0. The Dioxus port catches up to two
TypeScript uikit releases — uikit 0.5.0 (Header density variants) and 0.6.0 (the
shared status pages), both 2026-07-06 — so both ports render one identical shell
again. Those two TS releases are folded into this single wave; the crate ships as
one versioned unit, so `ev_lib` 0.5.0 covers both.

### Added

- **Status pages — `StatusScreen` + `NotFound` / `Forbidden` / `ServerError`**
  (Rust; TS since uikit 0.6.0, 2026-07-06): the shared 404 / 403 / 500 surface
  ported from site_conductor — a centred hero (skyline-crown mark, mono eyebrow,
  Playfair code, italic-accent headline, CTAs) with a per-status accent
  (`StatusAccent`: teal / gold / red / blue). The ready-made pages bake in their
  copy; a host passes only hrefs. `ServerError`'s retry runs a host `reset` or
  reloads. `status_button_class` is exposed for bespoke CTAs.
    - TS: `linkComponent` routes CTAs through `next/link` for soft nav.
    - Dioxus: renders plain `<a>` (a full document load, as an error page wants —
      no `linkComponent` equivalent) and reloads via `document::eval`.
- **`Header` — `compact` variant + `hideNav`** (Rust; TS since uikit 0.5.0,
  2026-07-06): `variant="compact"` (Rust `HeaderVariant::Compact`) is a fixed
  short opaque bar for app surfaces — no scroll growth, a known 4rem height a
  sticky sidebar can butt flush against; `marketing` (default) keeps the
  scroll-aware bar. `hideNav` (`hide_nav`) drops the nav — desktop row + mobile
  menu — keeping just the lockup and CTA.

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

