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
  // Optional per experiment: `enabled: false` is a kill switch (everyone gets the
  // control, cookies and forces are ignored); `holdout` pins that share to control.
  cta: { variants: ["a", "b"], weights: [1, 1], holdout: 0.1 },
} as const satisfies ExperimentConfig;
```

### `.` — core (server-safe, zero-dep)

```ts
import {
  cookieName, pickVariant, pickVariantFor, resolveVariant, forcedVariant, nextVariant, select,
} from "@evinvest/experiments";
import { experiments } from "./experiments";

cookieName("hero");                                   // "ab_hero"
pickVariant(experiments, "hero");                     // weighted by Math.random
pickVariant(experiments, "hero", () => 0.9);          // deterministic (seeded rng)
pickVariantFor(experiments, "hero", locationId);      // per subject: stable, no cookie
forcedVariant(experiments, "hero", "b");              // "b"; unknown value → undefined
resolveVariant(experiments, "hero", cookieValue);     // valid value, else "a" (control)
nextVariant(experiments, "team", "c", 1);             // "a" (wraps)
select(variant, { a: "Control", b: "Treatment" });    // exhaustive map
```

#### Per-subject bucketing

`pickVariantFor(config, key, subject)` is
``pickVariant(config, key, hashRng(`${key}:${subject}`))``. With `subject = location_id` every location of a
network gets a fixed variant — no cookie, no per-visitor state, so the page can
stay static. The hash is a cross-language contract shared with the Rust crate:

| Function | Definition |
| --- | --- |
| `fnv1a32(s)` | FNV-1a 32-bit over the UTF-8 bytes of `s` (basis `0x811C9DC5`, prime `0x01000193`, mod 2^32) |
| `hashToUnit(seed)` | `fnv1a32(seed) / 2^32`, in `[0, 1)` |
| `hashRng(seed)` | the n-th call (n = 0, 1, …) returns ``hashToUnit(`${seed}#${n}`)`` |

Test vectors (pinned in `test/hash.node.test.ts`): `fnv1a32("") = 0x811C9DC5`,
`fnv1a32("a") = 0xE40C292C`, `fnv1a32("foobar") = 0xBF9CF968`,
`hashToUnit("exp:loc-1") = 0.7218671222217381`,
`hashToUnit("exp:loc-2") = 0.7179607783909887`,
`hashToUnit("h\u00e9llo") = 0.2915728837251663`.

#### `enabled` and `holdout`

- `enabled: false` — `pickVariant` returns the control without drawing,
  `resolveVariant` ignores a stored cookie, `forcedVariant` refuses, and the proxy
  assigns nothing. Omitted means enabled.
- `holdout: h` (clamped to `[0, 1]`) — one draw `u`: `u < h` → control, otherwise
  `u` is rescaled to `(u - h) / (1 - h)` and walked over the weights. Still one
  `rng` call, so picks without a holdout are unchanged. Held-out visitors carry
  the control value; they are not distinguishable from the control bucket.

### `./next` — Next.js server

```ts
// proxy.ts (Next 16; `middleware.ts` on ≤ 15) — runtime: nodejs
import { createAbMiddleware } from "@evinvest/experiments/next";
import { experiments } from "./experiments";

export const proxy = createAbMiddleware(experiments);
export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"] };
```

Every option is optional; omitting them all is the original behaviour:

```ts
export const proxy = createAbMiddleware(experiments, {
  rng: Math.random,                                   // new cookie assignments
  subject: (req) => locationFromHost(req.nextUrl.hostname), // string → per-subject, no Set-Cookie
  cookie: { prefix: "ab_", maxAge: 60 * 60 * 24 * 30, path: "/", domain: ".brand.com", sameSite: "lax" },
  skip: (req) => /bot|crawler/i.test(req.headers.get("user-agent") ?? ""),
  forceParam: "ab_",                                  // ?ab_hero=b forces (validated); off by default
});
```

With `subject` resolving to a string, each experiment is bucketed by
`pickVariantFor` and written to the **forwarded request only** (overriding any
cookie the browser sent), so `getVariant` in the same render reads it and the
response sets no cookie. A valid forced variant overrides the cookie and, in
cookie mode, is persisted.

```tsx
// a Server Component
import { getVariant } from "@evinvest/experiments/next";
import { match } from "@evinvest/experiments/react";
import { experiments } from "./experiments";

export async function Hero() {
  const variant = await getVariant(experiments, "hero");
  return match(variant, { a: <HeroA />, b: <HeroB /> });
}

// Static per-location split — never calls cookies():
const variant = await getVariant(experiments, "hero", { subject: location.id });
// Other options: `force` (e.g. from searchParams, validated) and `cookie: { prefix }`.
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
| cookie name | `ab_<key>` (prefix overridable in `./next`) |
| weighted pick | normalized by total weight, falls through to the last variant |
| subject hash | FNV-1a 32 over UTF-8 → `hashToUnit` / `hashRng`, identical values in Rust |
| `enabled` / `holdout` | disabled → control everywhere; holdout share → control, rest rescaled |
| variant resolution | unrecognised / missing cookie → `variants[0]` (control) |
| sticky assignment | proxy assigns once on first visit, 30-day cookie, request + response |
| exposure | `${experiment}_exposed` fired once on mount |
| interaction | `track(action, props?)` emits `${experiment}_${action}` with `variant` merged |
| cyclic step | `nextVariant` wraps around the declared variant list |

## Limitations

- **Cookie bucketing is per device** (`Math.random`). For a stable split use a
  subject (`pickVariantFor`, `subject` option) — per location, not per visitor;
  do not hash raw PII as the subject.
- **`skip` and `rng` are proxy-only**; `getVariant` has no request to inspect.
  Force in a Server Component comes from the page (`force` option).
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
