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

`expected` in `json-ld.json`, `metadata.json` and `sitemap.json` is copied
verbatim from `Service-Arb/aquafix@33e3198` `tests/golden/`; the `copy` each
case feeds the builders is read back out of the same goldens, because it is
brand prose, not machinery. Compare serialised (key order is part of the
contract). `decide.json` follows aquafix's `tests/l10n.test.ts` with the link
mode moved into the path (`Service-Arb/aquafix#13`), plus a `single`-topology
site aquafix cannot exercise.

Changing an expected value changes what a crawler reads — do it in its own
commit, saying why.
