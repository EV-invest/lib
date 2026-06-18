# @evinvest/error-monitoring

A **vendor-neutral** error-monitoring toolkit — the TypeScript mirror of the
`error_monitoring` feature of the [`ev`](https://github.com/EV-invest/lib) Rust
crate. The core is a tiny injectable [`ErrorSink`](#core----vendor-neutral) port
that imports **no** monitoring SDK; concrete [Sentry](https://sentry.io)
adapters for React, Node/Edge, and Next.js live behind separate subpath exports
so you pay only for what you import.

> **Dep-honesty.** The package declares **zero runtime `dependencies`**. The
> Sentry SDKs (`@sentry/react`, `@sentry/node`, `@sentry/nextjs`), `next`, and
> `react` are all **optional `peerDependencies`** — install only the ones the
> subpaths you use require. The `.` core needs none of them.

## Install

Published to the public npm registry:

```sh
npm i @evinvest/error-monitoring
# plus the peers for the subpaths you use, e.g.:
npm i @sentry/react react          # for ./react
npm i @sentry/node                 # for ./node
npm i @sentry/nextjs next react    # for ./next (+ ./react provider)
```

Requires Node ≥ 20. `dist/` is built on publish, not committed.

## Subpaths & quick start

### `.` — vendor-neutral core

Server-safe, no SDK. The seam your app code depends on.

```ts
import { createSentrySink, noopErrorSink, defaultTracesSampleRate } from "@evinvest/error-monitoring";
import type { ErrorSink, SentryInitOptions } from "@evinvest/error-monitoring";
import * as Sentry from "@sentry/node";

const sink: ErrorSink = process.env.SENTRY_DSN
  ? createSentrySink(Sentry)   // reportError(err, ctx) → captureException(err, { extra: ctx })
  : noopErrorSink();

sink.reportError(new Error("boom"), { feature: "checkout" });
```

### `./react` — client provider + boundary (`"use client"`)

```tsx
import { ErrorMonitoringProvider, ErrorBoundary } from "@evinvest/error-monitoring/react";
import * as Sentry from "@sentry/react";

// Mount once near the root — boots browser Sentry (DSN ← NEXT_PUBLIC_SENTRY_DSN).
<ErrorMonitoringProvider>
  <ErrorBoundary sentry={Sentry} fallback={(error, reset) => (
    <div role="alert"><p>{error.message}</p><button onClick={reset}>Retry</button></div>
  )}>
    <App />
  </ErrorBoundary>
</ErrorMonitoringProvider>
```

`ErrorBoundary` is decoupled from any design system: no `@evinvest/uikit`, no
`lucide-react`, no Tailwind. Bring your own fallback UI.

### `./node` — server / edge init

```ts
import { initServer, initEdge } from "@evinvest/error-monitoring/node";

await initServer({}); // dsn ← SENTRY_DSN, tracesSampleRate 0.1 prod / 1.0 else
await initEdge({});    // dsn ← SENTRY_DSN, tracesSampleRate 0 (edge)
```

### `./next` — build/server wiring (no banner)

```ts
// instrumentation.ts
import { register, captureRequestError } from "@evinvest/error-monitoring/next";
export { register };
export const onRequestError = captureRequestError;

// next.config.ts
import { withSentry } from "@evinvest/error-monitoring/next";
export default await withSentry({ reactStrictMode: true }, { /* org, project, … */ });
```

See [`GUIDE.md`](./GUIDE.md) for the full Next.js cookbook.

## Rust ↔ TS parity

The Rust crate is the source of truth; this package preserves its _semantics_
while reading like idiomatic TS. The load-bearing mapping is the report seam:

| Concept | meaning |
| --- | --- |
| `reportError(err, ctx)` | `Sentry.captureException(err, ctx ? { extra: ctx } : undefined)` |
| `ErrorSink` | the vendor-neutral port; vendor injected via `createSentrySink` |
| client `tracesSampleRate` | `0.1` in production, `1.0` elsewhere |
| edge `tracesSampleRate` | `0` (tracing disabled) |
| replays | `replaysOnErrorSampleRate: 1.0`, `replaysSessionSampleRate: 0.05`, browser-only |

Env-var conventions: browser `NEXT_PUBLIC_SENTRY_DSN` / `NEXT_PUBLIC_APP_ENV`;
server & edge `SENTRY_DSN` / `APP_ENV`; both default `environment` to
`"development"`.

## Limitations

- **Sentry-shaped, not multi-vendor out of the box.** The core is vendor-neutral
  (`ErrorSink` + structural `SentryLike`), but the bundled adapters target the
  Sentry SDKs. To use another backend, implement `ErrorSink` yourself — the
  adapters are thin enough to copy.
- **Replay & browser integrations** are added only client-side
  (`typeof window !== "undefined"`); they never run on the server.
- **Source maps** are uploaded by `withSentry` only when the build-time env vars
  (`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`) are set; otherwise stack
  traces stay minified. See [`GUIDE.md`](./GUIDE.md) gotchas.
- **No-op without a DSN.** Every `init` is a no-op when its DSN env var is unset,
  so local dev works with no configuration.

## Develop

```sh
npm i
npm run typecheck   # tsc --noEmit + tsc -p tsconfig.core.json --noEmit (no-DOM core)
npm run test        # vitest (node + jsdom projects, split by file suffix)
npm run build       # tsup → dist/ (ESM + d.ts); only ./react carries "use client"
```

The Rust counterpart is verified from the repo root:

```sh
cargo test  -p ev --features error_monitoring
cargo clippy -p ev --features error_monitoring --all-targets -- -D warnings
```
