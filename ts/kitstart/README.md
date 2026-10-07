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
| `@evinvest/kitstart/next` | Next server (routes, RSC) | `quoteRoute`, `bookingRoute`, `confirmRoute`, `sitemapRoute`, `robotsRoute`, `ogRoute`, `healthRoute`, `createPlaceLoader`, `loadLocale`, `placeMetadata` / `brandMetadata` / `statusMetadata`, `metadataBase` |
| `@evinvest/kitstart/next/config` | `next.config.ts`, `vitest.config.ts` | `withLanding`, `buildEnv` and the `assets/` readers |
| `@evinvest/kitstart/react` | either side | `LangSwitch`, `CallBar`, `StatusScreen`, `PlaceDirectory`, `AreaChips`, `Coverage`, `MapFacade` (client), `QuoteFormShell`, `FormSelect` (client), `LeadCapture` (client), `LeadBooking` (client) and its adapters, `Faq`, `AnalyticsBoundary` (client), plus the kit and marketing pieces a landing composes with |
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
inputs.ev.url = "github:EV-invest/lib?ref=@evinvest/kitstart-v0.17.0"; # the version in package-lock.json
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
`AnalyticsBoundary`, `FormSelect`, `AbSwitcher`), styled with the kit's token roles only, restyled through
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
| `value` | controlled: shown and posted until the parent changes it from `onValueChange`; `""` is the placeholder, `undefined` uncontrolled |
| `placeholder` | an empty, unpickable choice shown until one is made |
| `required`, `disabled` | as on a `<select>`: required refuses the submit, disabled posts nothing |
| `size` | `sm` · `md` · `lg` (the landing's) — the kit's form scale |
| `id`, `aria-describedby`, `aria-invalid` | inside a `Field` the id comes from it: its `FieldLabel` names the `<select>` before hydration and the trigger after |
| `className` · `classNames={{ trigger, content, item }}` | the shared box · the control in both states, the list, its rows |
| `onValueChange` | the chosen value, after hydration |

- **The value survives the swap.** A choice made in the native select before
  the script arrived is read in the hydration commit; a form `reset` puts the
  default back in both states (uncontrolled; under `value`, see below). With nothing chosen (under a `placeholder`) it
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
- **Controlled, as an `<input>`.** Under `value` the prop is the value: a
  pick only calls `onValueChange`, and the parent's state (or a reset of its
  own, `setSubject("")` back to the placeholder) is what moves it. A form
  `reset` leaves it on `value` — clear the parent's state from the form's
  `onReset` if it should follow. Without JavaScript it is still the native
  select, starting on `value`; a pick made there before hydration is reported
  through `onValueChange`. Switching between `value` and `undefined` warns
  once in development, as React does for an input, and keeps the last value.

```tsx
const [subject, setSubject] = useState<string>(LEAD.subjects[0]);
<FormSelect name={LEAD.wire.subject} size="lg" value={subject} onValueChange={setSubject} options={subjects} />
```

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
  layout={arm === "b" ? "steps" : "single"}
  experiment={{ name: "lead_form", variant: arm }}
