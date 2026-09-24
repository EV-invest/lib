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
| `@evinvest/kitstart/react` | either side | `LangSwitch`, `CallBar`, `StatusScreen`, `PlaceDirectory`, `AreaChips`, `Coverage`, `MapFacade` (client), `QuoteFormShell`, `FormSelect` (client), `Faq`, `AnalyticsBoundary` (client), plus the kit and marketing pieces a landing composes with |
| `@evinvest/kitstart/testing` | a brand's vitest | `describeLandingContract(site, { globalsCss, proxySource, text })`, `describeLeadStoreContract(name, harness)`, `storefrontPlace`, `serviceAreaPlace`, `testLead` |
| `@evinvest/kitstart/testing/e2e` | a brand's Playwright | `defineSectionSuite(sections)`, `settle(page, selector)`, `BREAKPOINTS` |
| bin `kitstart-size` | plain node | `kitstart-size [<build root>] [--route …] [--budget …]`: first-load JS of a place page against `tests/bundle_budget.txt`; fails closed |

`vitest` and `@playwright/test` are not peers at all: they are the brand's
own test runners, which it installs in its `devDependencies`. As peers —
even optional ones — npm counted them among a brand's production
dependencies, and a runner's advisory turned `npm audit --omit=dev` red.

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
brand's `flake.nix` is its own config plus one call — `template/flake.nix` is
the whole of one:

```nix
inputs.ev.url = "github:EV-invest/lib?ref=@evinvest/kitstart-v0.2.0"; # the version in package-lock.json
inputs.ev.inputs.v_flakes.follows = "v_flakes";

landing = ev.lib.mkLanding {
  pkgs, root, pname, sitePort, buildFiles,        # required
  prodEnv ? { },                                  # baked into the image (deploy/config.nix)
  v_flakes ? null,                                # without it: no `container`
  nodejs ? pkgs.nodejs_22, nodeRuntime ? pkgs.nodejs-slim_22,
  budgetFile ? "tests/bundle_budget.txt", gatedRoute ? "/[locale]/[location]",
  requiredFiles ? [ ],                            # must be in the standalone output (OG fonts)
  mounts ? [ "/data" ], criticality ? "high",
  smoke ? { page = "/fr"; },                      # + host, og, quote = { field = value; }
  containerAttr ? ".#container",
  checkKitstartVersion ? true,
  e2eConfig ? "tests/e2e",
  packageSourceOverrides ? { },                   # lock key → `file:`/vendored tarball
};
# → { site, bundleBudget, packages.{default,site,container}, containers,
#     checks.{site,bundle-budget}, apps.{default,help,dev,test,accept-test,size,container-smoke},
#     devShell }
```

- `site`: the hermetic `next build` from `package-lock.json` through
  `importNpmLock` (dependencies keyed on the manifest and the lock only;
  foreign optional native binaries never fetched — the self-check's lock
  carries a Windows-only package with a bogus integrity to prove it).
  `packageSourceOverrides` serves lock entries the registry cannot yet —
  `{ "node_modules/@evinvest/kitstart" = ./vendor/kitstart.tgz; }` builds a
  brand against an unpublished kitstart; the self-check vendors one package
  whose `resolved` 404s.
- `container`: the OCI image on node-slim, `prodEnv` baked in.
- `checks.bundle-budget`: `kitstart-size` on the Nix build.
- `apps.test` (tsc — the app, then `e2eConfig` as its own project with its own
  `tsconfig.json` — lint, vitest, build, size, Playwright on the flake's
  pinned browsers), `accept-test` (Linux only), `size`, `dev`, `help`.
- `apps.container-smoke`: boots the image with a host port docker picks
  (`-p 127.0.0.1::<port>`: landing ports sit in Linux's ephemeral range), checks
  `/health`, the 302, the page, the OG card and the form POST landing in the
  mount, then boots it again with every `prodEnv` key blanked and wants 500 —
  and once more with only the lead store's key (`LEADS_DB_PATH` /
  `LEADS_DB_URL`) blanked, wanting 500 from the store's refusal alone.

**Versions move together.** mkLanding refuses a lock whose
`@evinvest/kitstart` differs from the lib revision's
`ts/kitstart/package.json`: the size gate runs the lib's copy of the bin, and
the two must be one release. Pin the flake to the matching
`@evinvest/kitstart-vX.Y.Z` tag.

