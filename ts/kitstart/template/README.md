# Brand landing — skeleton

A landing on `@evinvest/kitstart`: the machinery (routing, places, the lead
funnel, SEO) is the package's; the copy, the palette, the sections and the
config are yours. As shipped it is one service-area place on one site, before
launch — `noindex` everywhere until `assets/card.toml` gets a `site`.

## Twelve steps

1. Copy this directory into the new repo; `npm install`.
2. `flake.nix` = `mkLanding { … }` from the lib flake (container, smoke,
   bundle-budget check); `nix develop`.
3. `assets/brand.toml` → `npm run palette` (writes `app/brand.css`).
4. `assets/card.toml`: the email now; `phone` and `site` when the owner has them.
5. `assets/mark.svg`, fonts (`next/font/local` needs literal paths), the OG
   route's `fonts`.
6. `src/shared/config/site.ts`: brand facts, topology (`single`, or
   `subdomains` for a network), pages, the publication gate, `OWNER_TODO`.
7. `src/shared/config/places.ts`: the places, storefront or service area.
8. `src/entities/content`: `Text extends CoreText`, one object per language,
   checked with `satisfies`.
9. `src/shared/config/lead.ts`: what the form asks (`subjects`, `wire`, `extras`).
10. `src/views/`: the brand's sections around the package's widgets.
11. Tests: `tests/contract.test.ts` runs the landing contract; add the copy's
    own, the e2e sections (`tests/e2e`, baselines from CI on Linux) and set
    `tests/bundle_budget.txt` from the first `npm run size`.
12. `deploy/config.nix`, gitops. Without a domain the deploy is noindex.

## What must stay a literal

Next reads these statically, so they live in the route files, not the package:
`export const dynamic`, `revalidate`, `generateStaticParams`, `config.matcher`
in `proxy.ts`, and every `next/font/local` path. Everything else is a factory
call.

## The rules that keep pages cached

No page, layout or boundary reads the request (`headers()`, `cookies()`): the
link mode rides in the `[location]` param, and the not-found and error screens
read `useParams()`. A page that did would render per request again. The quote
route, the sitemap and robots are dynamic on purpose.
