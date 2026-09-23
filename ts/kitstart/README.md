# @evinvest/kitstart

The machinery of a local-service landing site — the part every brand of the
vertical shares, lifted out of the aquafix reference site so a new brand is a
`site.ts`, its copy and its own sections.

What is here is **behaviour**, not look: routing between subdomains and
locales, the place model and its publication gate, the lead funnel and its
antispam, schema.org and sitemaps, analytics events. What a brand looks like
stays in the brand.

## Subpaths

| Import | Runtime | What |
|---|---|---|
| `@evinvest/kitstart` | anywhere (edge, client, server) | `defineSite`, places, routing (`createRouting`), the lead schema and funnel (`createAcceptLead`), antispam, JSON-LD / sitemap / robots builders, analytics events, the copy contract |
| `@evinvest/kitstart/server` | Node, `server-only` | `createServerEnv`, `createPlaceSource`, the lead store (`openLeadStore` by `LEADS_DB_URL`: `sqlite:` today, `postgres://` a stub that refuses at boot), `checkLeadStore`, `leadNotifier`, `sendMail`, `clientKey` |
| `@evinvest/kitstart/proxy` | edge | `createProxy(site)`, `PROXY_MATCHER` |
| `@evinvest/kitstart/next` | Next server (routes, RSC) | `quoteRoute`, `sitemapRoute`, `robotsRoute`, `ogRoute`, `healthRoute`, `createPlaceLoader`, `loadLocale`, `placeMetadata` / `brandMetadata` / `statusMetadata`, `metadataBase` |
| `@evinvest/kitstart/next/config` | `next.config.ts`, `vitest.config.ts` | `withLanding`, `buildEnv` and the `assets/` readers |
| `@evinvest/kitstart/react` | either side | `LangSwitch`, `CallBar`, `StatusScreen`, `PlaceDirectory`, `AreaChips`, `Coverage`, `MapFacade` (client), `QuoteFormShell`, `Faq`, `AnalyticsBoundary` (client), plus the kit and marketing pieces a landing composes with |
| `@evinvest/kitstart/testing` | a brand's vitest | `describeLandingContract(site, { globalsCss, proxySource, text })`, `describeLeadStoreContract(name, harness)`, `storefrontPlace`, `serviceAreaPlace`, `testLead` |
| `@evinvest/kitstart/testing/e2e` | a brand's Playwright | `defineSectionSuite(sections)`, `settle(page, selector)`, `BREAKPOINTS` |
| bin `kitstart-size` | plain node | `kitstart-size [<build root>] [--route …] [--budget …]`: first-load JS of a place page against `tests/bundle_budget.txt`; fails closed |

`vitest` and `@playwright/test` are optional peers, needed only by the
suites.

## A new brand

`template/` (shipped in the tarball too) is the skeleton: a `single`-topology,
service-area site before launch (no `site` in `assets/card.toml` → noindex,
robots disallow), with every route file a few literal lines over a factory.
Copy it, then follow its README. CI builds it on every PR exactly as a brand
would — packed tarballs, `next build`, its own tests, `kitstart-size`, and a
live standalone server answering `/`, `/fr`, a page, a 404, the form POST, the
OG card and robots (`npm run check:template`).

## Nix: `lib.mkLanding`

The lib flake exports the flake a landing shares (`nix/mk-landing.nix`), so a
brand's `flake.nix` is its own config plus one call:

```nix
landing = ev.lib.mkLanding {
  inherit pkgs v_flakes;
  root = ./.;
  pname = "vifnet";
  sitePort = "59082";
  buildFiles = [ "package.json" "package-lock.json" "app" "src" "assets"
                 "next.config.ts" "tsconfig.json" "postcss.config.mjs"
                 "proxy.ts" "instrumentation.ts" ];
  prodEnv = import ./deploy/config.nix { port = "59082"; };
  smoke = { page = "/fr"; quote = { location = "paris"; subject = "standard"; locality = "75011"; mobile = "0612345678"; }; };
};
# packages = landing.packages; checks = landing.checks; apps = landing.apps;
```

