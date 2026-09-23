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

More subpaths (`./proxy`, `./next`, `./react`, `./testing`) land in the
following PRs of the stack.

## Server invariants

- **A page's place loader never throws on the live source.** Pages are cached
  (ISR); a cold render that throws is Next's bare `Internal Server Error`
  with no phone on it. A 5xx or an unreachable source serves the baked place
  (`noindex` until the gate fields are back); only a 404 is "gone". The
  sitemap is the one strict reader (`listPlaces(locale, "sitemap")` throws).
- **The lead is durable before anything else happens.** Every `LeadStore`
  adapter passes `describeLeadStoreContract` and migrates itself to
  `LEAD_SCHEMA_VERSION` on open. SQLite keeps the Rust server's columns
  (`job`, `zip`, `mobile`) and recognises every earlier table in place.
- **Mail is checked at boot.** With `SMTP_URL` set, `leadNotifier` throws when
  it is built if there is no sender (`LEAD_NOTIFY_FROM`, or `leads@<domain>`)
  or no recipient (`LEAD_NOTIFY_TO`, or the brand's email). Off loopback, a
  server without TLS gets nothing.

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
