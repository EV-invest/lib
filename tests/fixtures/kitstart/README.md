# kitstart shared fixtures

Test vectors for the landing machinery, read by both ports: `ts/kitstart`
(vitest) and the Rust `kitstart` feature. Data only — no code here.

| File | Case shape | Expected |
|---|---|---|
| `sites.json` | `{ <name>: site }` — `pages` as `[{ key, suffix }]`, `legacyRedirects` as `{ from, to: { "null" \| "<locale>": path } }` (a missing key is "no redirect"), `publication` as `"storefront"` \| `"service-area"` | — |
| `decide.json` | `{ site, request: { host, pathname, query, acceptLanguage, cookieLang } }`, `query` the raw string | `decision: { kind, location? , locale?, pathname? }` |
| `json-ld.json` | `{ site, place, locale, page, mode, copy: { placeName, title, description, offers, faq } }`, top-level `now` | the page's `@graph` |
| `metadata.json` | `kind: "place"` (`place`, `locale`, `page`, `mode`, `copy: { title, description }`), `"brand"` (`locale`, `copy`), `"status"` (`copy.title`) | the Next `Metadata` object |
| `sitemap.json` | `{ site, host, places }` — `places` already overlaid with the live source | `{ sitemap, robots }` |

Three sites: `aquafix` (storefronts on subdomains), `cleaning` (one
service-area place on a `single` site) and `prelaunch` (`cleaning` with
`domain: null`).

For `aquafix`, `expected` in `json-ld.json`, `metadata.json` and
`sitemap.json` is copied verbatim from `Service-Arb/aquafix@33e3198`
`tests/golden/`; the `copy` each case feeds the builders is read back out of
the same goldens, because it is brand prose, not machinery. The `cleaning/*`
and `prelaunch/*` cases have no aquafix to copy: their `expected` comes from
the TS builders, which are primary.

What those cases pin:

- a service-area business has no `address`, `geo`, `image` or `hasMap`; its
  communes are `City` in `areaServed` (a storefront's stay `Place`, as
  aquafix already says), a radius a `GeoCircle`;
- a site with no domain is off the web: every page `noindex, nofollow` (the
  brand page included), **no** `alternates` and no `openGraph.url` (a
  relative one names no page); the OG image and the JSON-LD `@id`s are
  root-relative; robots `Disallow: /` with no sitemap line; the sitemap empty. Compare serialised (key order is part of the
contract). `decide.json` follows aquafix's `tests/l10n.test.ts` with the link
mode moved into the path (`Service-Arb/aquafix#13`), plus a `single`-topology
site aquafix cannot exercise.

Changing an expected value changes what a crawler reads — do it in its own
commit, saying why.