It gives `packages.site` (the hermetic `next build` from `package-lock.json`
via `importNpmLock`, foreign native binaries never fetched) and
`packages.container` (the OCI image, node-slim), `checks.bundle-budget`
(`kitstart-size` on the Nix build), and the apps `dev`, `size` and
`container-smoke`. The smoke lets docker pick the host port
(`-p 127.0.0.1::<port>`): landing ports sit in Linux's ephemeral range, and a
fixed host port flakes with `address already in use`. The lib's own CI builds
it against a stand-in brand (`nix/mk-landing-fixture`), image included.

Bump the npm version and the flake revision a brand uses in one PR: the size
gate runs the lib's copy of `kitstart-size`.

## Widgets

Structural only — where behaviour matters more than look. Marketing sections
(hero, prices, reviews…) stay in the brand until two brands hold the same one.
Each widget is a Server Component unless it needs the browser (`MapFacade`,
`AnalyticsBoundary`), styled with the kit's token roles only, restyled through
`className`. `QuoteFormShell` is headless: it owns the hidden fields and the
honeypot the funnel reads; the visible fields are the brand's children.
`StatusScreen` takes the brand's name and marks as props, so the client error
boundary never imports the site config.

Tailwind v4 does not scan `node_modules`; the brand's `globals.css` names the
package:

```css
/* app/globals.css; from src/app/ it is ../../node_modules/… */
@source "../node_modules/@evinvest/kitstart/dist";
```

Visual baselines: `test/visual/` renders each widget to a static page
(`react-dom/server` over the kit's `tokens.css`), and `nix run
.#kitstart-visual` captures and compares them byte for byte on Linux. PNGs
come from the `kitstart-visual` CI artifact only.

## Thin `app/` routes

Segment config, `config.matcher` and `next/font/local` must be literals in the
route file — Next reads them statically — so the literal stays in the brand's
file and the handler comes from a factory:

```ts
// proxy.ts
export const proxy = createProxy(site);
export const config = { matcher: ["/((?!_next/|.*\\.[a-z0-9]+$).*)"] };

// app/quote/route.ts
export const dynamic = "force-dynamic";
export const POST = quoteRoute(site, { env: serverEnv, notifier, unavailable });

// app/sitemap.ts — reads the Host header, so it is dynamic; pages are not
export const dynamic = "force-dynamic";
export default sitemapRoute(site, places);

// app/[locale]/[location]/layout.tsx — ISR: no page reads the request
export function generateStaticParams() { return []; }
export const revalidate = 600;
```

`createPlaceLoader(site, places)(params)` returns the `PlaceView` for a page,
reading the link mode from the `location` param (`_royat` = host mode).

**Dead paths.** Next 16 answers a `notFound()` with an empty shell it fills in
after hydration — a blank page without JavaScript. So the proxy knows the dead
paths itself (`decide` → `gone`) and rewrites each to `/<locale>/404/404`, a
path no route matches, with the language and place in `GONE_HEADER`. The
brand's `app/global-not-found.tsx` (`experimental.globalNotFound`, set by
`withLanding`) reads that header — the only thing that does — and renders the
404 on the server with `statusTarget(site, parseGoneHeader(…))`. The
`notFound()` boundary under `[locale]` stays for what the proxy cannot foresee
(a place the live source withdrew); it and `error.tsx` are client modules and
take `brandStatusTarget({ locales, phone }, locale)`, never the site config,
which would carry every place into every page's bundle. Redirects the proxy
chooses per visitor answer `Cache-Control: private, no-store`.

## Server invariants

- **A page's place loader never throws on the live source.** Pages are cached
  (ISR); a cold render that throws is Next's bare `Internal Server Error`
  with no phone on it. A 5xx or an unreachable source serves the baked place
  (`noindex` until the gate fields are back); only a 410, or a 404 in the
  source's own JSON, withdraws a place — a bare 404 is an ingress, not the
  source. The sitemap is the one strict reader (`getPlaceStrict` throws).
