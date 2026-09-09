import * as React from "react";
import { cn } from "../lib/cn";
import {
  CHECK,
  DISPLAY_BASE,
  EYEBROW,
  LEDE,
  PROSE,
  polarityClasses,
  SECTION_BASE,
  SECTION_HEAD,
  SECTION_PY,
  SECTION_PY_TIGHT,
  STAT,
  STAT_FIGURE,
  STAT_LABEL,
  surfaceClasses,
  type Polarity,
  type Surface,
} from "../generated/band";

export type { Polarity, Surface };

/**
 * Full-bleed page bands and the type vocabulary that goes in them. A page built
 * from these writes no spacing or type-scale class of its own: the rhythm is
 * `--band-py`, the gutter `--page-px` and the headline scale `--display-scale`,
 * so a global retune is one edit in the consumer's tokens.
 */
export interface SectionProps extends React.ComponentProps<"section"> {
  polarity?: Polarity;
  surface?: Surface;
  tight?: boolean;
}

/**
 * `polarity` sets the token scope on the element, so everything inside reads
 * `text-ink` / `border-border` / `text-ink-soft` and resolves correctly on
 * either side. `tight` is the shorter vertical rhythm.
 */
export function Section({
  polarity = "light",
  surface = "background",
  tight = false,
  className,
  ...props
}: SectionProps) {
  return (
    <section
      data-slot="section"
      className={cn(
        // conflict-free by construction — a gutter, a scope class, a plane and a
        // rhythm — so only the caller override is worth a merge
        `${SECTION_BASE} ${polarityClasses[polarity]} ${surfaceClasses[surface]} ${
          tight ? SECTION_PY_TIGHT : SECTION_PY
        }`,
        className,
      )}
      {...props}
    />
  );
}

/** The label above a headline, in the interactive role's colour. */
export function Eyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="eyebrow" className={cn(EYEBROW, className)} {...props} />;
}

/** The headline. One scale for every band on the site, so a retune is one number. */
export function Display({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 data-slot="display" className={cn(DISPLAY_BASE, className)} {...props} />;
}

export interface SectionHeadProps extends Omit<React.ComponentProps<"div">, "title"> {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  lede?: React.ReactNode;
}

/** Eyebrow → headline → lede, the head a band shares. */
export function SectionHead({ eyebrow, title, lede, className, ...props }: SectionHeadProps) {
  return (
    <div data-slot="section-head" className={cn(SECTION_HEAD, className)} {...props}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Display>{title}</Display>
      {lede && <p className={LEDE}>{lede}</p>}
    </div>
  );
}

/** Body copy at the reading measure. */
export function Prose({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="prose" className={cn(PROSE, className)} {...props} />;
}

export interface StatProps extends React.ComponentProps<"span"> {
  figure: React.ReactNode;
  label: React.ReactNode;
}

/** A figure with its label beside it. */
export function Stat({ figure, label, className, ...props }: StatProps) {
  return (
    <span data-slot="stat" className={cn(STAT, className)} {...props}>
      <span className={STAT_FIGURE}>{figure}</span>
      <span className={STAT_LABEL}>{label}</span>
    </span>
  );
}

/**
 * The affirmative tick. Positive is a valence, not a significance rung — see the
 * kit's `docs/spec/accents.md`.
 */
export function Check({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span data-slot="check" aria-hidden className={cn(CHECK, className)} {...props}>
      ✓
    </span>
  );
}
