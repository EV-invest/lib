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
| `@evinvest/kitstart/server` | Node, `server-only` | `createServerEnv`, `createPlaceSource`, the lead store (`openLeadStore` by `LEADS_DB_URL`: `sqlite:` today, `postgres://` a stub that refuses at boot), `checkLeadStore`, `leadNotifier`, `leadWebhook` (signed, outboxed), `sendMail`, `clientKey` |
| `@evinvest/kitstart/proxy` | edge | `createProxy(site)`, `PROXY_MATCHER` |
| `@evinvest/kitstart/next` | Next server (routes, RSC) | `quoteRoute`, `sitemapRoute`, `robotsRoute`, `ogRoute`, `healthRoute`, `createPlaceLoader`, `loadLocale`, `placeMetadata` / `brandMetadata` / `statusMetadata`, `metadataBase` |
| `@evinvest/kitstart/next/config` | `next.config.ts`, `vitest.config.ts` | `withLanding`, `buildEnv` and the `assets/` readers |
| `@evinvest/kitstart/react` | either side | `LangSwitch`, `CallBar`, `StatusScreen`, `PlaceDirectory`, `AreaChips`, `Coverage`, `MapFacade` (client), `QuoteFormShell`, `FormSelect` (client), `LeadCapture` (client), `Faq`, `AnalyticsBoundary` (client), plus the kit and marketing pieces a landing composes with |
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
inputs.ev.url = "github:EV-invest/lib?ref=@evinvest/kitstart-v0.5.0"; # the version in package-lock.json
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
radius and inset — so the swap moves nothing (checked by the template's e2e,
which CI runs: `npm run check:template -- --e2e`).

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
  default back in both states. With nothing chosen (under a `placeholder`) it
  posts nothing, as a native select on its disabled placeholder does.
- **`required` still refuses the submit.** A `type="hidden"` input is never
  validated, so under `required` the value rides in a transparent input under
  the trigger, out of the tab order, the accessibility tree and autofill. An
  invalid field's trigger takes `aria-invalid` (the error border). On a submit
  — and only then — the form's first invalid field also takes focus with its
  list open, where the browser's bubble would have pointed at nothing; a
  script's `checkValidity()` marks it and moves nothing.
- **Keyboard and screen readers** are the kit's `Select` (its README has the
  focus pattern): the arrows open it, opening lands on the chosen option,
  letters jump, Enter chooses, Escape and Tab close with focus back on the
  trigger; the trigger is a `combobox` named by the `FieldLabel`, and so is
  its list, with the kit's focus ring.
- **Weight.** It is a client module and pulls the kit's `Select` into the
  page: 3.8 KB gz of first-load JS on the template's place page (152,774 →
  156,565 B of its 158,000 B budget).

### `LeadCapture`: the lead form every brand shares

One form for every brand, so an experiment's results pool across sites (the
site is the stratum). A client island over `QuoteFormShell`: without a script
it is the plain POST to `/quote` it always was.

```tsx
<LeadCapture
  place={view.place}
  contact={contactOf(site, view.place)}
  locale={view.locale}
  renderedAt={renderedAt}
  wire={LEAD.wire}
  needs={LEAD.subjects.map(s => ({ value: s, label: t.subjects[s] }))}
  text={{ ...LEAD_CAPTURE_TEXT[view.locale], submit: "…" }}
  layout={arm === "b" ? "qualify-first" : "single"}
  experiment={{ name: "lead_layout", variant: arm }}
/>
```

| Prop | |
|---|---|
| `place`, `contact` | the hours order the channels, the service area suggests the commune; `contact` is `contactOf(site, place)` — a `null` number is a channel not offered |
| `locale`, `renderedAt` | the page's language; the render stamp (time trap, and "now" until the script runs) |
| `wire`, `needs` | `site.lead.wire`; the subjects with their labels |
| `need` | the need the page already knows — also set by `?need=` and by a tap on any `[data-need="…"]` element |
| `layout` | `single` (default) · `qualify-first`: a tile per need, then the contact step |
| `locality` | `required` (default) · `optional` |
| `name` | `{ field, required? }`: a name field posted as the brand's extra; off by default |
| `extras` | the brand's own fields, after the phone |
| `prefer` | a channel moved first when available (a `default_channel` arm) |
| `experiment` | `{ name, variant }`, slugs: on every event and posted with the form |
| `timeZone` | `Europe/Paris` by default |
| `formId`, `id` | `quote` · `quote`; the callback is `<id>-callback` (its form `<id>-callback-form`) |
| `text` | `LeadCaptureText`: `LEAD_CAPTURE_TEXT.fr` / `.en`, plain strings (`{need}`, `{day}`, `{time}` filled in) |
| `head`, `trust` | the brand's heading instead of the title; a slot beside the submit |
| `className` · `classNames` | the root · its parts (`form`, `field`, `label`, `control`, `submit`, `need`, `channel`, `primary`, `callback`…) |

- **Taps.** A need the page knows is not asked again, and a place serving one
  commune fills it: focus the phone, type, send — two taps. `qualify-first`
  with no need: the tile, which moves the focus to the first empty field (the
  phone when the commune is filled), then send.
  `single` with no need takes the first one unless changed (two more taps).
  Enter sends.
- **Channels** (`resolveChannels`, shared with `CallBar`): call (`tel:`),
  WhatsApp and SMS (the need in the message; SMS only to a mobile), "call me
  back" and the form. Open, the call leads; closed, the callback (open) and
  WhatsApp lead and the call goes last, and the form says when the next
  opening is — from the place's hours, never invented. No hours: no promise,
  the open order. No number: no call, text or WhatsApp. `CallBar` orders its
  buttons the same way when given `hours` (and `now={renderedAt}`, and
  `callback={{ href: view.href("#quote-callback"), label }}`); without
  `hours` it is unchanged.
