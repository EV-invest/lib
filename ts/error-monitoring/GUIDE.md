# Cookbook — `@evinvest/error-monitoring`

A task-oriented guide. For the API surface and parity table, see
[`README.md`](./README.md).

## 1. Wire Sentry into a Next.js App Router app

Install the peers:

```sh
npm i @evinvest/error-monitoring @sentry/nextjs @sentry/react next react react-dom
```

`@sentry/nextjs` re-exports the browser, node, and build APIs, so it satisfies
every subpath here. You may instead install `@sentry/node` + `@sentry/react`
separately if you prefer narrower deps.

### 1a. `instrumentation.ts` — runtime init + request errors

Next.js calls `register()` once per server process and `onRequestError` for
unhandled Server Component / Route Handler errors.

```ts
// instrumentation.ts
import { register as initMonitoring, captureRequestError } from "@evinvest/error-monitoring/next";

export function register() {
  return initMonitoring();
}

// Wires Sentry into Next's built-in server-error hook — no manual try/catch.
export const onRequestError = captureRequestError;
```

`register()` switches on `process.env.NEXT_RUNTIME`: `"nodejs"` →
`initServer`, `"edge"` → `initEdge`. Each branch dynamic-imports only the code
it needs.

### 1b. `next.config.ts` — build-time integration

```ts
// next.config.ts
import { withSentry } from "@evinvest/error-monitoring/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default await withSentry(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: {
    // Delete local source maps after upload so they don't ship in the bundle.
    filesToDeleteAfterUpload: [".next/**/*.map"],
  },
});
```

`withSentry` is async (it dynamic-imports `withSentryConfig`); `await` it at the
top level of the config module, or wrap with a `.then` if you prefer.

### 1c. Mount the client provider

```tsx
// app/layout.tsx
import { ErrorMonitoringProvider } from "@evinvest/error-monitoring/react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ErrorMonitoringProvider>{children}</ErrorMonitoringProvider>
      </body>
    </html>
  );
}
```

The provider boots browser Sentry on mount (DSN ← `NEXT_PUBLIC_SENTRY_DSN`) and
adds the session-replay integration when running in the browser. Turbopack
cannot inject the client config via webpack entry points, so this explicit mount
replaces the classic `sentry.client.config.ts` auto-import. By default it lazily
`import("@sentry/react")`; pass `sentry={Sentry}` to control the instance.

### 1d. Guard subtrees with `ErrorBoundary`

```tsx
"use client";
import { ErrorBoundary } from "@evinvest/error-monitoring/react";
import * as Sentry from "@sentry/react";

export function Guarded({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      sentry={Sentry}
      onError={(err, stack) => console.warn("boundary caught", err, stack)}
      fallback={(error, reset) => (
        <div role="alert">
          <h2>Something went wrong.</h2>
          <pre>{error.stack}</pre>
          <button onClick={reset}>Try again</button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
```

On a throw the boundary reports `reportError(error, { componentStack })` to the
resolved sink (`sink` → `sentry` → noop), invokes `onError`, then renders
`fallback`. `reset` clears the error and re-renders the children.

### 1e. `app/global-error.tsx`

Next's top-level error handler must report and render its own `<html>`:

```tsx
// app/global-error.tsx
"use client";
import { createSentrySink } from "@evinvest/error-monitoring";
import * as Sentry from "@sentry/react";
import { useEffect } from "react";

const sink = createSentrySink(Sentry);

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => sink.reportError(error), [error]);
  return (
    <html>
      <body>
        <h1>An unexpected error occurred.</h1>
      </body>
    </html>
  );
}
```

## 2. Server / edge init outside Next.js

```ts
import { initServer, initEdge } from "@evinvest/error-monitoring/node";

// Long-running Node service
await initServer({ environment: "production" });

// Edge worker — tracing disabled by default
await initEdge({});
```

Both read `SENTRY_DSN` / `APP_ENV` when the corresponding option is omitted.
`initServer` defaults `tracesSampleRate` to `0.1` in production / `1.0`
otherwise; `initEdge` defaults it to `0`.

## 3. The vendor-neutral `.` sink — and swapping vendors

Application code should depend on the `ErrorSink` interface, never on a vendor:

```ts
import type { ErrorSink } from "@evinvest/error-monitoring";

export function checkout(sink: ErrorSink) {
  try {
    placeOrder();
  } catch (e) {
    sink.reportError(e as Error, { feature: "checkout" });
    throw e;
  }
}
```

Construct the concrete sink once, at the composition root:

```ts
import { createSentrySink, noopErrorSink } from "@evinvest/error-monitoring";
import * as Sentry from "@sentry/node";

export const sink = process.env.SENTRY_DSN
  ? createSentrySink(Sentry)
  : noopErrorSink();
```

**Swapping vendors** is a one-line change: anything with a structural
`captureException(error, hint?)` works with `createSentrySink`. For a backend
without that shape, implement `ErrorSink` directly:

```ts
import type { ErrorSink } from "@evinvest/error-monitoring";

const customSink: ErrorSink = {
  reportError(error, context) {
    myBackend.log({ message: error.message, stack: error.stack, ...context });
  },
};
```

## 4. Testing

The package ships split test environments (see `vitest.config.ts`):

- `*.node.test.ts` → node — for the core sink and the `register()` runtime
  switch (mock `@sentry/node` and assert the right branch / sample rate).
- `*.react.test.tsx` → jsdom — for `ErrorBoundary` (render a throwing child,
  assert the sink/`onError` receive `{ componentStack }` and the fallback shows).

The core sink test asserts the canonical mapping: `reportError(err, ctx)` →
`captureException(err, { extra: ctx })`, and `undefined` hint when no context.

## 5. Gotchas

- **Source maps.** `withSentry` only uploads (and deletes) source maps when
  `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are present at build
  time. Without them your production stack traces are minified.
- **DSN env vars differ by runtime.** The browser reads
  `NEXT_PUBLIC_SENTRY_DSN` (must be `NEXT_PUBLIC_`-prefixed to reach the client
  bundle); the server and edge read `SENTRY_DSN`. Setting only one leaves the
  other side unmonitored.
- **`environment`.** Browser ← `NEXT_PUBLIC_APP_ENV`, server/edge ← `APP_ENV`;
  both default to `"development"`. Set them in production or every event is
  tagged `development`.
- **Replay is browser-only.** The session-replay integration is added only when
  `typeof window !== "undefined"`; never expect replays from server init.
- **No DSN, no-op.** Every init silently does nothing without a DSN — handy
  locally, but double-check the env var name if production looks silent.
- **`./next` must stay server-side.** It is not a `"use client"` module; import
  it only from `instrumentation.ts` / `next.config`, never from a client
  component.
