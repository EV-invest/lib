# @evinvest/i18n

A **dep-light** internationalisation toolkit for EV's five locales. It ships a
zero-dependency, server-safe **core** — locale registry, URL contract,
`Accept-Language` negotiation, and an ICU-subset message formatter — plus thin
**React** and **Next.js** subpaths.

> **Why this hard-codes its locales, unlike `@evinvest/experiments`.** That
> package deliberately never hard-codes experiment keys, because experiments are
> per-app. Locales are the opposite: the same five apply to the public site, the
> cabinet, and every MFE, and having one place they are declared is the whole
> point of putting this in a shared library. Helpers that iterate locales still
> accept an optional `locales` argument, so a surface shipping a subset is not
> forced to claim all five.

> **This package owns no number, date, or currency policy.** The formatter
> supports `plural` and `select` but deliberately not `number` / `date` /
> `currency`. Consuming apps keep **one policy per unit of measure** (see the
> cabinet's `shared/lib/money.ts`) and interpolate the already-formatted string.
> A second, competing number policy hiding inside message catalogues is exactly
> the drift that rule exists to prevent.

## Dep honesty

**Zero runtime dependencies.** `react` and `next` are **optional** peers
(declared in `peerDependenciesMeta`) — pull in only the subpath you use:

- `.` — pure core, no peers, server-safe, no React / Next / DOM. Enforced by
  `tsconfig.core.json`, which compiles `src/index.ts` with `lib: ["ES2022"]` and
  no `DOM`.
- `./react` — needs the `react` peer (a `"use client"` bundle).
- `./next` — needs the `next` peer only nominally; it imports nothing from
  `next` and returns plain data for `next.config.ts` and the metadata APIs.

`.` and `./next` ship **both ESM and CJS**. That is not symmetry for its own
sake: `next.config.ts` is loaded as CJS, so the ESM-only 0.1.0 could not be
`require`d there at all — it failed with `ERR_PACKAGE_PATH_NOT_EXPORTED` in the
one file `localeRewrites`/`localeRedirects` exist to serve. `./react` stays
ESM-only, since a `"use client"` module is consumed by a bundler and never
`require`d from a config.

## Install

```sh
npm i @evinvest/i18n
```

Requires Node ≥ 20. `dist/` is built on publish, not committed.

## The locales

| Code | Label | Tier |
| ---- | ----- | ---- |
| `en` | English | authored source; fallback for anyone we cannot place |
| `ru` | Русский | human-reviewed |
| `vi` | Tiếng Việt | human-reviewed |
| `fr` | Français | machine translation accepted |
| `de` | Deutsch | machine translation accepted |

Vietnamese is **`vi`** — the ISO 639-1 *language* code. `vn` is the ISO 3166
*country* code and is not a valid `hreflang` or `lang` value; Google discards
invalid values silently, so the distinction is load-bearing.

## The URL contract

One rule, applied identically by the public site and the cabinet: **the default
locale is unprefixed, every other locale carries a `/<locale>` prefix.**

```
en  →  /team              ru  →  /ru/team
en  →  /cabinet/wallet    ru  →  /cabinet/ru/wallet
```

Unprefixed English means no already-indexed URL has to move, and no redirect
sits on the busiest route. `localePath` and `splitLocalePath` are the only place
that asymmetry may be expressed — hand-built locale URLs elsewhere drift
immediately.

```ts
import { localePath, splitLocalePath, localeAlternates } from "@evinvest/i18n";

localePath("ru", "/team");        // "/ru/team"
localePath("en", "/team");        // "/team"
splitLocalePath("/ru/team");      // { locale: "ru", path: "/team" }
splitLocalePath("/cabinet/x");    // { locale: "en", path: "/cabinet/x" }
localeAlternates("/team");        // { en: "/team", ru: "/ru/team", … }
```

## Wiring a Next.js app

Routing is **config-level, not middleware**. Put every page under
`app/[locale]/`, then let one **`fallback`** rewrite serve the default locale at
unprefixed paths. `fallback` runs last — after dynamic routes — so prefixed
locale routes and zone mounts (`/cabinet`, `/rea`, `/api/*`) never reach it, and
the app keeps shipping no `proxy.ts` at all.

```ts
// next.config.ts
import { localeRewrites, localeRedirects } from "@evinvest/i18n/next";

const nextConfig = {
  async rewrites() {
    return { beforeFiles: [...zoneRewrites], afterFiles: [], fallback: localeRewrites() };
  },
  // Collapses /en/* onto the unprefixed form so each page has one canonical URL.
  async redirects() {
    return localeRedirects();
  },
};
```

> **Not `afterFiles`.** This is the one easy mistake, and it half-works, which is
> what makes it dangerous. Next's order is `redirects → beforeFiles → filesystem
> → afterFiles → dynamic routes → fallback`. The entire `app/[locale]/` tree is a
> *dynamic* route, so an `afterFiles` rule fires **before** `[locale]` is tried:
> `/ru/team` gets rewritten to `/en/ru/team` and 404s, while `/team` resolves
> correctly and hides the bug. Verified on Next 16.2.9 — see
> `site_conductor/docs/i18n-routing-spike.md`.

```tsx
// app/[locale]/layout.tsx
import { localeStaticParams } from "@evinvest/i18n/next";

export const dynamicParams = false;              // unknown first segment ⇒ 404
export const generateStaticParams = localeStaticParams;  // includes "en" — see below
```

`generateStaticParams` **must** include the default locale: unprefixed URLs are
*rewritten* onto `/en/*`, so those routes have to be really prerendered even
though no reader ever sees that URL.

`dynamicParams = false` is **load-bearing, not hygiene.** Since
`app/[locale]/page.tsx` is the homepage, `[locale]` matches any single segment —
so `/team` is ambiguous with it. With `dynamicParams = false`, `[locale]`
declines the unknown segment and the request falls through to the `fallback`
rewrite that resolves it as English. Without it, `/team` renders the homepage
with `locale === "team"`.

## Translating

Server Components call `translator()` directly — the locale is already in their
props, and there is no re-render to memoise against:

```tsx
// app/[locale]/team/page.tsx  (Server Component)
import { translator } from "@evinvest/i18n";

export default async function TeamPage({ params }) {
  const { locale } = await params;
  const t = translator(await loadMessages(locale, "team"), locale);
  return <h1>{t("team.title")}</h1>;
}
```

Client islands use the provider — mounted as high as the *client* tree goes, not
around the whole document:

```tsx
import { I18nProvider } from "@evinvest/i18n/react";   // Server file, client boundary below
import { useT } from "@evinvest/i18n/react";

<I18nProvider locale={locale} messages={messages}>
  <WalletIsland />
</I18nProvider>
```

A **missing key returns the key itself** and fires the optional `onMissing`
hook. That is deliberate: a blank or throwing lookup turns a translation gap into
an invisible hole or a white screen, whereas the raw key is self-describing on
screen, greppable, and survives to a screenshot in a bug report. Finding missing
keys is the build-time checker's job; the runtime's job is to degrade legibly.

## Message patterns

A deliberately small ICU subset:

| Form | Example |
| ---- | ------- |
| interpolation | `Hello, {name}.` |
| plural | `{n, plural, =0 {no roles} one {# role} other {# roles}}` |
| select | `{tier, select, fund {Fund} other {Guest}}` |
| escaping | `'{'` and `'}'` for literal braces, `''` for an apostrophe |

`#` inside a plural branch renders the count **in the reader's locale** — `ru`
groups thousands with spaces, `de` with dots.

Plural categories come from `Intl.PluralRules`, which is why this is not a bare
string map: Russian has `one` / `few` / `many`, Vietnamese has only `other`.

```ts
formatMessage("{n, plural, one {# вакансия} few {# вакансии} many {# вакансий}}", "ru", { n: 3 });
// "3 вакансии"
```

Apostrophes in ordinary copy are left alone — the ICU 4.8 "apostrophe-friendly"
rules apply, so a quote only starts a quoted section when it immediately precedes
`{`, `}` or `#`. `We've got it.` survives intact.

## Negotiation is for *suggesting*, not serving

`negotiate()` reads an `Accept-Language` header with q-values and regional
fallback (`ru-RU` → `ru`). Use it to decide which locale to **offer** — the
"read this in your language" strip — never to decide what to serve. EV serves the
default locale at unprefixed URLs and does not auto-redirect: Google crawls in
English from a US IP, so a language redirect can bury the other locales, and a
reader who deliberately chose English should not be bounced out of it.

## Rust counterpart

Unlike the other packages here, this one currently has **no** Rust mirror. The
planned `i18n` Cargo feature reads the *same* `messages/<locale>/*.json`
catalogues via `include_str!` to localise transactional email, so there is one
translation source across TS and Rust rather than two that drift. Until that
lands, this package is the sole implementation.

## Scripts

```sh
npm run build      # tsup → dist/ (ESM; plus CJS for `.` and `./next`)
npm test           # vitest: node project for the core + next, jsdom for react
npm run typecheck  # full tsconfig, then the DOM-free core tsconfig
npm run preflight  # dry run for a release — checks everything, publishes nothing
```

## Release

Releases go through the repo-wide script, never `npm publish` from here — see
AGENTS.md for why (a hand publish skips the bump and the tag, and the tag is what
decides what gets released next time).

```sh
npm run preflight                                   # from ts/i18n — verify first
cd "$(git rev-parse --show-toplevel)"
NPM_TOKEN=… nix run .#publish -- minor              # bumps, publishes, commits, tags, pushes
```

`publish.rs` walks `ts/*` and treats a package with no `<name>-v*` tag as never
published, so this one is picked up automatically — nothing to register. It bumps
**before** publishing, which is why the manifest sits at `0.0.0`: `-- minor`
makes the first release `0.1.0`.

Two things to know for this first release:

- **A granular npm token probably cannot create it.** Granular tokens list the
  packages they may write to, and a package that does not exist yet cannot be on
  that list. npm reports the refusal as a 404, which is indistinguishable from
  "not found" — `publish.rs` says as much in its failure output. Use an
  automation or classic token with `@evinvest` write access for the first
  publish; granular is fine afterwards.
- **`prepublishOnly` runs `verify-pack.mjs`,** which refuses to publish a tarball
  that does not contain what `exports` promises. It follows each entry point's
  own imports rather than checking a fixed list, because `.`, `./react` and
  `./next` share a hash-named chunk whose filename changes every build — a
  missing chunk passes every `files`-field check and then throws
  `ERR_MODULE_NOT_FOUND` in the consumer.
