# @evinvest/marketing

The **marketing-site layer** on top of [`@evinvest/uikit`](../uikit): what every
landing page needs and the kit deliberately does not carry — motion primitives,
a key-based form harness and field, a contact-link click tracker, a
click-to-load facade for third-party embeds, and schema.org JSON-LD builders.

It is a separate package so the kit stays **dep-light**: motion pulls in
`motion`, and the kit promises no animation library. The kit stays the core;
this package only composes it.

Lifted from `site_conductor` (`shared/ui/motion`, the form harness, the cabinet
entry tracker, the YouTube plate) and generalised: **no brand strings, logos,
copy, or i18n library**. Anything a reader sees is passed in — a translated
string, or a translator `t(key)`.

There is no Rust counterpart: this is browser/React-only glue, like `i18n` has
none yet.

## Dep honesty

**Zero runtime dependencies.** Peers:

- `react` 18 or 19 — required;
- `motion` 12 or 13 — **optional**, needed by `./react` (the motion
  primitives);
- `@evinvest/uikit` ≥ 0.18 — **optional**, needed by `./react` (`TextField`
  is built on its `Field` / `Input` / `Textarea`; classes use only its tokens).

Both are optional because the `.` core imports neither; a consumer of
`./react` installs them. A test keeps the declared peers equal to what the
sources import.

No icon library: the two glyphs it draws (a check, a play triangle) are inline
SVG.

Two entry points:

- `.` — **server-safe core**: no `"use client"`, no hooks, no DOM. Motion
  tokens, `accented`, validation helpers, contact-link helpers, JSON-LD.
  Import these from Server Components and you get real values, not client
  references.
- `./react` — a **`"use client"` bundle**: the motion primitives, the form
  harness and field, the tracker, the facade, document typography.

## Install

```sh
npm i @evinvest/marketing @evinvest/uikit motion
```

Its components carry Tailwind classes (token classes only), so let Tailwind
scan the bundle next to the kit's:

```css
@import "tailwindcss";
@import "@evinvest/uikit/styles/tokens.css";
@source "../node_modules/@evinvest/marketing/dist";
```

The motion primitives and the tracker use inline styles for the parts that must
hold without that scan (the visually-hidden headline copy, `display: contents`).

## Motion — `./react`

| Primitive | Use for | Trigger |
|---|---|---|
| `Reveal` | one block arriving | scroll (`whileInView`), or `onMount` above the fold |
| `Settle` | a block that must be **there on first paint** (a primary CTA) and only firms up | mount |
| `Stagger` + `StaggerItem` | a row/grid arriving in sequence | scroll or `onMount` |
| `SplitText` | a **display headline** assembling word by word | mount, or `inView` |
| `CountUp` | a figure counting up (server renders the final value) | scroll |

Rules the primitives enforce, and hand-written motion must follow:

- **`opacity` and `transform` only** — anything else animates off the
  compositor and janks.
- **Once.** `VIEWPORT` has `once: true`; a section that re-animates on every
  scroll-back reads as broken.
- **`prefers-reduced-motion` collapses movement to a plain fade, never to
  nothing** — the content still has to arrive. (`Settle` renders at rest: its
  content never left.) `<MotionConfig reducedMotion="always">` forces the
  reduced path too; `useReduceMotion()` exposes the same decision.
- **`SplitText` is for display type only**, and keeps a visually-hidden copy of
  the sentence for screen readers — don't strip it.
- **Never wrap a `position: fixed` descendant in a moving `Reveal`** (the
  transform becomes its containing block). Use `from="none"`.

Timing comes from the tokens in `.` — `EASE`, `DUR`, `RISE`, `STAGGER`,
`STAGGER_TEXT`, `SETTLE_OPACITY`, `VIEWPORT`, `VIEWPORT_Y` (for narrow elements
near a screen edge), `VIEWPORT_LIVE` (looping ambience only). Never inline an
easing or a duration.

```tsx
import { STAGGER, accented } from "@evinvest/marketing";
import { Reveal, SplitText, Stagger, StaggerItem } from "@evinvest/marketing/react";

<h1><SplitText>{accented({ text: t("hero.title") })}</SplitText></h1>
<Stagger>{cards.map(c => <StaggerItem key={c.id}>…</StaggerItem>)}</Stagger>
<Reveal delay={STAGGER * 2}>…</Reveal>
```

`accented` turns `"Fix it *today*.\nCall us"` into text, an accent `<span>` and
a `<br>` — one catalogue key a translator can reorder. Call the **function**
inside `SplitText`; `<Accented>` is for headings that are not split.

## Forms — errors are keys, not prose

A schema lives at module scope, where no translator exists, and serves every
locale. So its messages are **translation keys**, and the form resolves them at
render with your `t`.

```ts
// lead-form.schema.ts — module scope, no translator
import { z } from "zod";
import { charLength, fromSafeParse } from "@evinvest/marketing";

const lead = z.object({
  name: z.string().trim().refine(v => charLength(v) >= 2, "validation.name.min"),
  phone: z.string().trim().min(6, "validation.phone.invalid"),
});
export const validateLead = (f: { name: string; phone: string }) =>
  fromSafeParse(lead.safeParse(f));
```

