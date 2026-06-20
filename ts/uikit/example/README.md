# @evinvest/uikit — React viewer

A tiny Vite app that renders the kit so you can **see** it in a browser — the
toaster animations (enter/exit + swipe-to-dismiss) front and centre, plus a
representative slice of the components. The Dioxus mirror of this lives in
[`rust/uikit-viewer`](../../../rust/uikit-viewer).

It consumes the kit straight from local source (`../src`) via a Vite alias, so
editing a component updates the page live — no publish or `dist` build needed.

## Run

```sh
cd ts/uikit/example
npm install
npm run dev      # vite dev server, prints a localhost URL
```

Other scripts: `npm run build` (production bundle), `npm run preview` (serve the
build), `npm run typecheck`.

## How it's wired

- `vite.config.ts` aliases `@evinvest/uikit` → `../src/index.ts` and dedupes
  React across the package boundary.
- `src/app.css` imports `tailwindcss`, `tw-animate-css` (for the overlay
  components — the toaster ships its own keyframes), and the kit's
  `styles/tokens.css`, then `@source`s `../../src` so Tailwind generates the
  classes the kit uses.

> Dev-only; not published. Lives inside the package dir but is excluded from the
> npm tarball (`files` is just `dist` + `styles`) and from the package's own
> `tsc`/`tsup`/`vitest` (all scoped to `src`/`test`).
