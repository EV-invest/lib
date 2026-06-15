/**
 * `@ev/uikit` — EV-invest's dep-light React UI kit.
 *
 * shadcn-semantics components with **no** `@radix-ui/*` and **no** `cva`: variant
 * maps are plain objects fused with {@link cn} (`clsx` + `tailwind-merge`), and
 * overlay behaviour (portals, floating, focus traps) is hand-rolled in
 * `./primitives`. The package mirrors the `ev::uikit` Rust feature semantically.
 *
 * Styling depends on the design tokens in `@ev/uikit/styles/tokens.css` — a
 * consumer must `@import` that file into its Tailwind v4 entrypoint.
 */

export { cn } from "./lib/cn";
export { Slot } from "./primitives/slot";
export type { SlotProps } from "./primitives/slot";