/>
```

| Prop | |
|---|---|
| `place`, `contact` | the hours order the channels, the service area suggests the commune; `contact` is `contactOf(site, place)` — a `null` number is a channel not offered |
| `locale`, `renderedAt` | the page's language; the render stamp (time trap, and "now" until the script runs) |
| `wire`, `needs` | `site.lead.wire`; the subjects with their labels, an `icon` each (any node, the brand's — the kit ships none) for `needDisplay="cards"`, and an optional `shortLabel` drawn on tiles under `sm` |
| `need` | the need the page already knows — also set by `?need=` and by a tap on any `[data-need="…"]` element. `?postcode=` fills the postcode the same way |
| `layout` | `single` (default) · `steps`: one question per screen — see [One question per screen](#one-question-per-screen-layoutsteps) · `qualify-first`: a tile per need, then the contact step (the two screens `steps` grew from, kept as they were) |
| `needDisplay` | how the need is asked: `select` (default on `single`) · `tiles` (default otherwise) · `cards`, a grid with each need's `icon` |
| `intro`, `localityStep` | `steps` only: a question before the need, posted as a brand's extra, whose answer may turn the form into a callback · the postcode on its own screen (`own`, default) or on the phone's (`with-phone`) |
| `focusNext` | on one screen: after a choice the focus moves to the next empty field, and Enter in a field moves to the next empty one before it submits. Off by default; always so in `steps` |
| `questions` | by estimate input id: `{ display?: "tiles" \| "cards", unknown?: true, unknownSpan?: 2, badges?: { [option]: text }, shortLabels?: { [option]: text }, step?: number, next?: string }` — see [The compact form](#the-compact-form) and [steps](#one-question-per-screen-layoutsteps) |
| `price`, `taxCredit` | `box` (default) · `compact`: the price on one line, what is left after a tax credit of `taxCredit` (a ratio, `0.5`), the breakdown behind "Détail" |
| `afterPhone` | a node right under the phone field: one line of reassurance |
| `channelsDisplay`, `channelIcons` | the other ways out: `stack` (default, under `otherChannels`) · `row`, one row of compact buttons named by `otherChannels` · the brand's icon per channel (`phone`, `whatsapp`, `sms`, `callback`, `telegram`) |
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
| `booking` | after a priced lead, in place of the place's booking (`LeadBooking`, from `place.booking`): a node or `(sent) => node` |
| `bookingVariant` · `bookingEmbed` · `bookingAdapters` | the `booking_provider` variant that picks the place's provider · the providers' embeds (after cookie consent) rather than a new tab · the brand's adapters over the built-ins (from a client component) — see [Booking](#booking-manual-link-google_calendar-cal_com) |
| `initialError` | `leadErrorOf(searchParams)` on a page that reads its query: the refusal a 303 brought back, drawn on the server by the card it names (`lead_card`) so the card says why without a script (see *Refusals*) |
| `head`, `trust` | the brand's heading instead of the title; a slot beside the submit. Like `extras`, `done` and `booking`, any node, built on the server or not, and never asked for a `key`: each slot sits alone in a keyed fragment |
| `className` · `classNames` | the root · its parts: `root`, `head`, `title`, `lede`, `form`, `contact`, `field`, `label`, `control` (every input, the need's select in both states, the callback's phone), `hint`, `error` (a refusal: under the field, or above the submit), `chips`, `chip`, `needs`, `need`, `summary`, `icon` (a need's or an intro answer's icon), `submit`, `trust`, `privacy` (not drawn when `text.privacy` is `""`), `opening`, `others`, `channel`, `channelIcon`, `primary`, `callback`, `callbackSummary`, `callbackForm`, `callbackLede`, `callbackSubmit`, `consent`, `done`, for `steps` `progress`, `stepBack`, `step` (each screen), `answers`, `answer` (the chips of the screens answered), `stepNext`, `intro`, `introOption`, and for the flows `estimate`, `estimateInput`, `estimateLegend`, `estimateGrid` (an input's answers: 2 columns, 3 from `sm`), `estimateOption` (an answer's tile), `estimateUnknown` (the "I don't know" tile, after `estimateOption`), `badge`, `optionPrice` (a card's total), `price`, `priceTotal`, `breakdown`, `priceNote`, `priceLine`, `priceTaxCredit`, `priceDetail` (`price="compact"`), `photos`, `priced`, `pricedPrice`, `pricedNote`, and for the booking `booking`, `bookingCta`, `bookingNote`, `prefer`, `preferOption`, `preferSubmit`, and for a `messenger` variant `messenger`, `messengerSlot`, `messengerPreview`, `messengerPicker`, `messengerOption`, `messengerSquare`, `messengerQr`, `messengerReturn`, `messengerHint` |
| `messenger`, `messengers`, `refPrefix`, `brand` | the `lead_channel` arm (`MessengerVariant`, absent → the control) · `messengerFacts(site, place)` · the chat reference's prefix (`AQ`) · the message's greeting — see *Messengers* below |

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
  `0[1-9]` (or `+33` and nine), any other a `+` and 8 to 15 digits — and for
  the plans visitors most often dial from, that plan's national length after
  the code: `+1` ten, `+44` nine or ten, `+34` and `+41` nine, `+32` eight or
  nine, `+49` 7 to 13, `+39` 6 to 11 (so `+12345678` is no number); full-width
  digits read as digits; a run of one digit is no number. One that fails gets
  a hint when the field is left (`aria-live`, read out; when a tap left it,
  only once the tap is over, so nothing moves under the finger) and blocks the submit
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
  `?lead_error=<field>&need=<need>&lead_card=<id>#<id>` (`#<id>-callback` for a callback,
  opened), which the card reads once the script runs and then drops from the
  URL. Only slugs ride in that URL — never a phone or a name. Without a
  script that text is the page's to draw: a page that reads its query passes
  `initialError={leadErrorOf(await searchParams)}` and the server renders it
  in the card the 303 named (`lead_card=<id>` or `<id>-callback`, beside the
  fragment the server never sees): only that card draws it, at its form or
  its callback (opened). A URL from before `lead_card` is drawn by every card
  as it reads — the consent at the callback, anything else at the form. A page built for ISR
  reads no query, so without a script it lands on the card with the field
  marked by nothing — the limit of a cached page. A field the card
  does not draw (a brand's `extras`) shows its error above the submit and is
  marked itself.
- **Sending.** The script's post (asking `/quote` for JSON) carries a
  `submission_id` it mints once per lead — a new one as soon as anything
  posted changes, and never one the browser restored; the store keeps one row
  per id, so a resend after a lost answer is answered as the first was and
  never makes a second lead. While it runs the form's submit is disabled, `aria-busy` and
  says `sending`. No answer — no network, or none in 15 s
  (`SUBMIT_TIMEOUT_MS`) — is said in place with a retry that sends the same
  lead; the page is never left for the browser's error page. While a post
  runs or waits for its retry, the channels keep their order: the hours
  turning (the place closing) would move the callback, and a moved form is a
  new one — what was typed gone, the retry sent nowhere.
- **Events** (through `AnalyticsBoundary`'s sink; none outside one):
  `lead_form_view` (half in view, once), `lead_form_start` (first focus),
  `lead_form_field_error {field, blocking}` (`blocking: true` the browser
  refused it, `false` the phone hint showed — the field's role, never its
  value), `lead_form_submit_error {reason, channel}` (`network` /
  `timeout`), `lead_form_step {step}`
  (`contact` / `need` in `qualify-first`; in `steps` each screen moved to —
  `intro`, `need`, `estimate_<input>`, `locality`, `phone`), each with `form_id`, `layout`, `experiment`,
  `variant`; `contact_intent_click {channel}` for `phone`, `whatsapp`, `sms`,
  `callback`, with the experiment; and on the server `lead_form_submit
  {form_id, channel}` and `lead_form_reject {form_id, channel, field,
  reason}` with the posted experiment. On a test visit every one of them —
  page view, intents, funnel, booking, and the server's two when
  `quoteRoute` has `qaCookie` — carries `forced: true` (see `AbSwitcher`).
- **Weight.** 8.9 KB gz of first-load JS on the template's place page
  (157,287 → 166,361 B against its 158,000 B target: +5.3 %, a warning
  within the 20 % tolerance); the refusals and the shared phone rule are
  2.0 KB of it, sending (the id, the busy state, the retry) 0.6 KB.

### Messengers: `messenger`, WhatsApp and the bot

The `lead_channel` experiment's arms. WhatsApp: the customer sends the brand's
prefilled message, answered by hand in WhatsApp Business. Telegram: the
brand's bot, opened as `t.me/<bot>?start=<ref>`. The phone is asked only for
a call; no text messages. Either way the lead is **posted first**, in the
background, so the panel has it before the chat starts.

```tsx
import { messengerFacts } from "@evinvest/kitstart";

<LeadCapture
  {...controlProps}
  messenger={arm === "c" ? { kind: "segment" } : undefined} // undefined → the control
  messengers={messengerFacts(site, place)} // the place's own WhatsApp, its bot — each `null` when off
                                            // (a bot's name: `TELEGRAM_BOT`, 5–32 chars ending in `bot`)
  refPrefix="AQ"                            // the lead's chat reference: AQ-7K3F
  brand="Aquafix"                           // the message's greeting
  channelIcons={{ whatsapp: <WhatsAppIcon />, telegram: <TelegramIcon />, callback: <PhoneIcon /> }}
  classNames={{ messengerSlot: "h-[92px]" }} // every state of a variant one height
/>
```

| `kind` | Figma | the card |
|---|---|---|
| `select` `{side: "prefix" \| "suffix"}` | AQ-1 / VF-1 | the channel picked in the phone field (the kit's `Select`, an overlay): WhatsApp — the number optional, the button opens the chat; Appel — the control; Telegram — no number, the button opens the bot |
| `segment` | AQ-2 | «WhatsApp \| Appel» over the slot (the message ready / the phone); «ou via Telegram» under the button |
| `tiles` | VF-2 | «Recevoir mon devis par» and a tile per channel over the slot (the message / what the bot does / the phone) |
| `thanks` | AQ-3 | the control's form; the in-card success adds a photo on WhatsApp (a QR code on a computer) and the bot. The card stays (`done`) |
| `swap` | AQ-4 / VF-3 | no phone: the WhatsApp button, then [Telegram][Être rappelé]; «Être rappelé» swaps in the phone and [WhatsApp square][submit] |
| `saga` | AQ-5 | the channel first, on a screen of its own (cards), then the job and the channel's slot; «Changer de canal» back |
| `urgency` `{field}` | AQ-6 | «C’est urgent ?» — posted as the brand's extra `field` (`today` / `later`; list it in `site.lead.extras`) — today a call, «je compare» the message |
| `sheet` | VF-4 | the estimate, the postcode and one button; the kit's `Drawer`: WhatsApp / Telegram / a call, the phone asked in the drawer |
| `chip` | VF-5 | the lede becomes a chip «Réponse sur WhatsApp ▾» (a `Select` overlay); the slot follows it |
| `split` | VF-6 | the slot over one row: «Devis sur WhatsApp» with [Telegram][📞] squares; 📞 turns it into «Être rappelé» with [WhatsApp][Telegram] |

- **Fallback** (Figma «Выключено в панели»). No WhatsApp for the place — no
  number of its own, or `messengers.whatsapp: false` from the panel — and
  every kind is the control, with «ou via Telegram» under the submit when the
  bot is on; `urgency` keeps its question (both answers ask the phone) and
  `thanks` keeps the bot. No bot — every Telegram piece is left out. The arm
  stays assigned; every event says what the card had: `channels_available`
  (`wa,tg` | `wa` | `tg` | `none`).
- **The reference** `message_ref`: `<refPrefix>-<4 Crockford base32>`,
  minted in the browser once the script runs and again after a messenger
  lead is posted; the WhatsApp message ends with `Réf. AQ-7K3F`, the bot's
  `start` is the reference itself. Posted with every lead of the card (a
  `thanks` success sends the form lead's own), stored (`message_ref`, schema
  8), mailed (`Réf.`), and sent to the panel under `panelMessenger`.
- **The message** (`messengerMessage`, ≤ 400 characters, nothing typed about
  the person): `Bonjour {brand} 👋`, the need, the postcode, the estimate
  shown, the timing (`urgency`), `Réf. {ref}` — a line without its value left
  out. The slot shows it as a preview, so the visitor sees there is nothing
  to write.
- **The tap.** A real `<a href>` — the OS opens the app from the tap. A
  number typed must be one (the browser says so, nothing leaves). The lead is
  posted (`keepalive`, `channel=whatsapp|telegram`, the reference, what was
  filled; the same submission id for a second tap). On a computer (`hover:
  hover`, `pointer: fine`, ≥ 768 px) WhatsApp becomes a QR code in the slot
  (`qrcode-generator`, loaded on that tap only) with «ou ouvrir WhatsApp Web»
  and «Être rappelé»; the bot opens in a new tab. In an app's own browser
  (Instagram, Facebook, TikTok, Line, Snapchat) a hint says how to leave it,
  with «Copier le message».
- **Back on the page** (`visibilitychange`), the card asks «Message
  envoyé ?» over the form: reopen the chat, «Je n’ai pas pu envoyer → être
  rappelé» (the variant's call state, the phone focused), or «C’est envoyé».
- **The server.** A `whatsapp` / `telegram` lead needs no phone (one typed
  is held to the rule) and no consent, and is never sent back for a changed
  price; `validateLead` knows the channel. A brand's own rule must not
  refuse one for the postcode or the phone it was not asked — the testing
  subpath's `messengerRuleDisagreements(site.lead)` lists where it does.
- **Words**: `LeadCaptureMessengerText` — optional keys of the card's
  `text`, a key left out the kit's in the page's language (`messengerTextOf`;
  the defaults are `LEAD_CAPTURE_MESSENGER_TEXT`, kept out of
  `LEAD_CAPTURE_TEXT` so the control's island never carries them). A brand
  overrides by spreading: `{ ...LEAD_CAPTURE_TEXT.fr, messengerWhatsappCta: "Envoyer sur WhatsApp →" }`. **Parts**:
  `messenger`, `messengerSlot`, `messengerPreview`, `messengerPicker`,
  `messengerOption`, `messengerSquare`, `messengerQr`, `messengerReturn`,
  `messengerHint`.
- **Events**: every `LeadCapture` event carries `channels_available` and,
  with a variant, `messenger_variant`; `lead_messenger_open {channel, device,
  inapp, message_ref}`, `lead_messenger_return {channel, answer: sent |
  failed, message_ref}`, `contact_intent_click {channel: telegram |
  whatsapp_qr}`; `lead_form_submit` has `message_ref` and the posted
  `channels_available`.
- **Weight.** Each kind is its own chunk (`React.lazy`), fetched only by the
  arm that draws it; the control pays for the dispatch alone, and the QR
  encoder for nobody until a desktop tap.

### One question per screen: `layout="steps"`

```tsx
<LeadCapture … layout="steps" needDisplay="cards" price="compact" taxCredit={0.5}
  questions={{ surface: { unknown: true }, frequency: { display: "cards", badges: { biweekly: "Le plus avantageux" } } }}
  intro={{ label: "C’est pour quand ?", field: "urgency", options: [
    { value: "today", label: "Urgent — aujourd’hui", channel: "callback" },
    { value: "week", label: "Cette semaine" },
  ] }}
  afterPhone={<p>Votre numéro reste entre nous — rappel sous 15 min.</p>} channelsDisplay="row" />
```

- **Screens.** The intro question when there is one; the need; each of the
  estimate's questions; the postcode (`localityStep="own"`, the default, or
  with the phone, `with-phone`); the phone, always last, with the price, the
  name and the brand's extras and the submit. A tap answers and moves on
  (from the keyboard the tiles are a radio group: arrows choose, Enter or
  Space answers); the postcode moves on with "Continuer" or Enter. The
  focus goes to the new screen's field — inside the tap when that is a typed
  field, so iOS opens the keyboard.
- **Over the screens** a thin bar (`progress`; the screen is read out as
  `stepProgress`, "Étape 2/4", never drawn), "Retour" (`stepBack`), and the
  screens answered as chips (`answers`, `answer`), each a tap back to its
  screen with "Modifier" (`needChange`). The total counts the most screens
  an answer to come could add (the longest estimate while the need is
  open), so the bar only moves forward as the visitor answers; until the
  intro is answered — its branches differ in length — no total is said
  (`stepProgressOpen`, "Étape 1").
- **Questions sharing a screen** (`questions: { bedrooms: { step: 1, next:
  "Voir les prix" }, surface: { step: 1 } }`): questions with the same `step`
  number are one screen. It moves on by itself once all are answered; until
  then the focus goes to the next question, and the button (`next` of the
  first, else `stepNext`) says which one is missing.
- **Never asked twice.** A need the page knows (`need`, `?need=`, a
  `[data-need]` card) and a postcode it knows (`?postcode=`, a place serving
  one commune) are answered screens: a chip, not a question.
- **The intro** (`intro: { label, field, options }`) is posted under `field`
  — declare it in `site.lead.extras` (`{ name: "urgency", max: 16 }`) and it
  is stored and mailed with the lead like any extra. An answer with
  `channel: "callback"` cuts the form to the phone and the callback's
  consent, posted as a callback lead (`channel=callback`, `callbackSubmit`);
  the folded callback is then not offered a second time.
- **A refusal** opens the screen of the field it is about (the phone's for
  anything the form cannot place).
- **Without a script** every screen is in the form, hidden but posted; a
  `<noscript>` style shows them all at once and hides the bar, the back link,
  the chips and "Continuer": the form posts as one, as `qualify-first` does.
  The server draws the same screen the script starts on — no shift at
  hydration.

### The compact form

Pieces any layout takes, for a card that fits a phone's screen:

- **The price on one line** (`price="compact"`): `priceLine` ("Votre prix :
  {price}" — a brand may write "≈ {price}"), then, with `taxCredit` (a ratio
  of the price a tax credit gives back, `0.5` for the French *crédit
  d'impôt*), what is left to pay (`priceTaxCredit`, `data-credit-cents`),
  and the breakdown and `priceNote` behind a `<details>` ("Détail",
  `priceDetail`). Read out as it changes, the line only.
- **A question as cards** (`questions: { frequency: { display: "cards" } }`):
  one answer a line, each with the total it would make given the other
  answers (once they are given), and an optional `badges` tag per option.
- **Short labels on a phone** (`needs[].shortLabel`, `questions[id].shortLabels`):
  under `sm` the tile draws the short one; the radio stays named by the
  whole label (`aria-label`, with the badge and the price).
- **Badges are the brand's words** (`badges`): the kit marks nothing as
  popular or cheapest by itself.
- **"Je ne sais pas"** (`questions: { surface: { unknown: true, unknownSpan: 2 } }`) adds the
  answer `estimateUnknown` to that question, posted as `ESTIMATE_UNKNOWN`
  (`?` — never a slug, so never an option a model prices). The questions
  after it are not asked, the price goes, and the lead is a `quote`: the
  submit says `submit`, a quote need's photos ask shows, and the server
  stores it as a quote too (`answeredUnknown`), without the warning a stale
  answer logs.
- **Need cards** (`needDisplay="cards"`): a grid of cards with each need's
  `icon`; `tiles` a list without. Required either way: nothing is chosen
  for the visitor, unlike the select's first need.
- **One line under the phone** (`afterPhone`) — and `text.privacy: ""` drops
  the kit's privacy line, so the reassurance is said once.
- **The other channels in a row** (`channelsDisplay="row"`): one row of
  compact buttons (call, WhatsApp, text, "Rappelez-moi" — its form on a line
  of its own once open), named by `otherChannels` as a group, each with the
  brand's `channelIcons`; a channel the place lacks is not drawn. Hiding the
  row where a sticky call bar already offers the same (`classNames.others`)
  is the brand's.
- **`focusNext`** on one screen: after the need's select, a tile, or an
  estimate's answer, the focus moves to the next empty field; Enter in a
  typed field moves to the next empty one, and submits from the last.
- **Words.** `estimateUnknown`, `priceLine`, `priceTaxCredit`, `priceDetail`,
  `stepProgress`, `stepProgressOpen`, `stepBack`, `stepNext` are in `LEAD_CAPTURE_TEXT` and
  optional in `LeadCaptureText`, falling back to the kit's in the page's
  language (`flowTextOf`) — a brand's text from 0.13 still type-checks.
- **Weight.** The steps, the tiles, the compact price and the focus ride
  with `LeadCapture` whichever layout a page uses: about 9 KB gz of
  first-load JS on the template's place page (170,375 → 179,430 B against
  its 158,000 B target: +13.6 %, a warning within the 20 % tolerance).

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
  radios posted as `estimate_<input>`), required once the script runs —
  two columns, three from `sm`; a brand sets its own count with
  `classNames={{ estimateGrid: "grid-cols-3 sm:grid-cols-4" }}` (a denser
  grid, a shorter card), and a tile keeps its 44 px touch height in any
  (`estimateOption` styles the tile itself); the
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
- **The price shown is the price recorded.** The form also posts the price
  it showed, `shown_cents` (`SHOWN_CENTS_FIELD`) — compared, never stored.
  When the server's price differs (the panel changed the list under an open
  page), the lead is not taken: a script gets `422 { ok: false, field:
  "price_changed", reason: "price_changed", cents }`, and the card shows the
  fresh price in place of the old one with `priceChanged` ("Le prix a
  changé : 86 € au lieu de 77 €"); the next submit posts it and is taken. A
  plain post goes to `/quote/confirm` (`confirmRoute`) — never back to its
  card, whose page may be a cached render still showing the old price, so
  every resubmit would be refused again. The confirmation is never cached:
  it prices the answers afresh, says the price changed, and asks again for
  the phone and the postcode — the URL carries only the need, the answers,
  the page's ids and the price seen, nothing typed (a brand's extra fields
  are not carried). Its form posts the fresh `shown_cents` and is taken. A
  page cached before the field posts none and is taken as before; so does an
  estimate posted without a script, whose page could not show a price. Counted as `lead_form_reject
  {reason: "price_changed"}`.
- **After a priced lead** the card stays: the script's answer carries the
  server's `cents` and the lead's reference (`lead`, `leadRef`:
  `lead-<row>-<8 hex>`), and the card confirms the price (`sentPrice`) and
  offers the place's booking (below) — or shows the brand's own `booking`.
  The lead is stored first, so an abandoned booking is still a lead to
  call. A `quote` need, and any callback, behave as before.
- **Photos.** A `quote` need listed in `photos` offers "Envoyez des photos"
  — a WhatsApp link with the need in the message — when the place has
  WhatsApp; the callback stays where it is.
- **Words.** `LEAD_CAPTURE_TEXT` carries them (`priceTitle`, `pricePending`,
  `priceNote`, `priceBase`, `priceRounding`, `priceMinimum`, `bookSubmit`,
  `sentPrice`, `priceChanged*`, `slotCallback`, `book*` (`bookPhoneHint` too), `booked`,
  `prefer*`, `part*`, `photos*`); optional in `LeadCaptureText`, so
  a brand's own text from before them falls back to the kit's in the page's
  language (`flowTextOf`).
- **Events.** `lead_estimate_shown {need, cents_bucket}` once per need and
  price band (`centsBucket`: `"7500-10000"`), never the price;
  `lead_booking_open {provider}` and `lead_booking_done {provider}` (below).
- **Weight.** About 3.9 KB gz of first-load JS on the template's place page
  (166,459 → 170,375 B against its 158,000 B target: +7.8 %, within the 20 %
  tolerance).

### Booking: `manual`, `link`, `google_calendar`, `cal_com`

How a priced lead's slot is set, per place, provider-agnostic. The default is
`manual` — a call. A place may also have pages on `link`, `google_calendar`
and `cal_com`, and the `booking_provider` experiment picks among them; the
first A/B is `google_calendar` against `manual`. `calendly` is the next
adapter, on the same seams.

```ts
// shared/config/places.ts — baked, optional; the panel's place settings override it (`PlaceLive.booking`)
{ slug: "paris", …, booking: { default: "manual", providers: { google_calendar: { url: "https://calendar.app.google/…" } } } }
// shared/config/site.ts — the Cal.com hosts a place may book on (default ["cal.evinvest.ltd", "cal.com"])
export const site = defineSite({ …, booking: { calComHosts: ["cal.com", "cal.brand.fr"] } });
// the page: the experiment's variant picks the provider among the place's
<LeadCapture … bookingVariant={assignment(BOOKING_EXPERIMENT)} />
// app/quote/booking/route.ts
export const dynamic = "force-dynamic";
export const POST = bookingRoute({ env: serverEnv, webhook });
```

- **The config** (`BookingConfig`): `{ default, providers: { <provider>: { url } } }`.
  `manual` has no page and is always available: the card promises a call and
  offers an optional preference — a day of the coming week and a part of the
  day (`morning | afternoon | evening`), no free text. `link` — any booking
  page, opened with `ref=<leadRef>`. `google_calendar` — a schedule on
  `calendar.app.google` or `calendar.google.com/calendar/appointments/…`,
  opened as is: it takes no parameter, so the card asks the visitor to type
  the same phone there (`bookPhoneHint`) and the panel matches by contact and
  time. `cal_com` — `https://<allowed host>/<user>/<event>`, opened with
  `name`, `attendeePhoneNumber` (E.164) and `metadata[ref]=<leadRef>`.
  `default` is `manual` or one of `providers`; a place with no booking is
  `manual` (`DEFAULT_BOOKING`). A ref always rides in the query, never the
  fragment. `bookingConfigProblems` holds the strict URL rules; the panel
  mirrors them from [`test/fixtures/booking/`](./test/fixtures/booking/README.md).
  `defineSite` refuses a baked booking or host list that does not validate;
  a live one that does not is dropped and the baked one kept.
- **The choice: one entry point.** `bookingOf(place, variant)` answers the
  provider the `booking_provider` variant (`BOOKING_EXPERIMENT`, the same key
  on every brand) names, when the place has it (`manual` always), else the
  place's `default`. `LeadCapture` calls it with `bookingVariant`. The chosen
  provider is what `booking.requested@1` and `lead_booking_open` /
  `lead_booking_done {provider}` carry, so the arms compare.
- **Nothing third-party before the click.** Every provider with a page is a
  plain link the browser opens in a new tab. `bookingEmbed` on `LeadCapture`
  (`BOOKING_EMBEDS`: Cal.com's modal, `calComEmbedAdapter`) opens it on the
  page instead — only once the visitor accepted the provider's cookies: its
  script loads on the click, and its `bookingSuccessful` is `onBooked` (once
  per lead, however often the modal opens), the one way the page learns a
  slot was taken (`lead_booking_done`). In an A/B
  test both arms must open the same way, or it measures the opening.
- **Adapters** (`BookingAdapter = { provider, href?, open?, prefillsPhone? }`),
  picked by the chosen provider: `manualAdapter`, `linkAdapter`,
  `googleCalendarAdapter`, `calComAdapter`; `bookingAdapters` on
  `LeadCapture` registers a brand's own by provider name (from a client
  component — a server one cannot pass functions). A provider no adapter
  knows promises the call.
- **`booking.requested@1`.** Opening a provider's page, or sending a
  `manual` preference, posts `{ submission, lead_ref, provider,
  preferred_date?, preferred_part? }` to `/quote/booking` (`bookingRoute`).
  The submission id proves the lead is this page's (a `lead_ref` alone books
  nothing); only a priced lead (`estimate`, `fixed`) books; one request per
  lead. It is queued on the lead webhook's outbox behind `panelBooking` (off)
  — see the lead webhook.
- **`ctx.leadRef` is the panel's lead id.** A booking comes back to the panel
  carrying `leadRef` (`metadata[ref]`, `ref`, `lead_ref`), so a brand's
  `lead.created` must send `ctx.leadRef` as its lead id — not an id of its own.
- **Weight.** The booking and the price confirmation add about 3.1 KB gz of
  first-load JS to the template's place page (170,853 → 173,979 B against
  its 158,000 B target: +10.1 %, within the 20 % tolerance).

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

