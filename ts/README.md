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
└── i18n/              five-locale i18n: registry, URL contract, ICU-subset formatter
```

Each package mirrors the _semantics_ of its Rust counterpart in
[`../rust`](../rust); see the package's own README for the Rust↔TS mapping.
`i18n` is the one exception — it has no Cargo feature yet. The planned one will
read the *same* `messages/<locale>/*.json` catalogues to localise transactional
email, so the two sides share one translation source rather than drifting.
`node_modules/`, `dist/`, and `*.tsbuildinfo` are git-ignored.
