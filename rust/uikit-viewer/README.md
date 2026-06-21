# ev_lib::uikit — Dioxus viewer

The Dioxus → wasm mirror of [`ts/uikit/example`](../../ts/uikit/example): the
same gallery (toaster animations front and centre, plus a representative slice of
components), rendered by `ev_lib::uikit` instead of `@evinvest/uikit`. Use the two
side by side to confirm a component looks and behaves the same in both ports.

It's a **wasm-only** workspace member: the `dioxus`/`ev_lib` deps and the gallery
compile only for `wasm32`, so a native `cargo build` (and the repo's
`cargo … -p ev_lib` commands) see only a stub `main` and are unaffected.

## Run

Prerequisites: the [Dioxus CLI](https://dioxuslabs.com/learn/0.7/getting_started/)
(`cargo install dioxus-cli` — pin to the `0.7` line) and Node (already in the nix
devshell).

```sh
cd rust/uikit-viewer
npm install          # Tailwind CLI
npm run css          # generate assets/tailwind.css from the kit's Rust sources
dx serve             # build wasm + serve; prints a localhost URL
```

While iterating, run `npm run css:watch` in one terminal and `dx serve` in
another so Tailwind regenerates as you edit class strings.

## How it's wired

- `input.css` imports `tailwindcss` + the kit's `tokens.css`, then `@source`s the
  kit's Rust sources (`../src/uikit`) and this viewer's `src` so Tailwind scans
  the class-string literals and generates the utilities. `npm run css` writes
  `assets/tailwind.css` (gitignored), which `src/viewer.rs` links via `asset!`.
- The toaster **stacks** like the React one (collapsed pile → spreads on
  hover/focus), animates enter/exit, and **auto-dismisses** (pausing on
  hover/focus) — all host-timer-free, the auto-dismiss riding a CSS "life"
  animation. Heights can't be measured here, so the stack assumes a constant
  height (collapse exact, expansion uniform). Persist a toast with
  `use_toaster().show(msg, variant, None)`; swipe-to-dismiss is React-only.

> Generate the CSS before `dx serve` or a wasm `cargo check` — `asset!` needs
> `assets/tailwind.css` to exist. Native builds don't (the gallery is wasm-gated).
