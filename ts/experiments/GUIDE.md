# Experiments cookbook

End-to-end recipes for `@evinvest/experiments`: define a config, assign variants
in a Next proxy, read them on the server, render a branch, track exposure and
interactions on the client, wire your analytics **without** coupling this
package to it, and ship a dev override panel.

The package has three subpaths, each pulling only the peer it needs:

| Subpath | Environment | Peer | Banner |
| --- | --- | --- | --- |
| `@evinvest/experiments` | anywhere (server-safe) | none | — |
| `@evinvest/experiments/next` | Next.js server | `next` | none |
| `@evinvest/experiments/react` | browser / client island | `react` | `"use client"` |

## 1. Define a config

One config, declared `as const satisfies ExperimentConfig`, imported everywhere.
The `as const` is what narrows the variant strings to literal unions, so
`match` / `select` become exhaustive and `getVariant` returns a precise type.

```ts
// experiments.ts
import type { ExperimentConfig } from "@evinvest/experiments";

export const experiments = {
  hero: { variants: ["a", "b"], weights: [0.5, 0.5] },
  team: { variants: ["a", "b", "c"], weights: [2, 1, 1] },
} as const satisfies ExperimentConfig;
```

`weights[i]` is the relative weight of `variants[i]`. They need not sum to 1 —
`pickVariant` normalizes by their total (so `[2, 1, 1]` means 50% / 25% / 25%).

## 2. Assign variants in a Next proxy

The proxy runs on first request and assigns a sticky `ab_<key>` cookie per
experiment. New assignments are written to **both** the forwarded request (so
the same render's `cookies()` already sees them — no first-paint bias) and the
response (so the browser keeps them for 30 days). Existing cookies are left
alone, which is what makes assignment sticky.

```ts
// proxy.ts (Next 16). On Next ≤ 15 name the file `middleware.ts` and export `middleware`.
import { createAbMiddleware } from "@evinvest/experiments/next";
import { experiments } from "./experiments";

export const proxy = createAbMiddleware(experiments);

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

Prefer to do extra work in the proxy? Call `abProxy` directly and return its
response:

```ts
import { abProxy } from "@evinvest/experiments/next";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const response = abProxy(experiments, request);
  // …mutate `response` further if you like…
  return response;
}
```

> The proxy must run on the **nodejs** runtime (the default). `Math.random`
> bucketing and cookie writes need no edge APIs.

## 3. Read the variant on the server + render a branch

Keep the page agnostic of A/B: each section reads its own variant in a server
wrapper. `getVariant` resolves the cookie (control fallback baked in); `match`
picks the node and is exhaustive — drop a branch and it's a compile error.

```tsx
// hero.tsx — a Server Component
import { getVariant } from "@evinvest/experiments/next";
import { match } from "@evinvest/experiments/react";
import { experiments } from "./experiments";
import { HeroA, HeroB } from "./hero-variants";

export async function Hero() {
  const variant = await getVariant(experiments, "hero"); // "a" | "b"
  return match(variant, { a: <HeroA />, b: <HeroB /> });
}
```

Need a non-React branch (a string, a config object)? Use the core's `select`
instead of `match` — same exhaustiveness, any value type.

## 4. Track exposure + interactions on the client

`ExperimentTracker` is the A/B boundary. It fires `${experiment}_exposed` once
on mount and provides context to `useExperimentEvent`. Wrap it around the
server-rendered children so the variant content stays out of the client bundle.

```tsx
// hero.tsx — wrap the branch
import { ExperimentTracker } from "@evinvest/experiments/react";
import { capture } from "@evinvest/analytics"; // see §5 for the wiring

export async function Hero() {
  const variant = await getVariant(experiments, "hero");
  return (
    <ExperimentTracker experiment="hero" variant={variant} onEvent={capture}>
      {match(variant, { a: <HeroA />, b: <HeroB /> })}
    </ExperimentTracker>
  );
}
```

```tsx
// cta.tsx — a client island inside the subtree
"use client";
import { useExperimentEvent } from "@evinvest/experiments/react";

