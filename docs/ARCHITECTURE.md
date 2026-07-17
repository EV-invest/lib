# Architecture

`EV-invest/lib` is the organisation's **shared-library monorepo**. Its centre of
gravity is one thing expressed in two languages: a generic, I/O-free **DDD
tactical kernel**. The Rust crate is the source of truth; the TypeScript packages
mirror its _semantics_ idiomatically.

## Layout

```
lib/                 (repo: EV-invest/lib)
├── Cargo.toml       thin virtual workspace — anchors the crate at the repo root
├── rust/            the crate (sources); one library per Cargo feature
│   ├── Cargo.toml
│   ├── src/{lib.rs, architecture/, uikit/, analytics/, error_monitoring/, experiments/, settings/, otel/}
│   └── tests/
├── ts/              TypeScript packages, one directory per library
│   ├── architecture/
│   ├── uikit/
│   ├── analytics/
│   ├── error-monitoring/
│   ├── experiments/
│   └── settings/
├── docs/
│   ├── ARCHITECTURE.md          (this file)
│   └── .readme_assets/          README fragments (README.md is generated)
└── flake.nix        v_flakes dev shell + generated CI / README / configs
```

Each language owns a top-level directory (`rust/`, `ts/`) so neither toolchain
trips over the other. The shared tooling (CI, formatters, lint config) drives
`cargo` from the repo root, so a **thin virtual workspace** at `./Cargo.toml`
anchors the crate there while its sources stay in `rust/`. The crate is still a
single package: a consumer's git dependency resolves it **by name**, regardless
of the subdirectory.

```toml
# native
ev_lib = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["architecture"] }
```

## The `architecture` kernel

Generic DDD building blocks every bounded context implements. Deliberately
I/O-free and `wasm32`-safe; concrete adapters (sqlx, an external ledger, …) live
in the consuming service.

| Trait / type (Rust)           | TypeScript form                   | Role                                                                             | Object-safe (Rust)?  |
| ----------------------------- | --------------------------------- | -------------------------------------------------------------------------------- | -------------------- |
| `Id<Tag, U>` / `Identifier`   | branded primitive `Id<Tag, U>`    | typed identity — a `TransferId` can't be passed where an `AccountId` is expected | no (always concrete) |
| `Entity` / `AggregateRoot`    | `interface`                       | stable identity; the transactional consistency boundary                          | no                   |
| `Repository` / `Reader`       | `interface` (phantom-bound)       | marker ports tying a port to one aggregate (CRUD lives on the leaf)              | yes                  |
| `Gateway`                     | `interface` (marker)              | anti-corruption boundary to an external transactional system                     | yes                  |
| `UnitOfWork`                  | `interface` (`Promise`)           | one atomic transaction; `commit`/`rollback` are terminal                         | yes                  |
| `DomainEvent` / `EmitsEvents` | discriminated union / `interface` | past-tense facts; defined, not yet wired (future outbox)                         | no                   |
| `Specification<T>`            | `interface` + combinators         | composable in-memory predicate                                                   | yes (core method)    |

## Consistency boundaries — Repository vs Gateway

Two independent consistency boundaries, encoded in the type system:

- A `UnitOfWork` is exactly one SQL (e.g. Postgres) transaction; repositories
  enroll in it.
- A `Gateway` is an external system (a ledger, a payment API). It is **never** a
  `Repository` and is **unreachable** from a `UnitOfWork` (there is no
  `UnitOfWork::gateway()`), so the type system forbids enrolling it in a local
  transaction. It owns its own identity, invariants, and atomicity.

Any operation spanning both is an explicit application-layer saga, not an atomic
transaction. The intended future mechanism is a `DomainEvent` written to an
outbox **inside the same `UnitOfWork`** as the state change — which is why
`DomainEvent` exists but is unwired today.

## The `uikit` library

