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

More subpaths (`./server`, `./proxy`, `./next`, `./react`, `./testing`) land
in the following PRs of the stack.

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

## Shared fixtures with Rust

`tests/fixtures/kitstart/` at the repo root holds the site configs, routing
decisions and the JSON-LD / metadata / sitemap goldens (aquafix's, verbatim).
This package's tests and the Rust `kitstart` feature both run them; a change to
a builder's output is a change to those files, visible in review.