export function Cta() {
  const track = useExperimentEvent();
  // emits "hero_cta_clicked" with { variant, cta: "explore" } merged
  return <button onClick={() => track("cta_clicked", { cta: "explore" })}>Explore</button>;
}
```

`track` takes an optional third `handler(fire)` argument when you need to order
the event relative to a side effect:

```tsx
track("cta_clicked", { cta: "explore" }, (fire) => {
  fire();
  scrollToSection();
});
```

## 5. Wire `onEvent` to `@evinvest/analytics` — without this package importing it

This is the load-bearing decoupling. `ExperimentTracker` takes an
`onEvent: CaptureFn` prop, where `CaptureFn = (event: string, props?: Record<string, unknown>) => void`.
That shape is **structurally identical** to `@evinvest/analytics`'s `CaptureFn`,
so the analytics `capture` drops straight in — but the dependency edge is
yours, in your app, not inside `@evinvest/experiments`.

```tsx
// option A: a server-bound capture passed as a prop
import { ExperimentTracker } from "@evinvest/experiments/react";
import { capture } from "@evinvest/analytics";

<ExperimentTracker experiment="hero" variant={variant} onEvent={capture}>{children}</ExperimentTracker>;
```

```tsx
// option B: the analytics React hook, inside a client wrapper
"use client";
import { ExperimentTracker } from "@evinvest/experiments/react";
import { useCapture } from "@evinvest/analytics/react";

export function TrackedHero({ variant, children }: { variant: string; children: React.ReactNode }) {
  const capture = useCapture();
  return (
    <ExperimentTracker experiment="hero" variant={variant} onEvent={capture}>
      {children}
    </ExperimentTracker>
  );
}
```

Any function of the right shape works — PostHog directly, a logger, a test mock:

```tsx
<ExperimentTracker experiment="hero" variant={variant} onEvent={(e, p) => console.log(e, p)}>…</ExperimentTracker>;
```

The grep-able guarantee: `src/` contains **no** `@evinvest/analytics` import.

## 6. Dev override panel

`DevAbPanel` renders a floating button grid (one row per experiment, one button
per variant). It is prop-driven — no router import, minimal inline styles — and
returns `null` outside `NODE_ENV === "development"`. You supply `onSelect`,
which typically writes the cookie with `writeVariant` and refreshes the route.

```tsx
"use client";
import { useRouter } from "next/navigation";
import { DevAbPanel, writeVariant, readCookie } from "@evinvest/experiments/react";
import { cookieName } from "@evinvest/experiments";
import { experiments } from "./experiments";

export function AbPanel() {
  const router = useRouter();
  return (
    <DevAbPanel
      config={experiments}
      onSelect={(key, variant) => {
        writeVariant(key, variant);   // rewrite ab_<key> (same shape the proxy sets)
        router.refresh();             // re-render the server with the new variant
      }}
      // optional: onRefresh runs once after mount, e.g. to read current cookies
      onRefresh={() => { void readCookie(cookieName("hero")); }}
    />
  );
}
```

Mount `<AbPanel />` once in your root layout. In production it renders nothing.

## 7. Testing

The core is pure, so test it with a **seeded rng** — no DOM, no Next:

```ts
import { pickVariant, resolveVariant, nextVariant } from "@evinvest/experiments";

pickVariant(experiments, "hero", () => 0);     // "a" (boundary at 0.5)
pickVariant(experiments, "hero", () => 0.5);   // "b"
resolveVariant(experiments, "hero", "garbage"); // "a" (control fallback)
nextVariant(experiments, "hero", "b", 1);       // "a" (wraps)
```

For the React island, pass a **mock** `onEvent` and assert what was emitted:

```tsx
const onEvent = vi.fn();
render(<ExperimentTracker experiment="hero" variant="b" onEvent={onEvent}>…</ExperimentTracker>);
expect(onEvent).toHaveBeenCalledWith("hero_exposed", { variant: "b" });
```

For the proxy, build a `NextRequest` and assert cookies land on both request and
response (see `test/next.node.test.ts`).

## 8. Gotchas

- **Pass the config `as const`.** Without it, variants widen to `string[]` and
  `match` / `select` lose exhaustiveness.
- **`getVariant` is server-only.** It uses `next/headers`; calling it on the
  client throws. Import it from `@evinvest/experiments/next` only.
- **`readCookie` / `writeVariant` are client-only.** They touch
  `document.cookie` and live in `./react`, never `./next`.
- **Exposure fires on mount, once per tracker instance.** Conditionally
  rendering and re-rendering the tracker will re-fire it — keep one stable
  boundary per section.
- **Stickiness is the cookie, not the rng.** Seeding `rng` only makes a single
  pick deterministic; cross-visit consistency comes from the proxy's cookie.
- **The proxy runs on nodejs.** Don't move it to the edge runtime.
