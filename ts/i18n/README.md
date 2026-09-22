# @evinvest/i18n

A **dep-light** internationalisation toolkit for EV's five locales. It ships a
zero-dependency, server-safe **core** — locale registry, URL contract,
`Accept-Language` negotiation, and an ICU-subset message formatter — plus thin
**React** and **Next.js** subpaths.

> **Why this hard-codes its locales, unlike `@evinvest/experiments`.** That
> package deliberately never hard-codes experiment keys, because experiments are
> per-app. Locales are the opposite: the same five apply to the public site, the
> cabinet, and every MFE, and having one place they are declared is the whole
> point of putting this in a shared library. Helpers that iterate locales still
> accept an optional `locales` argument, so a surface shipping a subset is not
> forced to claim all five. A surface outside EV's five — a storefront with its
> own languages — builds its own registry; see
> [Your own locale set](#your-own-locale-set).

> **This package owns no number, date, or currency policy.** The formatter
> supports `plural` and `select` but deliberately not `number` / `date` /
> `currency`. Consuming apps keep **one policy per unit of measure** (see the
> cabinet's `shared/lib/money.ts`) and interpolate the already-formatted string.
> A second, competing number policy hiding inside message catalogues is exactly
> the drift that rule exists to prevent.

## Dep honesty

**Zero runtime dependencies.** `react` and `next` are **optional** peers
(declared in `peerDependenciesMeta`) — pull in only the subpath you use:

- `.` — pure core, no peers, server-safe, no React / Next / DOM. Enforced by
  `tsconfig.core.json`, which compiles `src/index.ts` with `lib: ["ES2022"]` and
  no `DOM`.
- `./react` — needs the `react` peer (a `"use client"` bundle).
- `./next` — needs the `next` peer only nominally; it imports nothing from
  `next` and returns plain data for `next.config.ts` and the metadata APIs.

`.` and `./next` ship **both ESM and CJS**. That is not symmetry for its own
sake: `next.config.ts` is loaded as CJS, so the ESM-only 0.1.0 could not be
`require`d there at all — it failed with `ERR_PACKAGE_PATH_NOT_EXPORTED` in the
one file `localeRewrites`/`localeRedirects` exist to serve. `./react` stays
ESM-only, since a `"use client"` module is consumed by a bundler and never
`require`d from a config.

## Install

```sh
npm i @evinvest/i18n
```

Requires Node ≥ 20. `dist/` is built on publish, not committed.

## The locales

| Code | Label | Tier |
| ---- | ----- | ---- |
| `en` | English | authored source; fallback for anyone we cannot place |
| `ru` | Русский | human-reviewed |
| `vi` | Tiếng Việt | human-reviewed |
| `fr` | Français | machine translation accepted |
| `de` | Deutsch | machine translation accepted |

Vietnamese is **`vi`** — the ISO 639-1 *language* code. `vn` is the ISO 3166
*country* code and is not a valid `hreflang` or `lang` value; Google discards
invalid values silently, so the distinction is load-bearing.

## The URL contract

One rule, applied identically by the public site and the cabinet: **the default
locale is unprefixed, every other locale carries a `/<locale>` prefix.**

```
en  →  /team              ru  →  /ru/team
en  →  /cabinet/wallet    ru  →  /cabinet/ru/wallet
```

Unprefixed English means no already-indexed URL has to move, and no redirect
sits on the busiest route. `localePath` and `splitLocalePath` are the only place
that asymmetry may be expressed — hand-built locale URLs elsewhere drift
immediately.

```ts
import { localePath, splitLocalePath, localeAlternates } from "@evinvest/i18n";

localePath("ru", "/team");        // "/ru/team"
localePath("en", "/team");        // "/team"
splitLocalePath("/ru/team");      // { locale: "ru", path: "/team" }
splitLocalePath("/cabinet/x");    // { locale: "en", path: "/cabinet/x" }
localeAlternates("/team");        // { en: "/team", ru: "/ru/team", … }
```

`languageAlternates` is the `alternates.languages` value for Next's
`generateMetadata` — absolute URLs keyed by `hreflang`, plus `x-default` on the
default locale:

```ts
languageAlternates("/team", "https://evinvest.ltd");
// { en: "https://evinvest.ltd/team", ru: "https://evinvest.ltd/ru/team", …,
//   "x-default": "https://evinvest.ltd/team" }
```

## Your own locale set

Everything above is `createLocaleRegistry` applied to the generated five
(`defaultLocaleRegistry`). A surface with other languages builds its own and
gets the same contract over its own list:

```ts
// shared/config/i18n.ts
import { createLocaleRegistry } from "@evinvest/i18n";

export const i18n = createLocaleRegistry({
  locales: ["fr", "en"],                        // switcher order; literal union, no `as const` needed
  labels: { fr: "Français", en: "English" },
  default: "fr",                                // fallback, and the language `t()` is authored in
  prefixDefaultLocale: true,                    // default: false
  hreflang: { fr: "fr-FR" },                    // default: the bare code
});
export type Locale = (typeof i18n.locales)[number];   // "fr" | "en"

i18n.localePath("fr", "/contact");              // "/fr/contact"
i18n.splitLocalePath("/en/contact");            // { locale: "en", path: "/contact" }
i18n.languageAlternates("/contact", "https://plombier.fr");
// { "fr-FR": "https://plombier.fr/fr/contact", en: "https://plombier.fr/en/contact",
//   "x-default": "https://plombier.fr/fr/contact" }
```

The registry carries every locale-dependent function of the core —
`isLocale`, `localePath`, `splitLocalePath`, `localeAlternates`, `hreflangOf`,
`languageAlternates`, `negotiate`, `translator`, `formatMessage`,
`localeOfElement` — plus `locales`, `labels`, `defaultLocale` and
`prefixDefaultLocale`. Members are plain closures, so destructuring is safe. A
`default` outside `locales`, or a locale listed twice, is a type error and
throws at startup.

**`prefixDefaultLocale`.** `false` is EV's contract: the default locale lives at
bare paths so indexed URLs never move. `true` prefixes every locale — the shape
for a site launching in several languages with no legacy URLs. An unprefixed
path then still parses (as the default locale, never throwing), but nothing is
served there.

**`hreflang`.** Locale codes stay bare — they are URL segments and catalogue
directories. A regional target (`fr-FR`, `fr-BE`) is only how the page is
*advertised*, so it lives in this map and surfaces in `hreflangOf` and the
`alternates.languages` keys. Tags must be unique (bare-code fallbacks included,
case-insensitively) and `x-default` is reserved — both throw at startup.
`languageAlternates` adds `x-default` only when the locales it is given include
the default; `localeAlternatesMetadata` in `./next` always adds it, as it
always has.

The subpaths bind to a registry the same way; each defaults to the generated
one, which is what their free exports are:

```ts
import { createNextI18n } from "@evinvest/i18n/next";
export const { localeStaticParams, localeRewrites, localeRedirects, localeAlternatesMetadata } =
  createNextI18n(i18n);
```

With `prefixDefaultLocale: true`, `localeRewrites()` is empty — every locale is
a real `[locale]` route — and `localeRedirects()` only sends `/` to `/<default>`,
as a **temporary** redirect so a later change of default is not pinned in
browsers. Other bare paths 404 under `dynamicParams = false`; a catch-all
redirect would also match the prefixed routes and loop.

```tsx
"use client";
import { createI18nReact } from "@evinvest/i18n/react";
export const { I18nProvider, useLocale, useT } = createI18nReact(i18n);
```

Each `createI18nReact` call owns its own context: call it once, at module
scope, and import the trio from there.

The extractor bins are bound to the generated registry. For another set, a
three-line launcher of your own passes it through — `runExtract` / `runCheck`
write and check `<messages>/<default>/common.json` as the source and every
other listed locale as a translation:

```js
#!/usr/bin/env node
import { runCheck } from "@evinvest/i18n/extract";
import { i18n } from "../shared/config/i18n.js";
runCheck(process.argv.slice(2), i18n);
```

The free `resolveCatalogue` and `availableIn` in `./policy` treat `en` as the
source — the generated registry's default. Against a French-source registry
they would read an empty English catalogue as 100 % covered, so bind the policy
to your registry instead:

```ts
import { createPolicy } from "@evinvest/i18n/policy";

const policy = createPolicy(i18n);                  // source = i18n.defaultLocale ("fr")
const { messages, coverage } = policy.resolveCatalogue("en", fr, enCatalogue);
policy.availableIn("en", posts, p => p.locales);    // "fr" always sees everything
```

A custom registry has **no Rust twin**. `ev_lib::i18n` mirrors only the
generated five; its plural rules are transcribed per locale by hand, so a
surface on its own locale set is TS-only.

## Wiring a Next.js app

Routing is **config-level, not middleware**. Put every page under
`app/[locale]/`, then let one **`fallback`** rewrite serve the default locale at
unprefixed paths. `fallback` runs last — after dynamic routes — so prefixed
locale routes and zone mounts (`/cabinet`, `/rea`, `/api/*`) never reach it, and
the app keeps shipping no `proxy.ts` at all.

```ts
// next.config.ts
import { localeRewrites, localeRedirects } from "@evinvest/i18n/next";

const nextConfig = {
  async rewrites() {
    return { beforeFiles: [...zoneRewrites], afterFiles: [], fallback: localeRewrites() };
  },
  // Collapses /en/* onto the unprefixed form so each page has one canonical URL.
  async redirects() {
    return localeRedirects();
  },
};
```

> **Not `afterFiles`.** This is the one easy mistake, and it half-works, which is
> what makes it dangerous. Next's order is `redirects → beforeFiles → filesystem
> → afterFiles → dynamic routes → fallback`. The entire `app/[locale]/` tree is a
> *dynamic* route, so an `afterFiles` rule fires **before** `[locale]` is tried:
> `/ru/team` gets rewritten to `/en/ru/team` and 404s, while `/team` resolves
> correctly and hides the bug. Verified on Next 16.2.9 — see
> `site_conductor/docs/i18n-routing-spike.md`.

```tsx
// app/[locale]/layout.tsx
import { localeStaticParams } from "@evinvest/i18n/next";

export const dynamicParams = false;              // unknown first segment ⇒ 404
export const generateStaticParams = localeStaticParams;  // includes "en" — see below
```

`generateStaticParams` **must** include the default locale: unprefixed URLs are
*rewritten* onto `/en/*`, so those routes have to be really prerendered even
though no reader ever sees that URL.

`dynamicParams = false` is **load-bearing, not hygiene.** Since
`app/[locale]/page.tsx` is the homepage, `[locale]` matches any single segment —
so `/team` is ambiguous with it. With `dynamicParams = false`, `[locale]`
declines the unknown segment and the request falls through to the `fallback`
rewrite that resolves it as English. Without it, `/team` renders the homepage
with `locale === "team"`.

## The policy

Three rules, enforced by `@evinvest/i18n/policy` rather than by review.

**1.1 — English is canonical.** `en` is the authored source: it defines the key
set, the placeholders, and the meaning. Every other locale is a derivation, and
only English introduces keys. A key that exists solely in a translation is
rejected as an orphan (it renders nowhere anyway — usually a rename that left the
translation behind).

**1.2 — A translation that no longer matches its English source is not used.**
English is served instead. This is the rule that stops a stale translation from
quietly contradicting the site: when the English changes and the translation does
not, the translation is no longer a translation of anything — it is last
quarter's claim, in another language, presented as current.

**1.3 — Compiled content with no translation for the current locale is hidden,**
not silently served in English. See `availableIn`.

### What "semantic comparison" means here

Nothing compares *meaning* across languages — no program does that reliably, and
one claiming to would fail silently, which is worse than not trying. Two things
*are* mechanically checkable, and together they catch what actually goes wrong:

- **Provenance** — each translated entry records the English text it was written
  against. If today's English differs, the entry is stale by construction.
- **Structure** — placeholders, argument types, and the plural categories a
  locale requires must all match. A Russian string handling only `one`/`other` is
  *provably* not equivalent to an English plural, because Russian also needs
  `few` and `many`. That one is arithmetic, not opinion.

A translation can still be a bad translation of the right source. That is a
reviewer's job, and the module does not pretend otherwise.

### Catalogue format

English stays a plain map. Every other locale carries the source it was
translated from:

```jsonc
// messages/en/common.json — canonical
{ "cart.items": "{n, plural, one {# item} other {# items}}" }

// messages/ru/common.json — each entry records its source
{
  "cart.items": {
    "en": "{n, plural, one {# item} other {# items}}",
    "t": "{n, plural, one {# товар} few {# товара} many {# товаров} other {# товара}}"
  }
}
```

The source is stored as *text*, not a hash. A hash would be shorter and equally
correct, but a reviewer could not see what the translator was looking at; inline,
a drifted entry is self-evident in the diff.

```ts
import { resolveCatalogue, auditCatalogues } from "@evinvest/i18n/policy";

const { messages, rejected, coverage } = resolveCatalogue("ru", en, ru);
const t = translator(messages, "ru");   // stale keys already fell back to English
```

Every English key is present in `messages` either way, so a page cannot break
because a translation went stale — it degrades to canonical English.

Wire `auditCatalogues` into CI. The runtime degrading safely is exactly why drift
needs a second, noisy channel: a silent fallback looks identical to a site that
was never translated, so without the check a locale can rot to zero coverage
unnoticed.

## Translating

**English is written where it renders.** `t` takes the key *and* the English
sentence, and `messages/en/common.json` is generated back out of the code.

```tsx
t("hero.title", "Invest in the China+1 narrative")
```

Two things follow, and the signature is what makes them unavoidable. Copy cannot
be edited in one place and read from another — there is only one place. And a
key a translated catalogue lacks renders **the sentence the component asked
for**, not a dotted key: the call site has the correct English in hand, so
showing `hero.title` on screen instead would be strictly worse. `onMissing`
still fires, and means one thing — the extractor was not re-run.

For `en` the catalogue is never consulted at all; there is nothing left to look
up.

Server Components call `translator()` directly — the locale is already in their
props, and there is no re-render to memoise against:

```tsx
// app/[locale]/team/page.tsx  (Server Component)
import { translator } from "@evinvest/i18n";

export default async function TeamPage({ params }) {
  const { locale } = await params;
  const t = translator(await loadMessages(locale, "team"), locale);
  return <h1>{t("team.title", "The people behind the fund")}</h1>;
}
```

Client islands use the provider — mounted as high as the *client* tree goes, not
around the whole document:

```tsx
import { I18nProvider } from "@evinvest/i18n/react";   // Server file, client boundary below
import { useT } from "@evinvest/i18n/react";

<I18nProvider locale={locale} messages={messages}>
  <WalletIsland />
</I18nProvider>
```

## Extracting

Two bins, same arguments, so a check and the extract that fixes it cannot be
pointed at different trees:

```sh
evinvest-i18n-extract --root frontend --exclude public,messages,tests
evinvest-i18n-check   --root frontend --exclude public,messages,tests
```

`--exclude` names what is **not** source, rather than what is. A list of source
directories is a hole that opens the day someone adds a slice, and an unscanned
call site produces no error — just English forever in five locales.
`--messages` defaults to `<root>/messages`.

`extract` writes `messages/en/common.json` and prunes every translated catalogue
down to the keys the code still asks for. The prune is unconditional because the
scan cannot see a *deleted* call site — only what remains.

`check` is the CI gate. Fatal: a committed English catalogue that no longer
matches the code (it would hand `resolveCatalogue` a stale source to compare
every translation against), and policy drift. Reported but not fatal:
untranslated keys — a locale is filled in over time, and blocking CI on an
unfinished translation would just get the check disabled.

Both refuse a `t()` whose key or English is not a literal. The point of inlining
is that the copy is visible where it renders, and a runtime-assembled key is
neither visible nor greppable.

`typescript` is an optional peer dependency: needed to run the extractor, never
to render a string.

## An element remote's locale

A microfrontend mounted as a custom element gets its locale from the DOM it is
mounted *into*:

```ts
import { localeOfElement } from "@evinvest/i18n";

connectedCallback() { mount(this, localeOfElement(this)); }
```

Not a prop and not an attribute. A host mounts the element before it applies
attributes, so anything pushed in reads as `null` at `connectedCallback` time.
`lang` is the platform's own answer to "what language is this subtree", it is
already set correctly by every host that serves more than one, and it is
readable the instant the node is attached. `ev_lib::mfe::host_locale` is the
Rust mirror.

## Message patterns

A deliberately small ICU subset:

| Form | Example |
| ---- | ------- |
| interpolation | `Hello, {name}.` |
| plural | `{n, plural, =0 {no roles} one {# role} other {# roles}}` |
| select | `{tier, select, fund {Fund} other {Guest}}` |
| escaping | `'{'` and `'}'` for literal braces, `''` for an apostrophe |

`#` inside a plural branch renders the count **in the reader's locale** — `ru`
groups thousands with spaces, `de` with dots.

Plural categories come from `Intl.PluralRules`, which is why this is not a bare
string map: Russian has `one` / `few` / `many`, Vietnamese has only `other`.

```ts
formatMessage("{n, plural, one {# вакансия} few {# вакансии} many {# вакансий}}", "ru", { n: 3 });
// "3 вакансии"
```

Apostrophes in ordinary copy are left alone — the ICU 4.8 "apostrophe-friendly"
rules apply, so a quote only starts a quoted section when it immediately precedes
`{`, `}` or `#`. `We've got it.` survives intact.

## Negotiation is for *suggesting*, not serving

`negotiate()` reads an `Accept-Language` header with q-values and regional
fallback (`ru-RU` → `ru`). Use it to decide which locale to **offer** — the
"read this in your language" strip — never to decide what to serve. EV serves the
default locale at unprefixed URLs and does not auto-redirect: Google crawls in
English from a US IP, so a language redirect can bury the other locales, and a
reader who deliberately chose English should not be bounced out of it.

## Rust counterpart

`ev_lib`'s `i18n` feature mirrors this package: the same registry, the same URL
contract, the same formatter, the same policy, and the same `(key, en)` call
shape via the `t!` macro. It reads the *same* `messages/<locale>/common.json`
files, so a catalogue is portable between the two halves and neither can drift
alone. Its extractor is the linker rather than a parser — a `t!` site that
compiles is registered — which is why the Rust half needs no equivalent of the
bins above.

## Scripts

```sh
npm run build      # tsup → dist/ (ESM; plus CJS for `.` and `./next`)
npm test           # vitest: node project for the core + next, jsdom for react
npm run typecheck  # full tsconfig, then the DOM-free core tsconfig
npm run preflight  # dry run for a release — checks everything, publishes nothing
```

## Release

Releases go through the repo-wide script, never `npm publish` from here — see
AGENTS.md for why (a hand publish skips the bump and the tag, and the tag is what
decides what gets released next time).

```sh
npm run preflight                                   # from ts/i18n — verify first
cd "$(git rev-parse --show-toplevel)"
NPM_TOKEN=… nix run .#publish -- minor              # bumps, publishes, commits, tags, pushes
```

`publish.rs` walks `ts/*` and treats a package with no `<name>-v*` tag as never
published, so this one is picked up automatically — nothing to register. It bumps
**before** publishing, which is why the manifest sits at `0.0.0`: `-- minor`
makes the first release `0.1.0`.

Two things to know for this first release:

- **A granular npm token probably cannot create it.** Granular tokens list the
  packages they may write to, and a package that does not exist yet cannot be on
  that list. npm reports the refusal as a 404, which is indistinguishable from
  "not found" — `publish.rs` says as much in its failure output. Use an
  automation or classic token with `@evinvest` write access for the first
  publish; granular is fine afterwards.
- **`prepublishOnly` runs `verify-pack.mjs`,** which refuses to publish a tarball
  that does not contain what `exports` promises. It follows each entry point's
  own imports rather than checking a fixed list, because `.`, `./react` and
  `./next` share a hash-named chunk whose filename changes every build — a
  missing chunk passes every `files`-field check and then throws
  `ERR_MODULE_NOT_FOUND` in the consumer.
