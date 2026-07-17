# ts

TypeScript libraries — one directory per package, each self-contained with its
own `package.json`, built ESM-only with `tsup` and tested with `vitest`.

```
ts/
├── architecture/      port of the `architecture` Cargo feature (DDD kernel)
├── uikit/             port of the `uikit` Cargo feature (dep-light React UI kit)
├── analytics/         port of the `analytics` Cargo feature (PostHog product analytics)
├── error-monitoring/  port of the `error_monitoring` Cargo feature (Sentry error monitoring)
├── experiments/       port of the `experiments` Cargo feature (frontend-only A/B testing)
└── settings/          port of the `settings` Cargo feature (typed env settings)
```

Each package mirrors the _semantics_ of its Rust counterpart in
[`../rust`](../rust); see the package's own README for the Rust↔TS mapping.
`node_modules/`, `dist/`, and `*.tsbuildinfo` are git-ignored.
