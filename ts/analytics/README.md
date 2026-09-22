# @evinvest/analytics

A **vendor-neutral, dep-light** product-analytics sink — the TypeScript mirror
of the `analytics` feature of the [`ev_lib`](https://github.com/EV-invest/lib) Rust
crate (`ev_lib::analytics`). Code against one tiny seam — `AnalyticsSink` — and pick
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

### Region

PostHog Cloud projects live in one region, and the other region's host rejects
their events. Name it: `region: "us" | "eu"`, or `host` for a proxy /
self-hosted instance (`host` wins over `region`).

| Entry point | Without `host` / `region` |
| --- | --- |
| `createPostHogSink` (identified mode), `PostHogProvider` | `NEXT_PUBLIC_POSTHOG_HOST` (provider only), then `https://us.i.posthog.com` — **unchanged**, so the existing US projects keep reporting where they did |
| `createPostHogSink({ cookieless: true })`, `<PostHogProvider cookieless>`, `createBeaconSink` | **type error** — new modes have no legacy region to inherit, so an EU project cannot land in US by omission |

Nothing moved: no existing call changes region. The US fallback is kept only
for the pre-existing shape; every new mode requires the target explicitly.

### Cookieless mode

```ts
const sink = createPostHogSink(posthog, {
  key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  cookieless: true,          // persistence: "memory", person_profiles: "never"
  region: "eu",
});
```

Nothing is written to cookies or storage; a reload is a new visitor.
Autocapture, rage/dead clicks, heatmaps and session recording are switched off,
because those events never pass through `capture` (see the table under
Consent). The
default (`cookieless` omitted) is still the identified mode, because the
existing consumers identify signed-in users.

### Allow-list and global properties

```ts
const sink = createPostHogSink(posthog, {
  key, cookieless: true, region: "eu",
  allowedProps: ["brand_id", "location_id", "channel", "form_id", "source", "device"],
  globalProps: { brand_id: "aquafix", location_id: "warsaw" },
});
sink.capture("contact_intent_click", { channel: "phone" });
// → { brand_id: "aquafix", location_id: "warsaw", channel: "phone" }
sink.capture("lead_form_submit", { phone: "+48 …" });
// dev (NODE_ENV !== "production"): throws — prod: `phone` is dropped, event sent
```

- A key outside `allowedProps` **throws in development** and is **dropped
  silently in production** (the page never breaks on a stray key). `strict`
  overrides the `NODE_ENV` check.
- `globalProps` merge into every event (the event's own value wins) and are
  checked against `allowedProps` when the sink is built.
- The check runs even without a PostHog key, so development catches a PII key
  before anyone configures analytics. Omit `allowedProps` to allow any key.
- The same options exist on `createBeaconSink`, `<PostHogProvider>`, and as a
  standalone wrapper: `withPropPolicy(sink, { allowedProps, globalProps })`.

### Beacon transport: events followed by navigation

A click on a `tel:` or `wa.me` link tears the page down; a request in flight is
cancelled and the event is lost. Two ways to send it so it survives:

```ts
// 1. With posthog-js: per-call option, mapped to posthog-js `sendBeacon`
capture("contact_intent_click", { channel: "phone" }, { transport: "beacon" });

// 2. Without any SDK: every event is a beacon
import { createBeaconSink } from "@evinvest/analytics";
const sink = createBeaconSink({
  key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  region: "eu",
  allowedProps: ["brand_id", "location_id", "channel"],
  globalProps: { brand_id: "aquafix", location_id: "warsaw" },
});
```

`createBeaconSink` posts to `<host>/capture/` through `navigator.sendBeacon`,
falling back to `fetch(..., { keepalive: true })` when the beacon is missing or
refused, and never throws. The body is `text/plain` (no CORS preflight) and is
**byte-identical** to `serde_json::to_string(&ev_lib::analytics::capture_body(..))`
— `captureBody(key, distinctId, event, props)` builds it, and a golden test
pins it to the Rust output. The `distinct_id` is a random id held in memory
(cookieless by construction); pass `distinctId` to override it. No key → no
network call.

Checking it in a browser (Playwright, in the app, not here) — the event must
leave before the navigation:

```ts
const capture = page.waitForRequest(
  (req) => req.url().endsWith("/capture/") && req.method() === "POST",
);
await page.route("**/capture/", (route) => route.fulfill({ status: 200 }));
await page.getByRole("link", { name: /call/i }).click(); // href="tel:…"
const body = JSON.parse((await capture).postData() ?? "{}");
expect(body.event).toBe("contact_intent_click");
expect(body.properties.channel).toBe("phone");
```

Build the page with a PostHog key (any `phc_…` string); without one nothing is
sent and the wait times out.

### Consent

```ts
import { gatedSink, setConsent, hasConsent } from "@evinvest/analytics";

const sink = gatedSink(createBeaconSink({ key, region: "eu" })); // reads hasConsent
sink.capture("hero_cta_clicked");   // dropped
setConsent(true);                   // from the banner's "accept"
sink.capture("hero_cta_clicked");   // sent
```

Events before consent are **dropped, not queued**. `gatedSink(sink, source)`
takes a `() => boolean` or a `Consent` object; `pageConsent` is the page-wide
one `setConsent` writes, `createConsent()` makes an independent flag.

`gatedSink` sees only what goes through `capture`. For posthog-js, give the
sink the consent itself — `createPostHogSink(posthog, { …, consent:
pageConsent })` or `<PostHogProvider consent={pageConsent}>`:

- posthog-js is not initialised until the first consented event, so it sends
  nothing of its own before consent;
- `setConsent(false)` after init calls `posthog.opt_out_capturing()` (stopping
  autocapture and recording too), a renewed `setConsent(true)` calls
  `opt_in_capturing` without the `$opt_in` event. A bare function only gates
  `capture` — it cannot be subscribed to.

Import `pageConsent` from `@evinvest/analytics`: `./react` is a separate
bundle, and its own copy of the page-wide flag never sees a `setConsent` from
the core entry. An inline `consent` prop is fine — the provider reads it
through a ref, so re-renders do not re-fire consumers' effects.

### What the allow-list and consent cover — and what they do not

`allowedProps`, `globalProps` and `gatedSink` act on **events passed to
`capture`** (including the provider's `$pageview` and `PostHogPageView`). The
`$`-properties this package adds itself — `$current_url` (from
`PostHogPageView`, query string included) and `$lib` — are always allowed;
no other `$` key is.

| Mode | What posthog-js sends on its own, outside the allow-list |
| --- | --- |
| `createBeaconSink` | nothing — there is no SDK |
| `cookieless: true` | nothing: `autocapture`, `rageclick`, `capture_dead_clicks`, `capture_heatmaps` are off and `disable_session_recording` is on. posthog-js still adds its own device/URL context (`$current_url`, `$browser`, `$referrer`, …) to every event |
| identified (default) | **autocapture** (`$autocapture` with `$current_url` incl. query, link `href`s such as `tel:…`, element text), rage/dead clicks, heatmaps and session replay as configured in the PostHog project — none of it passes the allow-list. Consent (`consent: pageConsent`) still stops it all via opt-out |

So in the identified mode the allow-list guards your own events only; keep PII
out of URLs and link targets, or use the cookieless mode.

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

| Concept | Rust (`ev_lib::analytics`) | TS (`@evinvest/analytics`) |
| --- | --- | --- |
| the seam | `AnalyticsSink` trait | `AnalyticsSink` interface |
| vendor factory | `posthog_sink(client, cfg)` | `createPostHogSink(posthog, config)` |
| disabled sink | `noop_sink()` | `noopSink()` |
| no-key behavior | silent no-op | silent no-op |
| capture payload | `capture_body(key, id, &event)` | `captureBody(key, id, event, props)` — same bytes |

## Limitations

- **PostHog defaults are fixed per mode.** Identified: `person_profiles:
  "identified_only"`. Cookieless: `person_profiles: "never"`, `persistence:
  "memory"`. `capture_pageview` defaults to `true` (overridable). Other
  PostHog init options are not surfaced — build the sink yourself if you need
  them.
- **`createBeaconSink` creates a PostHog person per page load.** It sends what
  the Rust client sends, which has no `$process_person_profile: false`. Add it
  through `globalProps` (and `allowedProps`) if the project should not keep
  anonymous persons.
- **Byte parity with Rust** holds for strings, booleans, safe integers and
  finite non-integers; values that are not a primitive are skipped.
- **Custom sinks that wrap another sink** should forward the third
  `capture` argument (`options`), or the beacon hint is lost.
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
cargo test  -p ev_lib --features analytics
cargo clippy -p ev_lib --features analytics --all-targets -- -D warnings
cargo check -p ev_lib --features "analytics wasm" --target wasm32-unknown-unknown
```