```tsx
// lead-form.tsx
"use client";
import { SentPanel, TextField, useValidatedForm } from "@evinvest/marketing/react";

const form = useValidatedForm({
  initial: { name: "", phone: "" },
  validate: validateLead,
  send: data => api.POST("/leads", { body: data }), // { data, error } or a Response
  t,
});

if (form.status === "sent") return <SentPanel title={t("lead.sent")}>{t("lead.sentBody")}</SentPanel>;
return (
  <form onSubmit={form.submit} noValidate>
    <TextField label={t("lead.name")} autoComplete="name" {...form.field("name")} />
    <TextField label={t("lead.phone")} type="tel" {...form.field("phone")} />
    {form.failure && <p role="alert">{t(`lead.failure.${form.failure}`)}</p>}
  </form>
);
```

- `errors` in state are keys; `field(name)` resolves one through `t` and binds
  `value` / `onChange` / `error` for `TextField`. Editing a field clears its
  error.
- `send` resolving counts as sent, unless the value has a truthy `error`
  (openapi-fetch) or `ok: false` (a `Response`); throwing is a `network`
  failure. `failure` is `"submit" | "network"` — a key, never the backend's
  sentence.
- `TextField` is the uikit `Field` + `Input`/`Textarea`; the error is
  announced for its control (`aria-invalid` + `aria-describedby`).
- `fromSafeParse` / `firstFieldErrors` accept any zod-3/4-shaped result
  structurally; the package does not depend on zod.

## Contact-link tracking

```tsx
import { ContactLinkTracker } from "@evinvest/marketing/react";

<ContactLinkTracker onContact={({ channel, href, data }) => capture("contact_clicked", { channel, ...data })}>
  {children}
</ContactLinkTracker>
```

One delegated listener in the **capture phase** reports clicks on `tel:`,
`mailto:` and WhatsApp (`wa.me`, `api.whatsapp.com`, `web.whatsapp.com`,
`whatsapp:`) links anywhere below it — including markup the app does not own
and widgets that stop propagation. It never cancels the navigation. The link's
`data-*` attributes come through as `data`, so `<a data-location="hero">` tags
the event without the tracker knowing your vocabulary.

The sink is **injected**: the package never imports `@evinvest/analytics`.
Pick a beacon transport in your sink — `tel:` / `wa.me` hand the reader to
another app right after the click.

`contactChannel(href)`, `telHref(phone)` and `whatsappHref(phone, message?)`
live in the core, so links are built and classified by the same rule.

## Click-to-load facade

```tsx
import { ClickToLoad, YouTubeFacade } from "@evinvest/marketing/react";

<ClickToLoad
  className="relative aspect-video"
  onLoad={() => capture("map_opened")}
  placeholder={load => (
    <button type="button" onClick={load}>
      <img src="/map-static.webp" alt={t("contact.mapAlt")} />
      {t("contact.showMap")}
    </button>
  )}
>
  <iframe title={t("contact.mapTitle")} src={mapsEmbedUrl} className="absolute inset-0 size-full" />
</ClickToLoad>

<YouTubeFacade videoId="…" title={t("video.title")} playLabel={t("video.play")} />
```

Until activated, the DOM holds the placeholder only — no vendor script, no
iframe, no request, no cookie — so a cookieless page stays cookieless. On
activation the widget mounts and receives focus (the activating control is
gone). `YouTubeFacade` loads `youtube-nocookie.com` with autoplay and falls back
`maxresdefault` → `hqdefault` → a flat field for its poster.

## JSON-LD — `.`

```tsx
import { JsonLd, localBusiness } from "@evinvest/marketing";

<JsonLd
  data={localBusiness(
    {
      id: `${site}/#${point.slug}`,
      type: "Plumber",
      name: point.name,
      url: `${site}/`,
      telephone: point.phone,
      address: point.address,
      geo: point.geo,
      parentOrganization: { "@id": `${site}/#organization` },
    },
    { openingHoursSpecification: point.hours },
  )}
/>
```

`ldCompact` drops empty values, so a fact not on file never emits a blank
field. `JsonLd` escapes `<`, so no value can close the `<script>`. The site's
organisation node, its `@id` scheme and where a location's facts come from stay
in the app.

## Also in `./react`

- `H1`…`H6`, `P` — document typography (legal pages, articles) on token
  classes (`font-display`, `text-ink`, `text-primary-ink`), each with `asChild`.
- `createStatusCopy<T>()` — a typed provider/hook pair to hand server-resolved
  copy to Next's client-only `error.tsx` without shipping every catalogue;
  the hook returns `null` rather than throwing without a provider.

## Develop

```sh
npm ci
npm run typecheck   # full + DOM-free core
npm test            # *.node.test.* in node, *.react.test.tsx in jsdom
npm run build
```
