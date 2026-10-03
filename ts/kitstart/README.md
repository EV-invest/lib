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
| `@evinvest/kitstart` | anywhere (edge, client, server) | `defineSite`, places, routing (`createRouting`), the lead schema and funnel (`createAcceptLead`), the price list (`PricingModel`, `priceOf`, `flowOf`), antispam, JSON-LD / sitemap / robots builders, analytics events, the copy contract |
| `@evinvest/kitstart/server` | Node, `server-only` | `createServerEnv`, `createPlaceSource`, `createPricingSource`, the lead store (`openLeadStore` by `LEADS_DB_URL`: `sqlite:` today, `postgres://` a stub that refuses at boot), `checkLeadStore`, `leadNotifier`, `leadWebhook` (signed, outboxed), `sendMail`, `clientKey` |
| `@evinvest/kitstart/proxy` | edge | `createProxy(site)`, `PROXY_MATCHER` |
| `@evinvest/kitstart/next` | Next server (routes, RSC) | `quoteRoute`, `sitemapRoute`, `robotsRoute`, `ogRoute`, `healthRoute`, `createPlaceLoader`, `loadLocale`, `placeMetadata` / `brandMetadata` / `statusMetadata`, `metadataBase` |
| `@evinvest/kitstart/next/config` | `next.config.ts`, `vitest.config.ts` | `withLanding`, `buildEnv` and the `assets/` readers |
| `@evinvest/kitstart/react` | either side | `LangSwitch`, `CallBar`, `StatusScreen`, `PlaceDirectory`, `AreaChips`, `Coverage`, `MapFacade` (client), `QuoteFormShell`, `FormSelect` (client), `LeadCapture` (client), `Faq`, `AnalyticsBoundary` (client), plus the kit and marketing pieces a landing composes with |
| `@evinvest/kitstart/testing` | a brand's vitest | `describeLandingContract(site, { globalsCss, proxySource, text })`, `describeLeadStoreContract(name, harness)`, `storefrontPlace`, `serviceAreaPlace`, `testLead` |
| `@evinvest/kitstart/testing/e2e` | a brand's Playwright | `defineSectionSuite(sections)`, `settle(page, selector)`, `BREAKPOINTS` |
| bin `kitstart-size` | plain node | `kitstart-size [<build root>] [--route …] [--budget …]`: first-load JS of a place page against the target in `tests/bundle_budget.txt` (passes with a warning up to its tolerance, 20 % by default — see [The bundle budget](#the-bundle-budget)); fails closed |

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
inputs.ev.url = "github:EV-invest/lib?ref=@evinvest/kitstart-v0.10.0"; # the version in package-lock.json
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

### The bundle budget

`tests/bundle_budget.txt` holds the **target** — the gzip bytes of
first-load JS the place page should weigh — and, optionally, how far over it
a build may go:

```
# Why the number is what it is (comments are free).
158000
tolerance 20%
```

| Measured | `kitstart-size` |
|---|---|
| ≤ target | passes |
| ≤ target × (1 + tolerance) | passes **with a warning**: the overshoot in bytes and %, and a `::warning::` annotation on GitHub Actions |
| more | fails |

Without a `tolerance` line the tolerance is 20 % — a file of one number, as
every budget was before, is a target. The ceiling rounds down to a whole
byte. The overshoot is meant to be paid back; changing the target or the
tolerance is a deliberate commit, with a reason, as raising the budget was.
`checks.bundle-budget` applies the same rule (no annotation in the sandbox).
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
| `formId`, `id` | `quote` · `quote`: the id is the card's (root), so `#quote` scrolls to the whole card, head included; the form is `<id>-form`, the callback `<id>-callback` (its form `<id>-callback-form`). Both forms post it as `card`, so a refused lead comes back to `#<id>` |
| `text` | `LeadCaptureText`: `LEAD_CAPTURE_TEXT.fr` / `.en`, plain strings (`{need}`, `{day}`, `{time}` filled in); optional `localityPlaceholder`, `phonePlaceholder`, `namePlaceholder` (none by default). The errors are words of the page too: `phoneInvalid`, `required`, `needRequired`, `consentRequired`, `fieldInvalid`, `formInvalid`, and the post's `sending`, `networkError`, `timeoutError`, `retry` — a brand spreading `LEAD_CAPTURE_TEXT` has them |
| `labels` | `visible` (default) · `hidden`: every field's label `sr-only` — still the field's accessible name — for a design that draws placeholders |
| `callbackOpen` | whether the callback starts open; by default only when it leads (the place is closed). `#<id>-callback` opens it either way |
| `done` | the card after a lead is taken — a node, or `(sent: LeadSent) => node` (`{ channel, phone, name }`), shown in place. Without it, a lead taken goes to the thanks page the route names. Either way a script posts the form itself (asking `/quote` for JSON), so a refusal keeps what was typed; an answer that is not the route's, or no network, submits the form for real; without a script nothing changes (303) |
| `flows`, `pricing`, `photos` | how each need is sold (`site.lead.flows`), the page's price list (`createPricingSource(site).model()`), and the `quote` needs priced from photos — see [Form variants](#form-variants-quote-estimate-fixed) |
| `booking` | after a priced lead, in place of "we call you to set the slot": a node or `(sent) => node` — a booking provider's widget, when the brand has one (none ships with the kit) |
| `head`, `trust` | the brand's heading instead of the title; a slot beside the submit. Like `extras`, `done` and `booking`, any node, built on the server or not, and never asked for a `key`: each slot sits alone in a keyed fragment |
| `className` · `classNames` | the root · its parts: `root`, `head`, `title`, `lede`, `form`, `contact`, `field`, `label`, `control` (every input, the need's select in both states, the callback's phone), `hint`, `error` (a refusal: under the field, or above the submit), `chips`, `chip`, `needs`, `need`, `summary`, `submit`, `trust`, `privacy`, `opening`, `others`, `channel`, `primary`, `callback`, `callbackSummary`, `callbackForm`, `callbackLede`, `callbackSubmit`, `consent`, `done`, and for the flows `estimate`, `estimateInput`, `estimateLegend`, `estimateOption`, `price`, `priceTotal`, `breakdown`, `priceNote`, `photos`, `priced`, `pricedPrice`, `pricedNote` |

- **Taps.** A need the page knows is not asked again, and a place serving one
  commune fills it: focus the phone, type, send — two taps. `qualify-first`
  with no need: the tile, which moves the focus to the first empty field (the
  phone when the commune is filled), then send.
  `single` with no need takes the first one unless changed (two more taps).
  Enter sends. From the keyboard the tiles are a radio group: the arrows move
  the choice and stay in it; Enter or Space answers and moves on.
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
  required consent, posted to `/quote` with `channel=callback`. The consent's
  value is the sentence it shows (`text.callbackConsent`, in the page's
  language); the server refuses a callback without it — back to the callback,
  open, naming the consent, whatever the brand's rule — and stores it with the lead:
  `consent_text` word for word, `consent_at` when the server accepted it
  (`Lead.consent`). Then the lead is held to `lead.validateCallback` (the
  phone rule, by default), not to the form's rule. Its phone is the form's
  field: the same hint, the same block. The consent goes into
  no event; a webhook body built by the brand should leave `lead.consent` out.
- **Locality.** A postcode field (`autoComplete="postal-code"`). A storefront
  with no named zone fills in its own postcode; a named zone fills in its one
  commune or offers its few as chips, by name — and then the field takes
  letters (`inputMode="text"`), since iOS's numeric keypad could not edit a
  name. Otherwise it is the numeric keypad.
- **Callback, closed.** Its summary is a block (`flex`, not the button's
  `inline-flex`) with `leading-6` after the brand's `channel` /
  `callbackSummary` classes unless they set a line height of their own, so a
  brand's type size cannot leave it on a half pixel.
- **Phone.** `type="tel"`, required, never masked, held to one rule on both
  sides (`phoneProblem`, `validateLead`): a French number is ten digits from
  `0[1-9]` (or `+33` and nine), any other a `+` and 8 to 15 digits; full-width
  digits read as digits; a run of one digit is no number. One that fails gets
  a hint when the field is left (`aria-live`, read out) and blocks the submit
  in the page's words — the browser's bubble would speak its own language. With
  `lead.mobileFormat: "e164"` a number it can read is stored as
  `+33612345678` (`normalizePhone`); the default keeps it as typed, which is
  what a brand's tests and tooling look rows up by.
- **Field messages.** Under each field, a live region (`aria-live`) always
  in the DOM, so a message appearing in it is read out. Empty, it is out of
  the field's flex flow (`empty:absolute`, never `hidden`): it takes no gap,
  so a brand's `classNames.field` may set any gap with no override for it.
- **Refusals are never silent.** Every required field blocks with the page's
  words and is marked `aria-invalid` once refused. What the server still
  refuses (a brand's own rule, a stale page) comes back to the card: the
  script's post gets a `422 { field }` and the form, as typed, shows the error
  at that field (`role="alert"`, focused); the plain post gets a 303 to
  `?lead_error=<field>&need=<need>#<id>` (`#<id>-callback` for a callback,
  opened), which the card reads once the script runs and then drops from the
  URL. Only slugs ride in that URL — never a phone or a name. A field the card
  does not draw (a brand's `extras`) shows its error above the submit and is
  marked itself.
- **Sending.** The script's post (asking `/quote` for JSON) carries a
  `submission_id` it mints once per lead — a new one as soon as anything
  posted changes, and never one the browser restored; the store keeps one row
  per id, so a resend after a lost answer is answered as the first was and
  never makes a second lead. While it runs the form's submit is disabled, `aria-busy` and
  says `sending`. No answer — no network, or none in 15 s
  (`SUBMIT_TIMEOUT_MS`) — is said in place with a retry that sends the same
  lead; the page is never left for the browser's error page.
- **Events** (through `AnalyticsBoundary`'s sink; none outside one):
  `lead_form_view` (half in view, once), `lead_form_start` (first focus),
  `lead_form_field_error {field, blocking}` (`blocking: true` the browser
  refused it, `false` the phone hint showed — the field's role, never its
  value), `lead_form_submit_error {reason, channel}` (`network` /
  `timeout`), `lead_form_step {step}`
  (`contact` / `need`), each with `form_id`, `layout`, `experiment`,
  `variant`; `contact_intent_click {channel}` for `phone`, `whatsapp`, `sms`,
  `callback`, with the experiment; and on the server `lead_form_submit
  {form_id, channel}` and `lead_form_reject {form_id, channel, field,
  reason}` with the posted experiment.
- **Weight.** 8.9 KB gz of first-load JS on the template's place page
  (157,287 → 166,361 B against its 158,000 B target: +5.3 %, a warning
  within the 20 % tolerance); the refusals and the shared phone rule are
  2.0 KB of it, sending (the id, the busy state, the retry) 0.6 KB.

### Form variants: quote, estimate, fixed

A need is sold one of three ways, chosen per need — one brand can mix them:

- `quote` — the price is uncertain; the lead asks for one. The form as it was.
- `estimate` — the price follows from a few enum answers (zone, bedrooms,
  surface band, frequency), shown live as the visitor taps; then the slot.
- `fixed` — one price for a well-defined job, shown as is; then the slot.

```ts
// shared/config/lead.ts — the form and the route read the same map
export const LEAD: LeadSchema<Subject> = { …, flows: { standard: "estimate", deep: "quote" } };
// shared/config/site.ts — the baked price list
export const site = defineSite({ …, lead: LEAD, pricing: PRICING });
// shared/config/env.ts — the live one, from the place source's base URL
export const pricing = createPricingSource(site, { baseUrl: () => serverEnv().locationsApiUrl });
// app/quote/route.ts
export const POST = quoteRoute(site, { env: serverEnv, notifier, pricing, unavailable });
// the page: <LeadCapture … flows={LEAD.flows} pricing={await pricing.model()} photos={["deep"]} />
```

- **The price list** (`PricingModel`) is JSON: `format` 1, `currency` `EUR`
  (TTC), `validFrom`, `roundToCents`, `minimumCents`, `inputs` (`add` in
  cents, `multiply` and `discount` in basis points, labels per locale) and
  `needs` (`{ kind: "estimate", baseCents, inputs }` or `{ kind: "fixed",
  cents }`). `priceOf(model, need, answers) → { cents, breakdown } | null`
  is integer cents throughout, rounding half up at every product, then to
  `roundToCents`, then the minimum. The rules and the shared fixtures the
  panel holds its own port to are in
  [`test/fixtures/pricing/`](./test/fixtures/pricing/README.md).
  `defineSite` refuses a baked model that does not validate or lacks a label
  in one of the site's locales.
- **The live list** (`createPricingSource`): `GET <base>/pricing`, TTL
  600 s, 3 s timeout; an unreachable source, a non-200, a body that is not
  JSON or a model that does not validate (for every locale of the site) all
  serve the baked model, logged — whole or not at all, never half a model.
  `{}` is "nothing set": the baked model, quietly.
- **A need runs its flow only when the list prices it so** (`flowOf`): an
  `estimate` the model cannot price — no model, a remote model without the
  need — is a `quote`. So a flow the brand has not switched on is never run
  by a posted field.
- **The form.** An estimate's questions are a tile per answer (touch-sized
  radios posted as `estimate_<input>`), required once the script runs; the
  price box (`aria-live`) shows the total and the lines that made it, or
  what is missing — never "from". A fixed need shows its price. Either
  submits as `bookSubmit` ("Réserver"). Without a script the answers still
  post and the server prices them; the live price needs the script.
- **The server prices the lead itself.** `/quote` reads the posted answers
  for the need's inputs only and runs the same `priceOf`; a posted amount is
  never read. The lead is stored with `flow`, `price.cents`,
  `price.validFrom` and an estimate's `price.inputs` (schema 7: `flow`,
  `quoted_cents`, `pricing_valid_from`, `estimate_inputs`). An estimate
  whose answers do not price (a stale page, a forged answer) is kept as a
  `quote` — never refused. A callback has no flow.
- **After a priced lead** the card stays: the script's answer carries the
  server's `cents` and the lead's reference (`lead`, `leadRef`:
  `lead-<row>-<8 hex>`), and the card confirms the price (`sentPrice`) and
  promises a call to set the slot (`slotCallback`) — or shows the brand's
  `booking`. The lead is stored first, so an abandoned booking is still a
  lead to call. A `quote` need, and any callback, behave as before.
- **Photos.** A `quote` need listed in `photos` offers "Envoyez des photos"
  — a WhatsApp link with the need in the message — when the place has
  WhatsApp; the callback stays where it is.
- **Words.** `LEAD_CAPTURE_TEXT` carries them (`priceTitle`, `pricePending`,
  `priceNote`, `priceBase`, `priceRounding`, `priceMinimum`, `bookSubmit`,
  `sentPrice`, `slotCallback`, `photos*`); optional in `LeadCaptureText`, so
  a brand's own text from before them falls back to the kit's in the page's
  language (`flowTextOf`).
- **Events.** `lead_estimate_shown {need, cents_bucket}` once per need and
  price band (`centsBucket`: `"7500-10000"`), never the price.
- **Weight.** About 3.9 KB gz of first-load JS on the template's place page
  (166,459 → 170,375 B against its 158,000 B target: +7.8 %, within the 20 %
  tolerance).

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

// app/quote/route.ts — `anchor`: the card's id, when it is not `quote`
export const dynamic = "force-dynamic";
export const POST = quoteRoute(site, { env: serverEnv, notifier, unavailable, anchor: "devis" });

// app/sitemap.ts — reads the Host header, so it is dynamic; pages are not
export const dynamic = "force-dynamic";
export default sitemapRoute(site, places);

// app/[locale]/[location]/layout.tsx — ISR: no page reads the request
export function generateStaticParams() { return []; }
export const revalidate = 600;
```

**The lead rule.** `site.lead.validate` defaults to `validateLead`: the
number the form itself blocks on. A brand's own rule composes with it and
names the field it refuses, which the form shows the error at:

```ts
validate: lead => validateLead(lead) ?? (lead.locality === "" ? { field: "locality", why: "a postcode" } : null),
```

A bare string still works — a refusal of the whole `form`. The landing
contract (`describeLandingContract`) holds the rule to the form's phone check
over `PHONE_MATRIX` (`leadRuleDisagreements`), so the server never refuses a
number the form let through.

**The thanks page.** A callback lands on `/thanks?channel=callback`; read it
with `thanksChannel(searchParams)` to promise a call instead of a quote, and
pass `{ thanks: true, channel }` to `statusTarget` so the language switch
keeps it.

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
  Schema 6 adds `submission_id` under a unique index (where present): one
  row per script submission, read back by `findSubmission`. Schema 7 adds
  the flow and the price a lead was taken at (`flow`, `quoted_cents`,
  `pricing_valid_from`, `estimate_inputs`), all nullable.
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
  `after`. A lead the notifier skips (honeypot, rate limit) is not queued —
  unless `panelSuspect` (below) queues the rate-limited one.
- **Suspect leads: `panelSuspect`, off.** `suspectOf(lead)` is
  `rate_limited`, `too_fast` or nothing — never `honeypot`, whose lead goes
  nowhere. With `leadWebhook(…, { panelSuspect: true })` a rate-limited lead
  is queued too (still never mailed) and `ctx.suspect` names why a lead is
  suspect, for the body's `suspect` property. Off by default, and to stay off
  until the panel's `lead.created` accepts the property: it refuses an
  unknown one, and the outbox would park the lead. Off, nothing changes.
- **The sale: `panelFlow`, off.** With `leadWebhook(…, { panelFlow: true })`
  `ctx.flow` says how the need was sold (`panelFlowOf(lead)`), and
  `panelFlowProperties(ctx.flow)` writes it as `lead.created`'s properties:
  `flow`; `quoted_cents` and `pricing_valid_from` together, for `estimate`
  and `fixed` only; `estimate_inputs` (input → answer, slugs, at most 12)
  for an `estimate` that asked anything. Off by default, and to stay off
  until the panel accepts them — it refuses unknown properties, and the
  outbox would park the lead. `ctx.leadRef` is the lead's reference the page
  was answered with, whatever the switch.
- **The rate limit** is `LEAD_RATE_LIMIT` (`<count>/<seconds>`): 5 per 10
  minutes per address in production, 100 outside it, where every request of
  a local stack shares one address. Outside production a lead held back as
  rate-limited or honeypot is logged loudly.
- **Signature.** Three headers named by `signing.headers`: the key id, the
  timestamp (unix seconds) and `hex(HMAC-SHA256(secret, prefix + timestamp +
  "." + body))`, signed afresh on each attempt. Prefix and names are required.
- **At-least-once.** 2xx is delivered. A `207` is delivered too, and an item
  it marks `rejected` is final — logged by index, not retried. 5xx, 408, 429
  and network errors retry, doubling from 5 s up to an hour (with jitter, and
  at least `Retry-After`), for 48 hours from queueing (`horizonMs`;
  `maxAttempts` is an optional cap). 401, 403 and 404 retry too, logged as
  errors naming the setting to check — a rotated key, a moved receiver. Any
  other status, 3xx included, is final. A final row stays as `dead` with its
  `last_error`, `onDead({ id, ref, attempts, error })` is told (an alert), and
  `requeueDead()` — or `kitstart-outbox requeue` on the leads file (the rows
  of `--target`, else `LEAD_WEBHOOK_URL`), with `kitstart-outbox status` to
  count rows — puts the dead rows back, due now, their horizon fresh.
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