- **Callback.** A `<details>` with its own small form: the phone and a native,
  required consent, posted to `/quote` with `channel=callback`. The lead is
  held to `lead.validateCallback` (a readable number, by default), not to the
  form's rule, and stored with its channel.
- **Phone.** `type="tel"`, required, never masked. A number that does not read
  as one gets a hint when the field is left; the server keeps it. With
  `lead.mobileFormat: "e164"` a number it can read is stored as
  `+33612345678` (`normalizePhone`); the default keeps it as typed, which is
  what a brand's tests and tooling look rows up by.
- **Events** (through `AnalyticsBoundary`'s sink; none outside one):
  `lead_form_view` (half in view, once), `lead_form_start` (first focus),
  `lead_form_field_error {field}` (the browser refused it, or the phone hint
  showed — the field's role, never its value), `lead_form_step {step}`
  (`contact` / `need`), each with `form_id`, `layout`, `experiment`,
  `variant`; `contact_intent_click {channel}` for `phone`, `whatsapp`, `sms`,
  `callback`, with the experiment; and on the server `lead_form_submit
  {form_id, channel}` with the posted experiment.
- **Weight.** 5.6 KB gz of first-load JS on the template's place page
  (157,287 → 162,938 B of its 164,000 B budget).

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

## Lead webhook

A signed POST of each lead to a receiver the brand names, delivered through an
outbox in the leads file. The kit knows no receiver: the brand builds the body
and passes the signing scheme; the kit serialises, signs, stores and retries.

```ts
// shared/config/env.ts
import { createServerEnv, leadWebhook, type LeadWebhook } from "@evinvest/kitstart/server";

export const serverEnv = createServerEnv(site);
let hook: LeadWebhook | null | undefined;
export const webhook = (): LeadWebhook | null =>
  (hook ??= leadWebhook(site, serverEnv(), {
    // The receiver's scheme, all of it: the kit has no defaults.
    signing: {
      prefix: "sa-ingest/v1.",
      headers: { keyId: "x-sa-key-id", timestamp: "x-sa-timestamp", signature: "x-sa-signature" },
    },
    buildBody: (lead, ctx) => ({ events: [/* the receiver's shape, from lead + ctx */] }),
  }));

// instrumentation.ts, in register(): resume the queue after a restart
webhook()?.start();

// app/quote/route.ts
export const POST = quoteRoute(site, { env: serverEnv, notifier, webhook, unavailable });
```

- **Off unless both halves are there.** No `LEAD_WEBHOOK_URL`, or no
  `buildBody` → `leadWebhook` returns `null`. With the URL,
  `LEAD_WEBHOOK_KEY_ID` and `LEAD_WEBHOOK_SECRET` are required, and the URL
  must be `https:`, or `http:` to a `*.svc` / `*.svc.cluster.local` host or
  loopback — the body carries PII. All checked at boot.
- **The channel.** `channelOf(lead)` is `form` or `callback`. For the
  Service-Arb panel, map it through `panelChannel`: its `properties.channel`
  is a closed set and refuses the whole event outside it, so a callback goes
  as `form` until the panel accepts `callback` (one constant to flip).
- **Queued before the 303, sent after it.** The body is built once, from the
  lead and `ctx` (`leadId`, `brandId`, `locale`, `formId`, `at`, and a fresh
  `idempotencyKey` for the receiver to deduplicate by), and written to the
  `webhook_outbox` table before the visitor is thanked; the send runs in
  `after`. A lead the notifier skips (honeypot, rate limit) is not queued.
- **Signature.** Three headers named by `signing.headers`: the key id, the
  timestamp (unix seconds) and `hex(HMAC-SHA256(secret, prefix + timestamp +
  "." + body))`, signed afresh on each attempt. Prefix and names are required.
- **At-least-once.** 2xx is delivered. A `207` is delivered too, and an item
  it marks `rejected` is final — logged by index, not retried. 5xx, 408, 429
  and network errors retry, doubling from 5 s up to an hour (with jitter, and
  at least `Retry-After`), `WEBHOOK_MAX_ATTEMPTS` (12) times; any other status,
  3xx included, is final. A final row stays as `dead` with its `last_error`.
- **PII stays in the body.** Logs name the row, the attempt and the status;
  the receiver's own words (which may echo a field) go to the row's
  `last_error`, never to the log.
- **Restarts.** Rows are in the leads file; `start()` ticks every
  `WEBHOOK_TICK_MS` and a new process picks up what is due. Rows queued for a
  previous URL stay in place and are counted at open.

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

`template/` follows the release on its own: `nix run .#publish` rewrites a
template range that no longer admits a version it just published to
`^<version>`, and on a kitstart release moves the `@evinvest/kitstart-v…` pin in
`template/flake.nix` and this README — all in the release commit, so the tag
lands on a template that already points at it. kitstart publishes last in a
run, so its tarball carries the new ranges. A run without kitstart still
moves the template, but the kitstart tarball already on npm ships the old one,
so that run ends by printing the `--only @evinvest/kitstart` command that
releases it. A range the script cannot read, or a branch behind its upstream,
stops the run before anything is published. `npm test` fails whenever the
template stops admitting the workspace versions. kitstart's peers must be on
the registry first, so a release is two runs:

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
