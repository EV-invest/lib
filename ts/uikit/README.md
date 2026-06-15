# @ev/uikit

A **dep-light** React UI kit with shadcn-style semantics — the TypeScript mirror
of the `uikit` feature of the [`ev`](https://github.com/EV-invest/lib) Rust crate
(`ev::uikit`, Dioxus). Both ports are driven from the same canonical class
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

The bundle is a **`"use client"`** module (it's interactive — hooks, context,
the DOM), so it can be imported from React Server Components / the Next.js App
Router directly. One consequence: `cn` re-exported here is therefore client-only;
if you need class merging in a **server** component, keep a local `cn`
(`clsx` + `tailwind-merge`) rather than importing it from the kit.

## Install

This package lives in a subdirectory of a polyglot monorepo:

```sh
npm i 'https://gitpkg.vercel.app/EV-invest/lib/ts/uikit?<tag-or-sha>'
```

`dist/` is not committed; the `prepare` script builds it (tsup) on install.
Requires Node ≥ 20 and React 18 or 19.

## Design tokens — the theme contract

Every component's Tailwind classes reference design tokens (`bg-primary`,
`text-card-foreground`, `border-input`, `ring-ring`, `bg-main-accent-t2`, …).
Those tokens are **shipped with the package** and must be imported into your
Tailwind v4 entrypoint — this is the load-bearing part of the kit:

```css
/* app.css — your Tailwind v4 entrypoint */
@import "tailwindcss";
@import "@ev/uikit/styles/tokens.css";
```

`styles/tokens.css` is kept byte-for-byte in parity with the Rust feature's
`tokens.css`; it defines a single **dark** palette via `:root` and wires it into
Tailwind utilities via `@theme inline`. (The kit drops `dark:*` utility variants
because the palette is dark by default — see [Limitations](#limitations).)

## Usage

```tsx
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from "@ev/uikit";

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
import { cn } from "@ev/uikit";
cn("p-4", "p-2"); // "p-2" — tailwind-merge resolves the conflict, rightmost wins
```

`cn` (clsx + tailwind-merge) is the mirror of the Rust `cn!` macro
(`tailwind_fuse::tw_merge!`). A caller's `className`, passed last, beats the base.

## Rust ↔ TS parity

The Rust crate is the source of truth; this package preserves its _semantics_
while reading like idiomatic React. Canonical class strings are identical per
element across the two ports.

| Concept | Rust (`ev::uikit`) | TS (`@ev/uikit`) |
| --- | --- | --- |
| class fusion | `cn!` macro (`tailwind_fuse`) | `cn` (`clsx` + `tailwind-merge`) |
| variants | `enum` + `fn class()` match | `as const` map keyed by variant |
| `asChild` | n/a (uses `children`) | `Slot` primitive |
| controlled state | `use_controllable` | `useControllableState` |
| keyboard nav | per-component signals | `useRovingFocus` |
| overlay placement | inline `position:fixed` + `data-side` | `Portal` + `useFloating` |
| dismiss / focus trap | full-screen backdrop / native order | `useDismissableLayer` / `useFocusScope` |

### Component inventory (all 63 bricks)

- **Tier A — static (22):** badge, button, button-group, card, input, textarea,
  label, field, separator, skeleton, spinner, kbd, table, aspect-ratio, alert,
  breadcrumb, empty, item, input-group, avatar, progress, pagination.
- **Tier B — interactive (13):** accordion, collapsible, tabs, toggle,
  toggle-group, switch, checkbox, radio-group, slider, sidebar, scroll-area,
  carousel, input-otp.
- **Tier C — overlay (13):** tooltip, popover, hover-card, dropdown-menu,
  context-menu, menubar, navigation-menu, dialog, alert-dialog, sheet, drawer,
  select, command.
- **Tier D — engines (5):** chart, calendar, sonner (toaster), form, resizable.

The canonical variant set is the **superset** of the original cabinet (Rust) and
landing (TS) sources — e.g. `Badge` keeps cabinet's `success` variant, `Button`
keeps landing's `icon-sm`/`icon-lg` sizes.

## Limitations

Reproducing everything dep-light means some behaviour is intentionally reduced,
especially on the Rust side (Dioxus has no renderer-agnostic portal, and layout
measuring needs host-only `web-sys`). Known gaps:

- **Theme:** single dark palette; `dark:*` utility variants are dropped.
- **Rust overlays** (dialog, popover, dropdown, select, menus, tooltip, …) render
  inline with `position:fixed` + a backdrop and CSS-only placement — no portal,
  no viewport-measured floating, native focus order (no trap). TS overlays use a
  real `Portal`, single-flip `useFloating`, `useDismissableLayer`, and
  `useFocusScope`.
- **chart:** the recharts plotting engine is not bundled. `ChartContainer` is a
  themed SVG host (emits `--color-*` from its config); `ChartTooltipContent` /
  `ChartLegendContent` are presentational and take explicit items. Draw series
  yourself inside the container.
- **calendar:** single month, single-date selection (no range/multi-month, no
  locale/dropdown features). Rust does manual date math; TS uses the built-in
  `Date`.
- **sonner:** TS exposes a global `toast()` backed by a module store with
  auto-dismiss; Rust uses a `ToasterProvider` + `use_toaster()` hook and omits
  auto-dismiss (dismiss via the close button or `.dismiss(id)`).
- **form:** react-hook-form is dropped — these are presentational + ARIA-id
  wiring; consumers own validation/state. Rust `FormControl` can't inject ids
  onto an arbitrary child (no `Slot`), so the consumer wires them.
- **resizable / carousel / drawer:** pointer-drag physics are TS-only (keyboard
  in Rust for resizable; prev/next + keyboard for carousel; click-to-dismiss for
  drawer). Embla momentum / vaul drag-to-dismiss are not reproduced.
- **sidebar:** the mobile-sheet integration, cookie persistence, and keyboard
  shortcut are omitted.

## Develop

```sh
npm i
npm run typecheck   # tsc --noEmit
npm run test        # vitest (jsdom + @testing-library)
npm run build       # tsup → dist/ (ESM + d.ts)
```

The Rust counterpart is verified from the repo root:

```sh
cargo test  -p ev --features uikit
cargo clippy -p ev --features uikit --all-targets -- -D warnings
cargo check -p ev --features "uikit wasm" --target wasm32-unknown-unknown
```
