# @evinvest/analytics — cookbook

End-to-end recipes for every subpath. The mental model: you always talk to one
seam — `AnalyticsSink` (`{ capture(event, props?) }`) — and choose a vendor at
the edges. The core never imports an SDK; the browser and server entries supply
the concrete vendor.

- [Mental model](#mental-model)
- [Environment variables](#environment-variables)
- [The event taxonomy](#the-event-taxonomy)
- [Recipe: Next.js App Router](#recipe-nextjs-app-router)
- [Recipe: capturing events](#recipe-capturing-events)
- [Recipe: server-side capture (`./node`)](#recipe-server-side-capture-node)
- [Recipe: the SDK-free core (`.`)](#recipe-the-sdk-free-core-)
- [Recipe: bring your own sink](#recipe-bring-your-own-sink)
- [Recipe: testing](#recipe-testing)
- [Gotchas](#gotchas)

## Mental model

```
                        AnalyticsSink
                  { capture(event, props?) }
                            ▲
        ┌───────────────────┼────────────────────┐
        │                   │                     │
  createPostHogSink   PostHogProvider       createServerSink
  (.  — inject SDK)   (./react — browser)   (./node — server)
        │                   │                     │
    posthog-js (you)   posthog-js (lazy)     posthog-node (you)
```

Pick the entry that matches the runtime. They all hand you the same
`capture(event, props?)` call.

## Environment variables

| Var | Read by | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_POSTHOG_KEY` | `./react` `PostHogProvider` (fallback for `apiKey`) | Browser project key. **Absent → no-op**: provider serves a `noopSink` and never loads `posthog-js`. |
| `NEXT_PUBLIC_POSTHOG_HOST` | `./react` `PostHogProvider` (fallback for `host`) | Browser ingestion host. Defaults to `https://us.i.posthog.com`. |

The `NEXT_PUBLIC_` prefix means these are inlined into the client bundle by
Next.js — keep them non-secret (a PostHog *project* key is publishable). For
`./node`, read your own server env (e.g. `POSTHOG_KEY`) and pass it to
`new PostHog(...)`; this package does not read server env for you.

## The event taxonomy

- **Name:** `snake_case`, scoped `<surface>_<thing>_<action>`. Examples:
  `hero_cta_clicked`, `calculator_submitted`, `checkout_order_placed`.
- **Names are the contract.** Dashboards key off them — renames break analysis.
- **Props:** primitive values only (`string` | `number` | `boolean`).
- **Never PII.** No names, emails, or free-text the user typed. Pass enums and
  flags, not raw input.

```ts
capture("calculator_submitted", { tier: "pro", amount: 1200, recurring: true }); // good
capture("calculator_submitted", { email: user.email });                          // NEVER
```

## Recipe: Next.js App Router

Mount the provider **once**, high in the tree. It is a `"use client"` component;
the SDK loads lazily in an effect, so dropping it into a Server Component layout
is fine.

```tsx
// app/layout.tsx
import { PostHogProvider } from "@evinvest/analytics/react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
```

Override key/host explicitly when you don't want the env fallback:

```tsx
<PostHogProvider apiKey={key} host="https://eu.i.posthog.com" capturePageview={false}>
  {children}
</PostHogProvider>
```

With no key (prop or env) the provider mounts a no-op sink and never imports
`posthog-js` — local and CI stay silent with zero config.

## Recipe: capturing events

Two hooks, both returning `capture(event, props?)`:

```tsx
"use client";
import { useCapture, useAnalytics } from "@evinvest/analytics/react";

// Strict: throws if no provider is mounted (catches wiring mistakes).
function InvestButton() {
  const capture = useCapture();
  return <button onClick={() => capture("hero_cta_clicked", { variant: "b" })}>Invest</button>;
}

// Lenient: no-ops silently if no provider is mounted (matches the original
// site behavior where capture is always safe to call).
function PricingSection() {
  const capture = useAnalytics();
  React.useEffect(() => {
    capture("section_viewed", { id: "pricing" });
  }, [capture]);
  return null;
}
```

Use `useCapture` in app code where the provider is guaranteed; use
`useAnalytics` in shared/library components that may render without a provider.

## Recipe: server-side capture (`./node`)

Server events have no browser session, so you must name the subject via
`distinctId`. Always `shutdown` to flush before the process (or request, in a
long-lived server) exits.

```ts
// app/api/checkout/route.ts
import { PostHog } from "posthog-node";
import { createServerSink, shutdown } from "@evinvest/analytics/node";

export async function POST(req: Request) {
  const { userId, amount } = await req.json();

  const client = new PostHog(process.env.POSTHOG_KEY!, {
    host: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
  });
  const sink = createServerSink(client, { distinctId: userId });

  sink.capture("checkout_order_placed", { amount });

  await shutdown(client); // flush queued events before the response returns
  return Response.json({ ok: true });
}
```

For system events with no user, use a constant: `{ distinctId: "server" }`.

In a long-lived process, prefer a single shared client (one `new PostHog(...)`
at startup) and a per-request `createServerSink(client, { distinctId })`; call
`shutdown(client)` only on graceful exit, not per request.

## Recipe: the SDK-free core (`.`)

The core entry imports nothing — use it where React isn't available (an edge
function, a shared util, a worker) and inject the SDK yourself:

```ts
import posthog from "posthog-js";
import { createPostHogSink, noopSink } from "@evinvest/analytics";

const sink = process.env.NEXT_PUBLIC_POSTHOG_KEY
  ? createPostHogSink(posthog, { key: process.env.NEXT_PUBLIC_POSTHOG_KEY })
  : noopSink();
```

`createPostHogSink` inits PostHog lazily, exactly once, on the first keyed
`capture`, with `person_profiles: "identified_only"` and (by default)
`capture_pageview: true`. No key → every `capture` is a silent no-op.

## Recipe: bring your own sink

`AnalyticsSink` is the whole contract. Any object with `capture(event, props?)`
works — Segment, a console logger, a fan-out to several vendors, a test spy:

```ts
import type { AnalyticsSink } from "@evinvest/analytics";

const consoleSink: AnalyticsSink = {
  capture(event, props) {
    console.debug("[analytics]", event, props);
  },
};

const fanOut = (...sinks: AnalyticsSink[]): AnalyticsSink => ({
  capture(event, props) {
    for (const s of sinks) s.capture(event, props);
  },
});

const sink = fanOut(consoleSink, segmentSink);
```

To use a custom sink with the React hooks, you can wrap your own context, or
simply call `sink.capture(...)` directly from event handlers — the hooks are a
convenience, not a requirement.

## Recipe: testing

The core and node entries take the client by injection, so tests need no SDK —
pass a stub:

```ts
// core.node.test.ts  (vitest, node environment via *.node.test.ts)
import { createPostHogSink } from "@evinvest/analytics";
import { vi, expect, it } from "vitest";

it("forwards events once initialized", () => {
  const ph = { init: vi.fn(), capture: vi.fn() };
  const sink = createPostHogSink(ph, { key: "phc_test" });
  sink.capture("hero_cta_clicked", { variant: "b" });
  expect(ph.init).toHaveBeenCalledTimes(1);
  expect(ph.capture).toHaveBeenCalledWith("hero_cta_clicked", { variant: "b" });
});
```

The React entry runs under jsdom (`*.react.test.tsx`). `PostHogProvider` mounts
fine without a key (it just serves a no-op), so you rarely need to mock
`posthog-js` in tests.

```tsx
// react.react.test.tsx  (vitest, jsdom)
import { PostHogProvider, useAnalytics } from "@evinvest/analytics/react";
// render <PostHogProvider> and assert children + that capture never throws
```

Test-file naming drives the vitest project: `*.node.test.ts` → node env,
`*.react.test.tsx` → jsdom env (see `vitest.config.ts`).

## Gotchas

- **`./react` is `"use client"`.** Its hooks only run in Client Components. The
  banner is added at build time (`dist/react.js` starts with `"use client";`);
  `dist/index.js` and `dist/node.js` deliberately do **not** carry it.
- **No-op-without-key is browser-only.** `createServerSink` (`./node`) forwards
  unconditionally. Guard construction (build the client only when a key exists)
  or fall back to `noopSink()`.
- **Don't forget `shutdown` on the server.** `posthog-node` queues events;
  without a flush, short-lived processes drop them.
- **Keep props primitive and non-PII.** Strings/numbers/booleans only; never the
  user's typed text.
- **Mount the provider once.** Multiple `PostHogProvider`s mean multiple init
  attempts and nested contexts — put it at the root.
- **Env reads are guarded.** The provider reads `process.env.*` defensively
  (`typeof process !== "undefined"`), so it won't crash in a bare browser
  bundle, but `NEXT_PUBLIC_*` inlining is a Next.js build feature — outside
  Next, pass `apiKey`/`host` explicitly.
```
