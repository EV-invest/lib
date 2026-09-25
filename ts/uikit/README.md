# @evinvest/uikit

A **dep-light** React UI kit with shadcn-style semantics — the TypeScript mirror
of the `uikit` feature of the [`ev_lib`](https://github.com/EV-invest/lib) Rust crate
(`ev_lib::uikit`, Dioxus). Both ports are driven from the same canonical class
strings and the same design tokens, so a component looks and behaves the same
whether it is rendered by React or by Dioxus.

"Dep-light" means: **no `@radix-ui/*`, no `class-variance-authority`, no
`lucide-react`, no charting / carousel / date-picker / OTP / toast libraries.**
Variant maps are plain objects fused with [`cn`](#cn); icons are inline SVG; and
all overlay behaviour (portals, floating placement, focus traps, dismiss layers)
is hand-rolled in [`./primitives`](src/primitives). Runtime dependencies are just
`clsx` + `tailwind-merge`, with `react`/`react-dom` as peers.

> This is the first library in the monorepo that ships runtime deps — a UI kit
> can't be zero-dep like the `architecture` kernel. See the repo `AGENTS.md`.

The kit ships **one file per module**, each with its own boundary: the
interactive ones (hooks, context, event handlers — `Select`, `Dialog`, `Field`,
`Input`, …) start with `"use client"`, and the static ones (`Button`,
`Section`/`Band`, `Table`, `Badge`, `Card`, `Footer`, `Label`, `cn`, …) do not.
Import everything from `@evinvest/uikit` in a Server Component: a static
component renders on the server and sends the browser nothing, and a client one
is a client reference as usual. `cn` is server-safe.

Keep it that way when adding to the kit:

- a module with a hook, a context or an `on*={…}` handler says `"use client"`
  on its first line, and one without says nothing —
  `test/client-boundary.test.ts` derives which is which from the source;
- `src/index.ts` names every re-export; `export *` fails the same test. A
  bundler has to load every starred module to learn its names, so one star on
  a client module ships it to every page that imports anything from the kit —
  on the aquafix landing that was ~26 KB gz of components it never rendered.

## Install

Published to the public npm registry:

```sh
npm i @evinvest/uikit
```

Requires Node ≥ 20 and React 18 or 19. `dist/` is built on publish, not committed.

## Design tokens — the theme contract

Every component's Tailwind classes reference design tokens and nothing else, so
a consumer re-themes the whole kit by writing values, never by overriding
classes. The tokens are **shipped with the package** and must be imported into
your Tailwind v4 entrypoint — this is the load-bearing part of the kit:

```css
/* app.css — your Tailwind v4 entrypoint */
@import "tailwindcss";
@import "@evinvest/uikit/styles/tokens.css";
```

| group | names |
|---|---|
| scope | `:root` · `[data-brand="…"]` — a theme root; `.light` · `.dark` — a polarity beneath it |
| surfaces | `background` `card` `popover` `muted` `hover` |
| ink | `ink` `ink-mid` `ink-soft` — hierarchy, loudest first |
| lines | `border` `input` `ring` |
| roles | `brand` `primary` `secondary` `positive` `accent-trace` `accent-debug` `accent-info` `accent-warn` `accent-error`, each with `on-*` where it gets filled; `primary-ink` — the primary role as ink on a surface (`#128377` fill under a white `on-primary`, `#2a9d8f` ink) |
| scalars | `radius` `control-radius` `control-py` `display-scale` `band-py` `page-max` `page-px` `shadow-*` `font-*` |
| charts | `chart-1` … `chart-5` |

Custom properties inherit, so a scope class on a `<section>` re-themes its
subtree — `bg-card text-ink` is correct on both polarities with no prop. That is
what `<Section polarity="dark">` does. Without `polarity` a `Section` sets no
scope and inherits its parent's, so a dark-first brand stays dark; pass
`"light"` or `"dark"` only where a band flips.

A surface takes its ink from the scope, so it carries no `-foreground`. A
**filled role** does not — gold wants black and navy wants white regardless of
polarity — so `on-{role}` exists exactly there.

A fill and an ink are different jobs, and `primary` is the one role that
names them separately: `primary` is the fill (`bg-primary text-on-primary` on
a button, a checked switch or checkbox — `#128377`, white reads on it at
4.63:1 and it clears 3:1 against `background`, `secondary`, `card` and
`popover`) and `primary-ink` is the same hue as ink (`text-primary-ink` on a
link or eyebrow, a radio dot, a slider range, `border-primary-ink` on a checked
outline, the focus `ring` — `#2a9d8f`, 5.85:1 on `background`, 4.72:1 on
`card`). Every other role holds its own label and reads as ink with one value.
A consumer sheet must define `--primary-ink`; see
[`docs/spec/accents.md`](../../docs/spec/accents.md).

Accents are decorative and **ordered by significance**, quiet to loud. Pick a
rung by how loud the thing should be, never by what it means; see
[`docs/spec/accents.md`](../../docs/spec/accents.md). Every consumer defines all
five, binding rungs it does not distinguish to the same value, which is what
lets a kit component reference an accent at all.

Variant names follow the same kind of unenforceable rule — a variant names the
state, never its appearance (`Red`) and never its selection (`Default`); see
[`docs/spec/variants.md`](../../docs/spec/variants.md).

`styles/tokens.css` is generated by `nix run .#gen` from the repo-root
`tokens.css` shared with the Rust feature — flattened, so it is self-contained.
It has two halves, each also shipped as a flat sheet of its own —
`styles/theme.css` (the contract) and `styles/ev.css` (EV's palette):

- **the contract** — the `@theme inline` mapping, the geometry, and the tokens
  *derived* from a palette (`hover`, `ink-mid`, `ink-soft`, `border`, `input`
  from `ink`; `ring` from `primary-ink`). The derived ones are redeclared on
  `:root`, `[data-brand]`, `.light` and `.dark` at zero specificity, so a brand
  scope gets its own borders, hover and focus ring rather than inheriting the
  root's, and a palette may still pin any of them outright. The geometry
  (`radius`, `page-px`, `band-py`, …) and its responsive scale-ups restart on
  every `[data-brand]` the same way.
- **EV's palette** — a single dark palette on `:where(:root, [data-brand="ev"])`.
  It binds neither polarity class, so a `.dark` section inside another brand
  never picks EV's values up, and `<Section polarity="light">` under EV is a
  no-op (EV is single-polarity).

### Brand palettes

A second brand is a palette against the same names, scoped to
`[data-brand="<slug>"]`; light is its default and `.light` / `.dark` beneath it
pick a polarity, so a `<Section polarity="dark">` inside the brand takes the
brand's dark values. The package ships a generator for it, reading the
`brand.toml` shape (`[colors.light]` and `[colors.dark]`, keyed by token name;
optional top-level `mark` and `mark-aspect` become `--brand-mark` and
`--brand-aspect`; the family names in `[fonts]` — `sans` (or aquafix's `text`),
`display`, `mono` — become the [font parameters](#fonts); other keys and tables
are ignored). Each polarity block also declares `--scheme: light | dark`, which
the platform-drawn parts of the kit read (a `NativeSelect`'s popup):

```sh
npx evinvest-palette --brand aquafix --out app/brand.css assets/brand.toml
```

It fails — naming every hole — unless **both** polarities declare every name the
contract requires: Tailwind answers an undefined token with no rule at all, so a
hole would be silent on the page. Values must be `#hex` or `var(--token)`. The
list of required names is read from the installed kit's own `styles/theme.css`,
never restated. The same functions are importable for a build script or a Vite
plugin from `@evinvest/uikit/palette` (Node-only; see `example/vite.config.ts`).
The generator checks completeness, not contrast: measure a new palette against
the floors in `test/tokens.test.ts`, which runs them over every palette the kit
knows.

```css
@import "tailwindcss";
@import "@evinvest/uikit/styles/tokens.css";
@import "./brand.css"; /* order does not matter: EV's palette has zero specificity */
```

```html
<html data-brand="aquafix">
```

An app that never shows EV's palette imports the contract alone, so a name its
palette misses stays a visible hole instead of falling back to EV's value:

```css
@import "tailwindcss";
@import "@evinvest/uikit/styles/theme.css";
@import "./brand.css";
```

Overlays (`Dialog`, `Select`, `Popover`, `Tooltip`, menus, …) portal to
`document.body` and would leave the brand scope there. Wrap the scope's content
in `PortalProvider` with an element **inside** the scope — and inside its
polarity, or a dialog opened from a dark band comes up light:

```tsx
const [overlays, setOverlays] = useState<HTMLDivElement | null>(null);

<section data-brand="aquafix" className="dark">
  <PortalProvider container={overlays}>{children}</PortalProvider>
  <div ref={setOverlays} />
</section>
```

Put the container as a direct child of the `[data-brand]` (or polarity)
element, and never under an ancestor with `overflow: hidden`, a `transform`,
`filter` or `perspective`, or anything else that makes a containing block or
an isolated stacking context (`contain`, `isolation: isolate`, a `z-index`ed
positioned box): overlays are positioned `fixed`/`absolute` against the
viewport and stacked by `z-index`, so any of those clips them, offsets them, or
buries them under the page.

A brand on `<html>` needs no provider: `document.body` is already inside it.
Brand scopes do not nest — CSS has no "nearest ancestor", so a polarity class
under a brand under another brand may match either.

### Fonts

The families are parameters, one per role; unset, each is EV's:

| parameter | utilities | default (EV) |
|---|---|---|
| `--brand-font-sans` | `font-sans`, the page's base family | `--font-inter`, else `"Inter"` |
| `--brand-font-display` | `font-display`, `font-serif` | `--font-playfair`, else `"Playfair Display"` |
| `--brand-font-mono` | `font-mono` | `--font-inter`, else `"Inter"` |

Declare them on the brand scope (the palette generator writes them from
`[fonts]`) and load the files yourself — `next/font`, or your own `@font-face`;
the kit ships no font files:

```css
[data-brand="aquafix"] {
  --brand-font-display: "Archivo";
}
```

The utilities resolve the chain on the element, so a scope re-fonts everything
under it that carries one. The page's base family resolves once, on `<html>`: a
brand scoped lower than `<html>` puts `font-sans` on its own element so plain
text picks the brand's family up.

## Forms that submit before hydration

A landing page's form has to work with scripting off and keep its labels wired
through hydration. Three parts of the kit make that hold:

- **`NativeSelect`** is a real `<select name>` wearing the kit's control — the
  kit's arrow instead of the OS one, token colours, the popup following the
  palette's `--scheme`. It posts with the form without any script, and the
  popup is the platform's (keyboard, type-ahead, the mobile picker).
  `NativeSelectOption` / `NativeSelectGroup` are `<option>` / `<optgroup>`.
  `placeholder` adds an empty, unpickable first option, selected until a value
  is chosen and styled `text-ink-soft`; with `required`, the browser refuses to
  submit it. `className` styles the `<select>`, `wrapperClassName` the box that
  holds it and the arrow. That box is `w-full`, like `Input`, so the two line
  up in a form column; narrow it with `wrapperClassName`, not `className`.

  It is a component of its own rather than a mode of `Select`: none of
  `SelectTrigger` / `SelectValue` / `SelectContent` has a native counterpart.
  `Select` stays the scripted combobox for what a platform popup cannot draw
  (rich rows, a check mark, brand-styled menus everywhere).
- **`Field` mints the id** with `React.useId` — positional, so the server and the
  hydrating client agree — and hands it to its `FieldLabel` as `for` and to the
  kit's `Input`, `Textarea`, `NativeSelect`, `SelectTrigger`, `Checkbox` and
  `Switch` as `id`, each only when the caller passed none. No `FormControl`
  wrapper is needed. Want your own id — pass `controlId` to the `Field`, and
  both ends take it. One control per `Field`: when it holds more, give the
  others an `id` of their own (a development warning names the collision).
  A `FieldLabel` that wraps its control (`<FieldLabel><input type="checkbox" />
  Accept</FieldLabel>`, or a nested `Field` — the choice card) gets no `for`:
  the wrapping already labels it. A control hidden inside a component of yours
  is invisible to that check; pass `htmlFor={null}` there to drop the `for`.
  (`FormItem` / `FormControl` keep their own `useId` wiring for forms that
  want `aria-describedby` too.)
- **`SelectValue` shows the label**, not the stored value: the matching
  `SelectItem`'s `textValue`, else the text of its children — text, so an id in
  the item's markup is not rendered a second time in the trigger. It is read off
  the element tree, so it is right on the server and before the popover first
  opens. An item rendered by a component of yours is learnt when it mounts (on
  the first open), and the trigger updates then; pass `SelectValue` children to
  show something else outright.
- **`Select` keeps focus where a native one would.** Focus moves into the
  list and back out. The list is portaled, so where it goes is the kit's job,
  not the DOM order's:
  - **Opening** (a click, Enter, Space or the arrows on the trigger) focuses the
    chosen option, else the first, without scrolling the page; the list alone
    scrolls it into view.
  - **In the list**, the arrows, Home and End move between options (read from
    the DOM, so groups, labels, separators and items rendered by your own
    components all count); typed letters jump to the next option that starts
    with them; Enter or Space chooses.
  - **Closing** by a key or a choice (Escape, Tab, Enter) hands focus back to
    the trigger; Tab then goes on to the next field — inside a `Dialog` or
    `Drawer` it wraps within the modal as its trap does. A click elsewhere
    closes it and leaves focus where the click put it: the trigger is never
    focused on the way out, so its blur (a field's validation) does not fire.
  - **Escape** closes the topmost overlay only: the list, not the `Dialog` or
    `Drawer` around it (dismissable layers stack), and a click in the list is
    not "outside" the modal that holds its trigger.
  - The trigger carries `aria-haspopup="listbox"` and, while open,
    `aria-controls`; the list is named by the trigger's label.

  The open list is at least as wide as its trigger (the trigger's width rides
  on `--select-trigger-width`), at most 24rem, and never wider or taller than
  the viewport less 1rem a side: a long option wraps rather than pushing the
  list off a narrow screen. The trigger's width wins over the 24rem cap: a
  trigger wider than 24rem opens a list exactly as wide as itself (CSS lets
  `min-width` beat `max-width`). A `className` with its own `min-w-*` / `max-w-*` /
  `max-h-*` replaces the matching bound. The keyboard-focused option carries
  an inset `--ring` over its tint (`OPTION_FOCUS_RING`). It posts nothing by
  itself; `FormSelect` in `@evinvest/kitstart/react` pairs it with a form
  value.

```tsx
<form action="/lead" method="post">
  <Field>
    <FieldLabel>Service</FieldLabel>
    <NativeSelect name="service" placeholder="Pick one" required>
      <NativeSelectOption value="leak">Leak</NativeSelectOption>
      <NativeSelectOption value="boiler">Boiler</NativeSelectOption>
    </NativeSelect>
  </Field>
  <Field>
    <FieldLabel>Phone</FieldLabel>
    <Input name="phone" type="tel" />
  </Field>
  <Button type="submit">Request a call</Button>
</form>
```

**Focus.** A control that paints a fill — `Button` `primary` / `secondary` /
`destructive` or any accent fill, a filled `Badge`, `Switch`, `Checkbox` —
shows focus as the solid `ring` standing 2px off it, so both edges of the
indicator are against the surface: the ring reads on every surface at ≥ 3:1
and so does the fill, on every palette and polarity `test/tokens.test.ts`
measures. Controls that sit on the surface (`outline`, `ghost`, inputs) keep
the `ring` border plus its halo.

## Usage

```tsx
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from "@evinvest/uikit";

export function Example() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio</CardTitle>
        <Badge variant="success">+12.4%</Badge>
      </CardHeader>
      <CardContent>
        <Button onClick={() => {}}>Invest</Button>
      </CardContent>
    </Card>
  );
}
```

### `cn`

```ts
import { cn } from "@evinvest/uikit";
cn("p-4", "p-2"); // "p-2" — tailwind-merge resolves the conflict, rightmost wins
```

`cn` (clsx + tailwind-merge) is the mirror of the Rust `cn!` macro
(`tailwind_fuse::tw_merge!`). A caller's `className`, passed last, beats the base.

## Rust ↔ TS parity

The Rust crate is the source of truth; this package preserves its _semantics_
while reading like idiomatic React. Canonical class strings are identical per
element across the two ports.

| Concept | Rust (`ev_lib::uikit`) | TS (`@evinvest/uikit`) |
| --- | --- | --- |
| class fusion | `cn!` macro (`tailwind_fuse`) | `cn` (`clsx` + `tailwind-merge`) |
| variants | `enum` + `fn class()` match | `as const` map keyed by variant |
| `asChild` | n/a (uses `children`) | `Slot` primitive |
| controlled state | `use_controllable` | `useControllableState` |
| keyboard nav | `use_roving_focus` | `useRovingFocus` |
| overlay placement | inline `position:fixed` + `data-side` | `Portal` + `useFloating` |
| dismiss / focus trap | full-screen backdrop / native order | `useDismissableLayer` / `useFocusScope` |

### Component inventory (all 63 bricks)

- **Tier A — static (23):** badge, button, button-group, card, input, textarea,
  label, field, separator, skeleton, spinner, kbd, table, container, alert,
  breadcrumb, empty, item, input-group, avatar, progress, pagination,
  native-select (TS-only).
- **Tier B — interactive (13):** accordion, collapsible, tabs, toggle,
  toggle-group, switch, checkbox, radio-group, slider, sidebar, scroll-area,
  carousel, input-otp.
- **Tier C — overlay (13):** tooltip, popover, hover-card, dropdown-menu,
  context-menu, menubar, navigation-menu, dialog, alert-dialog, sheet, drawer,
  select, command.
- **Tier D — engines (6):** chart, calendar, date-time-picker, sonner (toaster),
  form, resizable.
- **Site chrome (7):** header (marketing / compact density, plus `hideNav`),
  footer, logo, and the shared status pages — `StatusScreen` with the `NotFound`
  / `Forbidden` / `ServerError` presets (404 / 403 / 500). The kit ships no
  artwork: `Logo` masks whatever `--brand-mark` / `--brand-aspect` the consumer
  declares beside the palette, and the status pages use it for their mark.
- **Features — composed screens (1):** terminal — a trading terminal over an
  investment product's shares (`Terminal` grid placing each `TerminalPane` by
  `TerminalArea`; `TerminalTicker` / `TickerStat`; `OrderBook` with
  `OrderBookHead` / `OrderBookRow` / `OrderBookSpread`; `TradesTapeRow`;
  `OrderForm` / `OrderFormRow` / `OrderFormSubmit`; `OpenOrdersEmpty`). Column
  captions and every figure are the consumer's strings — the kit knows no
  locale and no number format.

The canonical variant set is the **superset** of the original cabinet (Rust) and
landing (TS) sources — e.g. `Badge` keeps cabinet's `success` variant, and
`Button` keeps landing's square icon shape at every size, as the separate `icon`
boolean it always was in Rust (see [docs/spec/variants.md](../../docs/spec/variants.md)).

## Limitations

Reproducing everything dep-light means some behaviour is intentionally reduced,
especially on the Rust side (Dioxus has no renderer-agnostic portal, and layout
measuring needs host-only `web-sys`). Known gaps:

- **Theme:** single dark palette; `dark:*` utility variants are dropped.
- **Rust overlays** (dialog, popover, dropdown, select, menus, tooltip, …) render
  inline with `position:fixed` + a backdrop and CSS-only placement — no portal,
  no viewport-measured floating, native focus order (no trap). TS overlays use a
  real `Portal`, single-flip `useFloating` (absolute in the document, so it
  scrolls with the page natively), `useDismissableLayer`, and `useFocusScope`.
- **chart:** the recharts plotting engine is not bundled. `ChartContainer` is a
  themed SVG host (emits `--color-*` from its config); `ChartTooltipContent` /
  `ChartLegendContent` are presentational and take explicit items. Draw series
  yourself inside the container.
- **terminal:** no plotting engine and no state. `TerminalChart` is a sized
  `relative` host that hands its element out (`ref` in TS, `id` in Rust) for a
  consumer-chosen charting library to mount into; `OrderForm` only prevents the
  submit's default — inputs, validation and the order itself are the
  consumer's. The open-orders pane reuses `Table` and `Tabs`.
- **calendar:** single month, single-date selection (no range/multi-month, no
  dropdown captions). The grid is always six fixed weeks of 36px cells, so its
  size never changes with the month or the locale's weekday labels, and it
  paints no background of its own (the host does). `min`/`max` bound the grid
  at day granularity (days outside render `disabled` + `data-disabled="true"`);
  `disabled` freezes the whole grid and the nav the same way; the nav buttons
  take label overrides. TS-only `locale` renders the caption and weekday headers through
  `Intl` (Monday-first): `weekday: "short"`, falling back to `"narrow"` for a
  locale whose short form contains whitespace (vi's "Thứ 2" → "T2", he's
  "יום ב׳" → "ב׳") as long as narrow still yields seven distinct labels. Rust has no `Intl`, so its captions
  stay English. Rust does manual date math; TS uses the built-in `Date`.
- **date-time-picker:** the kit's own bricks only — an outline trigger, a
  `Popover` with the `Calendar` and two numeric 24-hour hours/minutes fields (no
  native `datetime-local` / `time` input, so the browser's locale popup never
  appears). Its ARIA and button strings are `labels` overrides with English
  defaults — the nav buttons, the hours/minutes `aria-label`s, the clear button,
  the close button (`labels.close`, which keeps the value) and the popover's own
  accessible name (`labels.dialog`). TS formats the trigger label through `Intl` when `locale` is set,
  else `YYYY-MM-DD HH:MM`; Rust has no `Intl`: the ISO-like label or the
  `format` callback, English month/weekday captions. The hidden form value is
  unix seconds in TS and `YYYY-MM-DDTHH:MM` in Rust (no zone there). The Rust
  overlay is the inline popover described above.
- **sonner:** both ports stack toasts Sonner-style — a collapsed pile (front
  three peeking, scaled by depth) that spreads into a list on hover / keyboard
  focus, via the shared `data-stack` CSS in `tokens.css`. The enter is a CSS
  keyframe (plays on insertion), the exit slides out on `data-state="closed"` and
  unmounts on `transitionend` (no host timer). React measures each toast's height
  for exact expanded spacing; Dioxus can't (layout measuring needs host-only
  `web-sys`), so it assumes a constant height — collapsed pile exact, expanded
  list uniform. Both **auto-dismiss** (default 4000ms) and **pause while the stack
  is hovered/focused**, and support **persistent** toasts; React does it with a
  `setTimeout` (`duration: Infinity` to persist), Dioxus with a host-timer-free
  CSS "life" animation whose `animationend` closes the toast (`use_toaster().show(
  msg, variant, None)` to persist). Swipe-to-dismiss (horizontal drag, past 45px
  or a fast flick) is TS-only pointer physics.
- **form:** react-hook-form is dropped — these are presentational + ARIA-id
  wiring; consumers own validation/state. Rust `FormControl` can't inject ids
  onto an arbitrary child (no `Slot`), so it publishes them as a
  `FormControlContext` that `Input`/`Textarea` consume; wrap a bare element and
  you wire them yourself.
- **resizable / carousel:** pointer-drag physics are TS-only (keyboard in Rust
  for resizable; prev/next + keyboard for carousel). Embla momentum is not
  reproduced.
- **drawer:** the Vaul-style enter/exit motion is shared by both ports via
  `motion.css` (inlined into `tokens.css`), keyed on `data-slot` +
  `data-vaul-drawer-direction` + `data-state`; the panel stays mounted on close
  until its exit `transitionend`. Drag-to-dismiss (Vaul's pointer physics, from
  any of the four edges; opt a region out with `data-vaul-no-drag`) is TS-only;
  Rust dismisses on scrim click / Escape / `DrawerClose`. The panel is
  `touch-action: none` so a touch never turns into a page pan, which also means
  the panel itself must not scroll: the kit renders children inside a
  `data-slot="drawer-body"` scroller (`overflow-y-auto`), so cap the sheet with
  `max-h-*` on `DrawerContent` and let the body scroll by itself.
- **sidebar:** the mobile-sheet integration, cookie persistence, and keyboard
  shortcut are omitted.
- **footer:** brings no content of its own — every string, the mark and the
  lock-up are the caller's, and each column renders only when it has content.
  The lock-up is composed from `mark` + `brand` (display family) + `tagline`,
  or passed whole as `lockup`. Brand-coloured text reads `primary-ink`.
- **TS-only for now:** `NativeSelect`, the `Field` id hand-off and
  `SelectValue` labels.
- **brand chrome (header / footer / status pages):** TS routes links through an
  optional `linkComponent` (e.g. `next/link`) for soft navigation; Rust renders
  plain `<a>` (a full document load). The Dioxus header drives its scroll state,
  body-scroll lock, and overlay dismissal via `document::eval` (SSR-safe no-op);
  `ServerError`'s retry runs a host `reset` or reloads the page.

## Develop

```sh
npm i
npm run typecheck   # tsc --noEmit
npm run test        # vitest (jsdom + @testing-library)
npm run build       # tsup → dist/ (ESM + d.ts)
```

The Rust counterpart is verified from the repo root:

```sh
cargo test  -p ev_lib --features uikit
cargo clippy -p ev_lib --features uikit --all-targets -- -D warnings
cargo check -p ev_lib --features "uikit wasm" --target wasm32-unknown-unknown
```
