# ts

TypeScript libraries — one directory per package, each self-contained with its
own `package.json`, built ESM-only with `tsup` and tested with `vitest`.

```
ts/
├── architecture/      port of the `architecture` Cargo feature (DDD kernel)
├── types/             shared domain TypeObjects (PhoneNumber, Email, …) with validation
├── uikit/             port of the `uikit` Cargo feature (dep-light React UI kit)
├── analytics/         port of the `analytics` Cargo feature (PostHog product analytics)
├── error-monitoring/  port of the `error_monitoring` Cargo feature (Sentry error monitoring)
├── experiments/       port of the `experiments` Cargo feature (frontend-only A/B testing)
├── settings/          port of the `settings` Cargo feature (typed env settings)
├── marketing/         landing-page layer over uikit: motion, form harness, contact tracking
├── kitstart/          landing-site machinery: routing, places, lead funnel, SEO, Next glue
└── i18n/              five-locale i18n: registry, URL contract, ICU-subset formatter
```

Each package mirrors the _semantics_ of its Rust counterpart in
[`../rust`](../rust); see the package's own README for the Rust↔TS mapping.
Two exceptions. `i18n` has no Cargo feature yet; the planned one will read the
*same* `messages/<locale>/*.json` catalogues to localise transactional
email, so the two sides share one translation source rather than drifting.
`marketing` has none by design: it is React-only glue over the kit (motion,
forms, click tracking) for landing pages.
`node_modules/`, `dist/`, and `*.tsbuildinfo` are git-ignored.

## What is not generated

_As of 2026-10-09._

`ev_lib_gen` emits only **data** (consts, values, unions, tables, types; see
[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md#generated-typescript--ts_gen)).
That is ~1k of ~40k lines, almost all uikit class tables. The rest is
hand-written for one of four reasons:

- **A** — logic, not data: `ts_gen` cannot emit a function
- **B** — React / Next / vendor-SDK glue, with no renderer-neutral form
- **C** — no Rust twin at all
- **D** — hand-ported mirror of Rust logic, pinned by shared vectors (`tests/fixtures/`, contract tests)

```
 package      lines  what                                                   why
 ───────────────────────────────────────────────────────────────────────────────────
 uikit        14.7k  components/*.tsx (Dioxus twin; only classes shared)    A B
                     primitives/ (portal, floating, focus-scope)            B C
                     palette/ (brand palette tool)                          C
 kitstart     15.3k  core/{antispam,routing,site,place,seo}                 D  fixtures/kitstart
                     core/{lead,pricing,booking,messenger,ab,phone}         C  Rust core is non-rendering, no I/O
                     react/ · server/ · next/ · template/ · cli/ · proxy/   B C
 architecture  0.3k  kernel ports + combinators                             A  README mapping table
 types         0.9k  phone / email validation                               D  contract tests
 settings      0.7k  createSettings, redaction                              A
                     validators                                             D  contract vectors
 i18n          3.0k  format, policy                                         A
                     extract CLI, react, next                               B
                     custom registry                                        C
 experiments   1.2k  bucketing                                              A
                     hash (FNV-1a)                                          D  hash vectors
                     overrides                                              C
                     react, next                                            B
 analytics     1.4k  sink / beacon / consent                                A
                     posthog, react, next                                   B
 error-monitoring 0.6k  Sentry / React / Next wiring                        B
 marketing     2.0k  everything                                             C  Rust kitstart/contact.rs mirrors *it*
```

Known data still copied by hand:

- `STOREFRONT_GATE` / `SERVICE_AREA_GATE`: data in Rust (`PublicationPolicy { required }`),
  a `required()` function in TS, so they need the shapes reconciled first.
- Email error codes: Rust has `EmailError::code()`, TS email validation has no codes.