// app/quote/confirm/route.ts — a plain post whose price changed confirms here, uncached
export const dynamic = "force-dynamic";
export const GET = confirmRoute(site, { pricing, text: locale => TEXT[locale].leadCapture });

// app/quote/booking/route.ts — a priced lead's booking request (`booking.requested@1`)
export const dynamic = "force-dynamic";
export const POST = bookingRoute({ env: serverEnv, webhook });

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
- **The mail names the need.** `lead.subject` is the id the form posted
  (`hot_water`); `leadNotifier(site, env, { needLabel })` names it instead —
  `needLabel(need)` answers the label in the mail's language (the business's,
  not the visitor's), `undefined` for a need it does not know, which the mail
  prints as the id. The default mail uses it, `defaultLeadMail(brand, lead, id,
  { needLabel })` too, and a brand's `format` gets it as its third argument:
  `(lead, id, { need }) => LeadMail`.
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
- **The channel.** `channelOf(lead)` is `form`, `callback`, `whatsapp` or
  `telegram`. For the Service-Arb panel use `ctx.channel` (or
  `panelChannel(channel, panelMessenger)`): its `properties.channel` is a
  closed set that refuses the whole event outside it; a callback goes as
  `callback` (panel v0.3.0 on), a messenger lead as `form` until
  `panelMessenger` is on.