A **dep-light** UI kit — 63 shadcn-semantics components — shipped as the Rust
feature `uikit` (`ev_lib::uikit`, Dioxus) and the TS package `@evinvest/uikit` (React). It
is the kit consolidated out of the EV-invest apps (`cabinet`'s Dioxus components
and `landing`'s React bricks), so both apps depend on one versioned source.

Unlike the kernel, `uikit` is **not** zero-dep and **not** I/O-free — a UI kit
inherently carries a renderer (`dioxus` / `react`) and styling helpers. What it
keeps from the repo's discipline:

- **Dep-light:** no `@radix-ui`, no `class-variance-authority`, no icon/charting/
  date/toast libraries. Variants are `enum`+`match` (Rust) / `as const` maps (TS)
  fused by the `cn!`/`cn` helper; overlay behaviour is hand-rolled in
  `primitives/`; icons are inline SVG.
- **One canon, two ports:** the Rust feature is the source of truth; canonical
  Tailwind class strings are identical per element across Rust and TS. Variants
  are the **superset** of the two original sources.
- **`tokens.css` is the contract:** the design tokens (CSS custom properties +
  Tailwind `@theme inline`) ship from both packages in byte parity. Every
  component class references a token; a consumer must `@import` `tokens.css`.
- **CSS is generated at runtime by the v4 browser CDN**, which DOM-scans the
  live page — so class strings may be composed dynamically (`format!("h-{}", n)`),
  e.g. the shared `Size` whose `scale()` magnitude each component applies on its
  own axis (`h-`/`size-`/`min-w-`). A consumer on a *static* Tailwind build must
  likewise DOM-scan or safelist the kit's magnitudes.

Because Dioxus has no renderer-agnostic portal and layout measuring is host-only,
the Rust overlays/engines carry documented fidelity gaps (inline positioning
instead of portals, keyboard instead of pointer-drag, no recharts/embla/vaul) —
the full list is in [`ts/uikit/README.md`](../ts/uikit/README.md#limitations).

## The I/O libraries — analytics, error_monitoring, experiments

Three frontend-facing libraries that, unlike the kernel, **do network I/O**.
Each is a Cargo feature on the crate and an npm package under `ts/`, mirroring the
other's semantics.

| Cargo feature      | npm package                  | Purpose                        | Network I/O? | wasm-safe? |
| ------------------ | ---------------------------- | ------------------------------ | ------------ | ---------- |
| `analytics`        | `@evinvest/analytics`        | PostHog product analytics      | yes          | yes        |
| `error_monitoring` | `@evinvest/error-monitoring` | Sentry error monitoring        | yes          | yes        |
| `experiments`      | `@evinvest/experiments`      | A/B testing (frontend-only)    | via the host | yes        |

The property taxonomy is deliberate:

- **I/O-free** is a property of the **kernel only**. The kernel ships zero
  runtime deps and touches no host.
- **wasm-safe** holds for the kernel **and** `uikit` **and** these three.
- **"no I/O" is *not*** a property of these three. Network I/O is their purpose:
  `analytics` POSTs PostHog events, `error_monitoring` reports to Sentry. Asking
  them to be I/O-free would defeat them.

Doing I/O while staying wasm-safe is reconciled by **per-target dep gating**.
Native builds use `reqwest`(rustls) / the `sentry` crate; wasm builds use
pure-Rust HTTP (the `reqwest` fetch backend plus `web-sys`/`js-sys`/`wasm-bindgen`),
selected through `[target.'cfg(target_arch="wasm32")']` tables behind the `wasm`
feature. `error_monitoring`'s native `sentry` crate is native-only and is never
linked into a wasm build. `experiments` is frontend-only and reports exposure
through an **injected sink** — it never imports `analytics`, so there is no
cross-library coupling. None of this touches the kernel, which stays I/O-free.

The TS packages expose backends through subpath exports — analytics
`.`/`./react`/`./node`; error-monitoring `.`/`./react`/`./node`/`./next`;
experiments `.`/`./react`/`./next` — with the vendor SDKs as optional
`peerDependencies`.

## The `settings` library

Typed env settings — the `settings` Cargo feature (`ev_lib::settings`, a
`settings!` macro) and `@evinvest/settings` (`createSettings`). Zero runtime
deps on both sides, like the kernel — but not I/O-free: reading the process
environment is its purpose (no files, no network). Env-only by design: no
config-file layer, no hot reload (a process's environment is fixed at `exec`).
The shared semantics — SCREAMING_SNAKE naming, required-by-default,
empty-string-is-unset, the bool/list parsing rules, aggregate error reporting,
secret redaction — are pinned by mirrored contract-test vectors in both suites.
`presets` fixes the org-canonical shared names (`POSTHOG_KEY`, `SENTRY_DSN`,
`APP_ENV`) once, on both sides.

Secrets deliberately live **outside** the library: sops-encrypted env files
(age keys) are committed to each consuming repo and decrypted only at the
boundary — direnv/`sops exec-env` in dev shells, `SOPS_AGE_KEY` in CI — so
apps stay sops-unaware and the library never links a decryption stack. The
workflow is documented in
[`rust/src/settings/GUIDE.md`](../rust/src/settings/GUIDE.md#secrets-the-sops-boundary).

## Cross-language parity

The TS packages are not line-by-line translations; they preserve the _semantics_
of the Rust public API while reading like idiomatic TS. The full mapping and the
intentional divergences (errors, numbers, serialization) are the source of truth
in [`ts/architecture/README.md`](../ts/architecture/README.md). The load-bearing
ones:

- **Numbers** — `u64`/`u128` and anything precision-sensitive map to `bigint`,
  never `number` (an f64 loses precision past 2⁵³). Numeric ids are `bigint`.
- **Errors** — `Option<T>` → `T | undefined`; the one fallible async op
  (`UnitOfWork`) rejects its `Promise` (throws) rather than returning a `Result`.
- **Typed ids** — branded primitives, so `===` and `Map`/`Set` keys work
  natively; no `underlying()` indirection.

## Source of truth

- The **Rust crate is canonical**. When the kernel's behaviour changes, change
  Rust first, then bring the TS port back into parity. The TS README's mapping
  table is the contract between the two.
- A new library = a Rust module behind a Cargo feature **and** (if it has a TS
  consumer) a package under `ts/`. Keep the feature name and the package name in
  step, following the naming convention: **snake_case in Rust, kebab-case in TS;
  identical when single-token** (`architecture` ↔ `ts/architecture`;
  `error_monitoring` ↔ `ts/error-monitoring`).