## Widgets

Structural only — where behaviour matters more than look. Marketing sections
(hero, prices, reviews…) stay in the brand until two brands hold the same one.
Each widget is a Server Component unless it needs the browser (`MapFacade`,
`AnalyticsBoundary`, `FormSelect`), styled with the kit's token roles only, restyled through
`className` — and, where a brand needs geometry inside one (`Faq`, `CallBar`,
`StatusScreen`, `PlaceDirectory`, `Coverage`), through its named parts:
`classNames={{ list: "rounded-none", answer: "px-2" }}`, merged after the
kit's classes so the brand's utility wins. No descendant selectors: they
break silently when a widget's markup moves. A size in a part keeps the
kit's line height: tailwind-merge drops an earlier `leading-*` for any later
font size, so the widgets put their `leading-*` after the brand's classes —
`code: "text-[88px]"` stays `leading-none`. To change the line height, name
it (`"text-[88px] leading-tight"`, or `"text-lg/7"`). The header's language
switch is `StatusScreen`'s `lang`: below `md` it takes a row of its own
(`order-last w-full`); `lang: "order-none w-auto"` keeps one row.
`QuoteFormShell` is headless: it owns the hidden fields and the
honeypot the funnel reads; the visible fields are the brand's children.
`StatusScreen` takes the brand's name and marks as props, so the client error
boundary never imports the site config.

### `FormSelect`: a choice that posts without JavaScript

A form's select, for the fields inside `QuoteFormShell`. On the server and
without JavaScript it is the kit's `NativeSelect` — a real `<select name>`
the form posts as is. After hydration (`useSyncExternalStore`, so the
server's HTML and the first client render agree) it is the kit's `Select`:
the list drawn in the palette, never the platform's menu, and the value in an
input of the same `name`. Both states are one box — height, width, border,
radius and inset — so the swap moves nothing (checked by the template's e2e).

```tsx
<Field className="flex flex-col gap-2">
  <FieldLabel>{t.quoteLabels.subject}</FieldLabel>
  <FormSelect
    name={LEAD.wire.subject}
    size="lg"
    defaultValue={LEAD.subjects[0]}
    options={LEAD.subjects.map(s => ({ value: s, label: t.subjects[s] }))}
  />
</Field>
```

| Prop | |
|---|---|
| `name`, `options: { value, label }[]` | the posted field and its choices (labels are text) |
| `defaultValue` | without it: empty under a `placeholder`, else the first option — the native rule |
| `placeholder` | an empty, unpickable choice shown until one is made |
| `required`, `disabled` | as on a `<select>`: required refuses the submit, disabled posts nothing |
| `size` | `sm` · `md` · `lg` (the landing's) — the kit's form scale |
| `id`, `aria-describedby`, `aria-invalid` | inside a `Field` the id comes from it: its `FieldLabel` names the `<select>` before hydration and the trigger after |
| `className` · `classNames={{ trigger, content, item }}` | the shared box · the control in both states, the list, its rows |
| `onValueChange` | the chosen value, after hydration |

- **The value survives the swap.** A choice made in the native select before
  the script arrived is read in the hydration commit; a form `reset` puts the
  default back in both states.
- **`required` still refuses the submit.** A `type="hidden"` input is never
  validated, so under `required` the value rides in a transparent input under
  the trigger, out of the tab order and the accessibility tree. When it is the
  form's first invalid field, the trigger takes focus with its list open and
  `aria-invalid` (the error border), where the browser's bubble would have
  pointed at nothing.
- **Keyboard and screen readers** are the kit's `Select`: the arrows open
  it, opening lands on the chosen option, Enter chooses, Escape and Tab close
  with focus back on the trigger; the trigger is a `combobox` named by the
  `FieldLabel`, with the kit's focus ring.
- **Weight.** It is a client module and pulls the kit's `Select` into the
  page: 3.8 KB gz of first-load JS on the template's place page (152,774 →
  156,565 B of its 158,000 B budget).

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
// Files too: `decide` passes the routes outside `[locale]` and
// `site.publicFiles` (`/icon.svg`), and 404s every other path, `/wp-login.php`
// included — let past, it would be a cached bare 404 without the phone.
export const config = { matcher: ["/((?!_next/).*)"] };

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