- **Messenger leads: `panelMessenger`, off.** On: `ctx.channel` says
  `whatsapp` / `telegram`, and `ctx.messageRef` carries the lead's chat
  reference for `properties.message_ref`. Off (the default, until the panel
  takes them): a messenger lead goes as a `form`, without its reference —
  the leads table and the mail keep both either way.
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
  outbox would park the lead.
- **`ctx.leadRef` — send it as the panel's lead id.** The lead's reference
  the page was answered with (`lead-<row>-<8 hex>`), whatever the switch.
  Every booking joins its lead by it (Cal.com's `metadata[ref]`, a link's
  `ref`, `booking.requested`'s `lead_ref`): **a brand must send this as the
  panel lead id** in `lead.created`, not an id it computes itself.
- **`ctx.analyticsId` — the visit, for PostHog.** The `distinct_id` of the
  page's beacons (`AnalyticsBoundary` holds one per page, in memory), posted
  by `LeadCapture`'s script as `analytics_id` and checked against
  `[A-Za-z0-9._:-]{1,128}`. Write it as `lead.created`'s `analytics_id`
  property so the panel's PostHog events of the lead join the visit — once
  the panel accepts the property. Absent for a plain post, a page with no
  analytics key, or an older page; never stored with the lead.
- **Booking requests: `panelBooking`, off.** With `leadWebhook(…, {
  panelBooking: true, buildBookingBody })`, `bookingRoute` queues
  `booking.requested@1` through the same outbox, after the lead's
  `lead.created`, once per lead (`requestBooking`; the row's ref is
  `booking:<leadRef>`), held until the lead's own row (`lead:<row>`) is
  delivered — a `409` or `425` for it is retried, the panel not having the
  lead yet — and never queued for a lead whose `lead.created` was not
  (a suspect held back). `buildBookingBody(request, ctx)` builds the event —
  `bookingRequestedProperties(request)` writes `{ lead_ref, provider,
  preferred_date?, preferred_part? }`, `ctx` has `brandId`, `at`,
  `idempotencyKey`. Off by default, and to stay off until the panel accepts
  the event type: off, a request is answered and dropped.
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

## Experiments from the panel

The experiments live in code (`@evinvest/experiments`, one `as const` config
of variants, split equally); the panel decides any other weights and the kill
switch, and PostHog counts them.

**Overrides** (`createExperimentsSource`): `GET <base>/experiments`, the same
base as the place source, `{ "experiments": { "<key>": { enabled?, weights?,
holdout? } } }`. The proxy reads it on every request, so it answers from memory:
the first call waits for the panel (1.5 s timeout), later ones are served from
the cache, and past the 30 s TTL the stale answer is served while one refresh
runs behind it. An unreachable panel, a non-200 or a body of another shape is
logged and keeps the last good answer — a kill switch must not come back on
because the panel blinked — or `{}`, the config in code, when there was none
yet; either way the panel is not asked again before the TTL.

```ts
// shared/config/env.ts
export const experimentOverrides = createExperimentsSource({ baseUrl: () => serverEnv().locationsApiUrl });
// proxy.ts — the same applied config wherever a variant is read
const live = applyOverrides(experiments, await experimentOverrides.overrides());
```

Only types are checked here; whether a field fits the code (weights of the
declared length, holdout in `[0, 1)`) is `applyOverrides`' call.

**Declaration** (`declareExperiments`): at every start the landing tells the
panel which experiments this build runs — `experiments.declared@1`, one event
with every experiment's key, variants, weights (always one each — the code's
equal split), `enabled`, `holdout` and an
optional one-line `summary`, under a fresh UUIDv7. It goes through the lead
webhook's outbox, signed and retried like a lead (so it needs the same
`LEAD_WEBHOOK_URL` and sqlite lead store), and the panel keeps the latest by
`occurredAt`; an experiment missing from it is retired there.

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  declareExperiments(webhook, experiments, { summaries: { lead_layout: "Two steps beat one long form" } });
}
```

It never throws and never holds the start: no webhook, one that cannot be
built, or a queue that refuses the row is logged and skipped — the panel keeps
the last declaration. An experiment the panel would refuse (key not
`[a-z0-9_]{1,64}`, fewer than two unique slug variants, holdout outside
`[0, 1)`, summary over
200 characters) is left out and logged, since the panel judges the event whole.

### The QA switcher: `AbSwitcher`

A chip in a corner that switches an experiment's variant in one tap — for the
owner on a phone, in production. It drives the brand proxy's own mechanism and
adds no server path: a tap on a variant goes to the same URL with
`?ab_<key>=<value>`, which forces it and sets the QA cookie.

```tsx
// app/[locale]/[location]/layout.tsx — a server layout; the props are plain data
<AbSwitcher
  experiments={[{ key: "lead_form", label: "Lead form", variants: [{ value: "a", label: "Compact" }, { value: "b", label: "Steps" }] }]}
  qaCookie="ab__qa"              // the cookie the brand's force parameter sets
  className="bottom-20 md:bottom-4" // over the brand's sticky bars; bottom-right by default
