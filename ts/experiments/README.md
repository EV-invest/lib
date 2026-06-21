# @evinvest/experiments

A **dep-light** A/B experiments toolkit — the TypeScript mirror of the
`experiments` feature of the [`ev_lib`](https://github.com/EV-invest/lib) Rust crate.
It ships a zero-dependency, server-safe **core** plus thin **React** and
**Next.js** subpaths, preserving the feature's semantics (cookie shape, weighted
pick, control fallback) while reading like idiomatic TS.

The package is generic over a **caller-supplied config**: it hard-codes no
experiment keys. Pass your config `as const` and the variant unions narrow at
every call site.

> **Does not import `@evinvest/analytics`.** Exposure and interaction events are
> emitted through an **injected sink** — an `onEvent: (event, props?) => void`
> you hand to `ExperimentTracker`. The package defines that function shape
> structurally (`CaptureFn`) and never depends on an analytics SDK. You wire
> your own capture (e.g. `@evinvest/analytics`'s `capture`) into `onEvent`.
> See [GUIDE.md](./GUIDE.md) for the exact wiring.

## Dep honesty

**Zero runtime dependencies.** `react` and `next` are **optional** peers
(declared in `peerDependenciesMeta`) — pull in only the subpath you use:

- `.` — pure core, no peers, server-safe, no React / Next / DOM.
- `./react` — needs the `react` peer (a `"use client"` bundle).
- `./next` — needs the `next` peer (server-only).

## Install

Published to the public npm registry:

```sh
npm i @evinvest/experiments
```

Requires Node ≥ 20. React 18/19 and Next 14/15/16 are optional peers. `dist/` is
built on publish, not committed.

## Quick start

Define your config once and pass it everywhere:

```ts
// experiments.ts
import type { ExperimentConfig } from "@evinvest/experiments";

export const experiments = {
  hero: { variants: ["a", "b"], weights: [0.5, 0.5] },
  team: { variants: ["a", "b", "c"], weights: [2, 1, 1] },
} as const satisfies ExperimentConfig;
```

### `.` — core (server-safe, zero-dep)

```ts
import { cookieName, pickVariant, resolveVariant, nextVariant, select } from "@evinvest/experiments";
import { experiments } from "./experiments";

cookieName("hero");                                   // "ab_hero"
pickVariant(experiments, "hero");                     // weighted by Math.random
pickVariant(experiments, "hero", () => 0.9);          // deterministic (seeded rng)
resolveVariant(experiments, "hero", cookieValue);     // valid value, else "a" (control)
nextVariant(experiments, "team", "c", 1);             // "a" (wraps)
select(variant, { a: "Control", b: "Treatment" });    // exhaustive map
```

### `./next` — Next.js server

```ts
// proxy.ts (Next 16; `middleware.ts` on ≤ 15) — runtime: nodejs
import { createAbMiddleware } from "@evinvest/experiments/next";
import { experiments } from "./experiments";

export const proxy = createAbMiddleware(experiments);
export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"] };
```

```tsx
// a Server Component
import { getVariant } from "@evinvest/experiments/next";
import { match } from "@evinvest/experiments/react";
import { experiments } from "./experiments";

export async function Hero() {
  const variant = await getVariant(experiments, "hero");
  return match(variant, { a: <HeroA />, b: <HeroB /> });
}
```

### `./react` — client island (`"use client"`)

```tsx
import { ExperimentTracker, useExperimentEvent } from "@evinvest/experiments/react";
import { capture } from "@evinvest/analytics"; // your sink — injected, not coupled

<ExperimentTracker experiment="hero" variant={variant} onEvent={capture}>
  {children}
</ExperimentTracker>;

// inside the subtree:
const track = useExperimentEvent();
track("cta_clicked", { cta: "explore" }); // emits "hero_cta_clicked" with { variant, cta }
```

## Rust ↔ TS parity

The Rust crate is the source of truth; this package preserves its _semantics_:

| Concept | Behaviour |
| --- | --- |
| cookie name | `ab_<key>` |
| weighted pick | normalized by total weight, falls through to the last variant |
| variant resolution | unrecognised / missing cookie → `variants[0]` (control) |
| sticky assignment | proxy assigns once on first visit, 30-day cookie, request + response |
| exposure | `${experiment}_exposed` fired once on mount |
| interaction | `track(action, props?)` emits `${experiment}_${action}` with `variant` merged |
| cyclic step | `nextVariant` wraps around the declared variant list |

## Limitations

- **Bucketing is per device** (`Math.random`, no user-id hashing). `pickVariant`
  takes an injectable `rng` for deterministic tests, not for cross-device
  stickiness — stickiness comes from the cookie.
- **Cookie-based A/B opts routes into dynamic rendering** — that is the inherent
  cost of reading a cookie in a Server Component, not a package choice.
- **No event transport.** The package emits through an injected `CaptureFn`; it
  has no batching, retry, or PII scrubbing. Your sink owns all of that.
- **`DevAbPanel` is prop-driven** — it imports no router and uses minimal inline
  styles. You wire `onSelect` to `writeVariant` + a refresh yourself, and it
  returns `null` outside `NODE_ENV === "development"`.

## Develop

```sh
npm i
npm run typecheck   # tsc --noEmit (full) && tsc -p tsconfig.core.json --noEmit (no-DOM core)
npm run test        # vitest — node project (core + next) + jsdom project (react)
npm run build       # tsup → dist/ (ESM + d.ts); only react.js carries "use client"
```
