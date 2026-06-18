# @evinvest/analytics

A **vendor-neutral, dep-light** product-analytics sink — the TypeScript mirror
of the `analytics` feature of the [`ev`](https://github.com/EV-invest/lib) Rust
crate (`ev::analytics`). Code against one tiny seam — `AnalyticsSink` — and pick
your vendor at the edges. The default vendor is PostHog, but the **core imports
no SDK**: you inject the PostHog instance, or bring your own sink.

"Dep-light" means: **no runtime `dependencies`.** The analytics SDKs
(`posthog-js`, `posthog-node`) and `react` are all **optional peers** — you only
install the ones you use, and the entry that needs them loads them
(`./react` `import()`s `posthog-js` lazily; `./node` references `posthog-node`
types only). The SDK-free [`.`](#-core) entry is safe to import on a server, an
edge runtime, or in a worker.

> Like `@evinvest/uikit`, this package has more than zero deps — analytics needs
> a vendor SDK *somewhere*. The trick is that they are **optional peers**, never
> bundled, and never reached by the core. See the repo `AGENTS.md`.

## Install

Published to the public npm registry:

```sh
npm i @evinvest/analytics
# plus whichever vendor SDK(s) you use:
npm i posthog-js     # for ./react (browser)
npm i posthog-node   # for ./node  (server)
```

Requires Node ≥ 20. `dist/` is built on publish, not committed.

## `.` — core

Server-safe. No React, no DOM, no SDK. Inject a PostHog instance into the
vendor-neutral factory, or use `noopSink()`.

```ts
import posthog from "posthog-js";
import {
  createPostHogSink,
  noopSink,
  type AnalyticsSink,
} from "@evinvest/analytics";

const sink: AnalyticsSink = process.env.NEXT_PUBLIC_POSTHOG_KEY
  ? createPostHogSink(posthog, {
      key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    })
  : noopSink();

sink.capture("hero_cta_clicked", { variant: "b" });
```

`createPostHogSink` is **lazy + idempotent**: it calls `posthog.init` once, on
the first `capture` that has a key, with `person_profiles: "identified_only"`.
**No key → silent no-op** (local dev and tests stay quiet).

## `./react` — provider + hooks

`"use client"` bundle. `import("posthog-js")` is dynamic, so importing this never
pulls the SDK onto the server render path.

```tsx
// app/layout.tsx
import { PostHogProvider } from "@evinvest/analytics/react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
```

```tsx
"use client";
import { useCapture, useAnalytics } from "@evinvest/analytics/react";

function Cta() {
  const capture = useCapture();        // throws if no provider
  return <button onClick={() => capture("hero_cta_clicked")}>Invest</button>;
}

function Section() {
  const capture = useAnalytics();      // no-ops silently if no provider
  React.useEffect(() => capture("section_viewed", { id: "pricing" }), [capture]);
  return null;
}
```

`PostHogProvider` reads `apiKey` / `host` from props, falling back to
`process.env.NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST`. With no key
it mounts a `noopSink` and never loads `posthog-js`.

## `./node` — server sink

Server-only (no banner). Wraps a `posthog-node` client; only its *types* are
referenced.

```ts
import { PostHog } from "posthog-node";
import { createServerSink, shutdown } from "@evinvest/analytics/node";

const client = new PostHog(process.env.POSTHOG_KEY!, {
  host: "https://us.i.posthog.com",
});
const sink = createServerSink(client, { distinctId: userId });
sink.capture("checkout_order_placed", { amount: 42 });
await shutdown(client); // flush before exit
```

See [`GUIDE.md`](./GUIDE.md) for the full cookbook (App Router wiring, event
taxonomy, server capture, custom sinks, testing).

## Rust ↔ TS parity

The Rust crate is the source of truth; this package preserves its *semantics*
while reading like idiomatic TS. The seam is the same on both sides.

| Concept | Rust (`ev::analytics`) | TS (`@evinvest/analytics`) |
| --- | --- | --- |
| the seam | `AnalyticsSink` trait | `AnalyticsSink` interface |
| vendor factory | `posthog_sink(client, cfg)` | `createPostHogSink(posthog, config)` |
| disabled sink | `noop_sink()` | `noopSink()` |
| no-key behavior | silent no-op | silent no-op |

## Limitations

- **PostHog defaults are fixed.** `person_profiles` is always
  `"identified_only"`; `capture_pageview` defaults to `true` (overridable).
  Other PostHog init options are not surfaced — build the sink yourself if you
  need them.
- **No-op-without-key applies to the browser path only.** `./node`'s
  `createServerSink` forwards unconditionally; guard construction yourself or
  fall back to `noopSink()`.
- **Vendor-neutral core, PostHog at the edges.** Other vendors are reachable by
  implementing `AnalyticsSink` directly, but only a PostHog factory ships.

## Develop

```sh
npm i
npm run typecheck   # tsc --noEmit && tsc -p tsconfig.core.json --noEmit
npm run test        # vitest (node + jsdom projects)
npm run build       # tsup → dist/ (ESM + d.ts; react.js is "use client")
```

The Rust counterpart is verified from the repo root:

```sh
cargo test  -p ev --features analytics
cargo clippy -p ev --features analytics --all-targets -- -D warnings
cargo check -p ev --features "analytics wasm" --target wasm32-unknown-unknown
```