/>
```

- `current` — the assignments, if the caller knows them; left out, the panel
  reads `ab_<key>` from `document.cookie` (the normal case: the page stays
  static, the server reads no cookie). `forceParam` — `ab_` by default.
  `text` — the menu's words, English by default.
- **An experiment with no assignment is off.** The proxy assigns every
  running experiment on the page the menu mounts on, so one with no
  `ab_<key>` cookie (or missing from `current`) is shown `not running`
  (`text.unassigned`), its variants disabled — the proxy would refuse the
  force — and `–` on the chip. A test the panel only **paused** keeps its
  visitors' cookies (dropping them would redraw everyone on resume), so the
  brand's proxy lists paused tests for a QA browser only in the cookie
  `<qaCookie>_off` (`ab__qa_off=lead_form,hero`); those read `not running`
  too (`abRunning`).
- **Turning it on, on a phone, in production:** open any page with
  `?ab_<key>=<value>`. The proxy sets the QA cookie and the chip appears;
  every visit after is tagged as a test in analytics. Outside production
  (`next dev`) the chip is always there.
- **What a visitor pays:** ~190 B gz of first load on the template's place
  page. After hydration the gate checks `NODE_ENV` and the QA cookie
  (non-empty) and only then imports the panel — a chunk of its own, ~2.1 KB
  gz, that a visitor without the cookie never requests. The panel is the
  kit's `Button` and `Badge` over its own small layer, not `Popover`: sharing
  the overlay primitives with the page made Turbopack re-split the page's
  chunks, ~400 B gz more for every visitor.
- **Reset** drops the experiments' assignment cookies (`ab_<key>`) and the
  force parameters from the URL, then reloads: the variants are drawn again
  and the visit stays a test, menu included. **Leave test** drops the QA cookie
  too. **Minimize** and **Hide** last until the next load.
- Screenshots: the chip and its panel carry `data-ab-switcher`; hide it in the
  section stylesheet, `[data-ab-switcher] { display: none !important; }`.
- **Pass the same `qaCookie` to `AnalyticsBoundary` and `quoteRoute`
  (#219).** Every tap in the menu is a full reload, so a test visit would add
  page views — and form events — to the place's traffic. The mark is the
  sink's, not each event's: `analyticsSink(target, slug, id, qaCookie)` reads
  the cookie at every capture and adds `forced: true` on a test visit, so the
  boundary's page views and intents, the lead form's funnel
  (`lead_form_view` … `lead_estimate_shown`) and the booking's
  `lead_booking_open` / `lead_booking_done` all say it, and so will any event
  added later. `quoteRoute`'s `qaCookie` reads the post's `Cookie` header the
  same way for `lead_form_submit` and `lead_form_reject`. A test visit is the
  cookie set with a non-empty value — any value — on both sides
  (`qaVisit(cookies, name)`, exported for a brand's own server events).
  Without the prop, or without the cookie, the events are as before — no
  `forced` key at all.

  ```tsx
  <AnalyticsBoundary target={target} placeSlug={slug} qaCookie="ab__qa">
  ```

  ```ts
  // app/quote/route.ts
  export const POST = quoteRoute(site, { env: serverEnv, notifier, unavailable, qaCookie: "ab__qa" });
  ```

The decisions are plain functions in the core (`abSwitcherVisible`,
`abVariantUrl`, `abReset`, `abAssignments`), for a brand's own tests.

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
