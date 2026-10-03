import * as React from "react";
import { cn } from "../lib/cn";
import type { ShellBreakpoint } from "./app-shell";

export type SectionLabelTone = "muted" | "accent";

export interface SectionLabelProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  /** `muted` labels a group or a section; `accent` announces a hero figure. */
  tone?: SectionLabelTone;
}

/** The tracked-uppercase label above a figure, a group or a section. */
export function SectionLabel({ as: Comp = "p", tone = "muted", className, ...props }: SectionLabelProps) {
  return (
    <Comp
      data-slot="section-label"
      className={cn(
        "text-xs font-semibold uppercase tracking-widest",
        tone === "accent" ? "text-primary-ink" : "text-ink-soft",
        className,
      )}
      {...props}
    />
  );
}

export interface PageHeadingProps extends Omit<React.ComponentProps<"header">, "title"> {
  title: React.ReactNode;
  /** What the screen is for, in a sentence. */
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  /** The screen's own controls, on the right. */
  actions?: React.ReactNode;
}

/** The title row: eyebrow → title → description on the left, actions on the right. */
export function PageHeading({ title, description, eyebrow, actions, className, ...props }: PageHeadingProps) {
  return (
    <header
      data-slot="page-heading"
      className={cn("flex items-center justify-between gap-4", className)}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow !== undefined && <SectionLabel tone="accent">{eyebrow}</SectionLabel>}
        <h1 className="text-2xl font-semibold leading-tight text-ink">{title}</h1>
        {description !== undefined && <p className="text-sm text-ink-soft">{description}</p>}
      </div>
      {actions !== undefined && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
    </header>
  );
}

export type PageFrameWidth = "full" | "content";

export interface PageFrameProps extends Omit<React.ComponentProps<"div">, "title"> {
  /** Omit when the screen's heading is its own composition. */
  title?: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  /**
   * The bar titling the screen on a phone (`MobileAppBar`). With one, the heading
   * shows from `breakpoint` up only and the sections arrive a step after the bar.
   */
  appBar?: React.ReactNode;
  /** Default `lg`. */
  breakpoint?: ShellBreakpoint;
  /** `full` fills the column (the rail already bounds it); `content` caps it at a reading measure. */
  width?: PageFrameWidth;
  headingClassName?: string;
}

const HEADING_FROM = { md: "hidden md:flex", lg: "hidden lg:flex" } as const;
const PAD = {
  md: "gap-4 px-4 pb-6 pt-5 md:gap-6 md:px-8 md:pb-7 md:pt-6",
  lg: "gap-4 px-4 pb-6 pt-5 lg:gap-6 lg:px-8 lg:pb-7 lg:pt-6",
} as const;

/**
 * The frame every screen sits in: one inset, one section rhythm, one title scale,
 * so moving between screens never reads as moving between products.
 *
 * Its sections arrive in sequence by CSS alone (`data-enter="stagger"`, see
 * motion.css): every direct child fades and rises `--ev-rise`, one
 * `--ev-stagger-section` after the previous, the heading first. Server-safe —
 * no motion library, no hydration needed for the entrance.
 */
export function PageFrame({
  title,
  description,
  eyebrow,
  actions,
  appBar,
  breakpoint = "lg",
  width = "full",
  headingClassName,
  className,
  style,
  children,
  ...props
}: PageFrameProps) {
  const hasBar = appBar !== undefined && appBar !== null && appBar !== false;
  const enter = {
    "--enter-step": "var(--ev-stagger-section, 50ms)",
    ...(hasBar ? { "--enter-delay": "var(--ev-stagger-section, 50ms)" } : {}),
  };
  return (
    <>
      {appBar}
      <div
        data-slot="page-frame"
        data-enter="stagger"
        className={cn("flex flex-col", PAD[breakpoint], width === "content" && "max-w-5xl", className)}
        style={{ ...enter, ...style }}
        {...props}
      >
        {title !== undefined && (
          <PageHeading
            title={title}
            description={description}
            eyebrow={eyebrow}
            actions={actions}
            className={cn(hasBar && HEADING_FROM[breakpoint], headingClassName)}
          />
        )}
        {children}
      </div>
    </>
  );
}
