import { createElement, type HTMLAttributes } from "react";
import { cn, Slot } from "@evinvest/uikit";

// Document typography — the long-form, markdown-like scale (legal pages,
// articles, service descriptions), so rendered prose reads as the site's own
// without per-element styling. Token classes only: the fonts and colours come
// from the consumer's uikit theme (`--font-display`, `ink`, `primary-ink`), so
// one brand's serif and another's sans are a token swap, not a fork.

type Tag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p";

export interface TypographyProps extends HTMLAttributes<HTMLElement> {
  /** Style a child node instead (a link, a custom element) — see uikit `Slot`. */
  asChild?: boolean;
}

function make(tag: Tag, base: string) {
  function Component({ className, asChild = false, ...props }: TypographyProps) {
    const merged = { "data-slot": tag, className: cn(base, className), ...props };
    return asChild ? <Slot {...merged} /> : createElement(tag, merged);
  }
  Component.displayName = tag.toUpperCase();
  return Component;
}

export const H1 = make(
  "h1",
  "font-display font-bold text-ink text-4xl sm:text-5xl tracking-tight leading-tight mb-6",
);
export const H2 = make(
  "h2",
  "font-display font-bold text-ink text-3xl sm:text-4xl tracking-tight leading-tight mt-12 mb-5",
);
export const H3 = make(
  "h3",
  "font-display text-ink text-2xl sm:text-3xl leading-snug mt-10 mb-4",
);
export const H4 = make(
  "h4",
  "font-display text-ink text-xl sm:text-2xl leading-snug mt-8 mb-3",
);
export const H5 = make("h5", "font-sans font-semibold text-ink text-lg leading-snug mt-6 mb-2");
// h6 reads as an eyebrow/caption — the recurring small uppercase label.
export const H6 = make(
  "h6",
  "font-mono text-primary-ink text-xs uppercase tracking-widest mt-6 mb-2",
);
export const P = make(
  "p",
  "font-sans leading-relaxed text-ink-mid text-sm sm:text-base [&:not(:first-child)]:mt-4",
);
