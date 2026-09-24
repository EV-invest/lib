# kitstart shared fixtures

Test vectors for the landing machinery, read by both ports: `ts/kitstart`
(vitest) and the Rust `kitstart` feature. Data only — no code here.
Compare serialised output: key order is part of the contract.

| File | Case shape | Expected |
|---|---|---|
| `sites.json` | `{ <name>: site }` — `pages` as `[{ key, suffix }]`, `legacyRedirects` as `{ from, to: { "null" \| "<locale>": path } }` (a missing key is "no redirect"), `publication` as `"storefront"` \| `"service-area"`, `publicFiles` the exact paths it serves as files | — |
| `decide.json` | `{ site, request: { host, pathname, query, acceptLanguage, cookieLang } }`, `query` the raw string | `decision: { kind, location?, locale?, pathname? }` |
| `json-ld.json` | `{ site, place, locale, page, mode, copy: { placeName, title, description, offers, faq } }`, top-level `now` | the page's `@graph` |
| `metadata.json` | `kind: "place"` (`place`, `locale`, `page`, `mode`, `copy: { title, description }`), `"brand"` (`locale`, `copy`), `"status"` (`copy.title`) | the Next `Metadata` object |
| `sitemap.json` | `{ site, host, places }` — `places` already overlaid with the live source | `{ sitemap, robots }` |
| `antispam.json` | `{ limit, windowMs, maxKeys, steps: [{ honeypot, renderedAt, clientKey, now }] }`, top-level `minFillMs`, `maxSkewMs` | each step's `expected` verdict, one limiter per case |

Three sites: `aquafix` (storefronts on subdomains), `cleaning` (one
service-area place on a `single` site) and `prelaunch` (`cleaning` with
`domain: null`).

## Where the expected values come from

For `aquafix`, `expected` in `json-ld.json`, `metadata.json` and
`sitemap.json` is copied verbatim from `Service-Arb/aquafix@33e3198`
`tests/golden/`; the `copy` each case feeds the builders is read back out of
the same goldens, because it is brand prose, not machinery. The
`cleaning/*` and `prelaunch/*` cases and `antispam.json` have no aquafix to
copy: their `expected` comes from the TS builders, which are primary.

`decide.json` follows aquafix's `tests/l10n.test.ts` as of
`Service-Arb/aquafix#13` (link mode in the path, dead paths `gone`), plus
unprefixed junk and the `single` topology aquafix cannot exercise.

## What the cases pin

- **Routing.** A dead path is `gone` — the 404 in the path's language, for
  the place it belongs to (`location` is the `[location]` param, `_royat` in
  host mode) or the brand (`null`). A path without a language that is not a
  page, `/_next/…`, one of the non-page routes (`/quote`, `/og`, `/health`,
  `/sitemap.xml`, `/robots.txt`) or one of the site's `publicFiles` is `gone`
  too, in the cookie's or `Accept-Language`'s language. An extension earns
  nothing: `/wp-login.php` and `/fr/x.php` are `gone` like any dead path.
  `/<locale>/404/404` is the 404's own route and passes; `404` is a reserved
  slug.
- **Antispam.** The honeypot outranks everything and spends nothing; every
  other submission spends the limiter, so the verdict order is honeypot >
  rate-limited > too-fast. Past `maxKeys` distinct keys in a window, new keys
  share one overflow bucket.
- **Service area.** No `address`, `geo`, `image` or `hasMap`; its communes
  are `City` in `areaServed` (a storefront's stay `Place`, as aquafix already
  says), a radius a `GeoCircle`.
- **No domain.** The site is off the web: every page `noindex, nofollow`
  (the brand page included), **no** `alternates` and no `openGraph.url` (a
  relative one names no page); the OG image and the JSON-LD `@id`s are
  root-relative; robots `Disallow: /` with no sitemap line; the sitemap empty.

Changing an expected value changes what a crawler reads — do it in its own
commit, saying why.