- **The lead is durable before anything else happens.** Every `LeadStore`
  adapter passes `describeLeadStoreContract` and migrates itself to
  `LEAD_SCHEMA_VERSION` on open. SQLite keeps the Rust server's columns
  (`job`, `zip`, `mobile`) and recognises every earlier table in place.
- **Mail is checked at boot.** With `SMTP_URL` set, `leadNotifier` throws when
  it is built if the URL is malformed (the error never repeats it), there is
  no sender (`LEAD_NOTIFY_FROM`, or `leads@<domain>`) or no recipient
  (`LEAD_NOTIFY_TO`, or the brand's email). Both are bare addresses
  (`leads@brand.fr`), not `Name <…>`. Off loopback, a server without TLS gets
  nothing; past `MAIL_PER_MINUTE` a minute the lead is stored and only logged.
- **The rate limit knows whose address it counts.** `TRUSTED_PROXY` is
  `cloudflare` (only `CF-Connecting-IP`) or `xff:<n>` (the n-th
  `X-Forwarded-For` hop from the right); production refuses to boot without it.
- **SQLite wants one writer node.** The file lives on a ReadWriteOnce volume
  mounted by one node; pods on it take turns through `busy_timeout`. A shared
  network filesystem is not a place for it — that is what the Postgres port
  is for.

## The site

```ts
import { createLocaleRegistry, defineSite, STOREFRONT_GATE } from "@evinvest/kitstart";

export const site = defineSite({
  brand: { id: "aquafix", name: "Aquafix", legalName: "Aquafix SAS", email, phone, domain: "aquafix.top", businessType: "Plumber" },
  i18n: createLocaleRegistry({ locales: ["fr", "en"], labels, default: "fr", prefixDefaultLocale: true, hreflang: { fr: "fr-FR" } }),
  ogLocale: { fr: "fr_FR", en: "en_GB" },
  topology: { kind: "subdomains", apex: "directory" }, // or { kind: "single", place: "paris" }
  pages: { home: "", prices: "/prices" },
  places: PLACES,
  publication: STOREFRONT_GATE,
  lead: LEAD,
});
```

`domain: null` is a site before launch: every page `noindex`, robots disallow
everything, the sitemap empty.

## Routing: the link mode rides in the path

Pages are cached (ISR), so no page may read a request header. The proxy tells a
page how to write its links through the route it rewrites to:

| Request | Rendered route | Links |
|---|---|---|
| `royat.aquafix.top/fr/prices` | `/fr/_royat/prices` | `/fr/…` (host mode) |
| `aquafix.top/fr/royat/prices` | as is | `/fr/royat/…` (path mode) |
| single site `clean.example/fr/prices` | `/fr/_paris/prices` | `/fr/…` |

`parsePlaceParam("_royat")` reads the mode back out of the `[location]` param.

## Publishing

`package.json` says `0.0.0` on purpose: `nix run .#publish -- minor` bumps it
to `0.1.0`, the version `template/` asks for (`^0.1.0`). kitstart's peers
must be on the registry first, so a release is two runs:

1. `nix run .#publish -- minor --npm-only --only @evinvest/uikit --only @evinvest/marketing`,
   then wait until `npm view @evinvest/uikit version` answers the new one;
2. `nix run .#publish -- minor --npm-only --only @evinvest/kitstart`.

The first publish of a new name in the scope needs an automation or classic
token: a granular token cannot create a name. Bump the lib flake revision a
brand pins (`mkLanding`) in the same PR as its npm version.

## Shared fixtures with Rust

`tests/fixtures/kitstart/` at the repo root holds the site configs, routing
decisions and the JSON-LD / metadata / sitemap goldens (aquafix's, verbatim).
This package's tests and the Rust `kitstart` feature both run them; a change to
a builder's output is a change to those files, visible in review.
