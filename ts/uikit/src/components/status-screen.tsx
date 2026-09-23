"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { accentTextClasses, type Accent } from "../generated/accent";
import { buttonVariants, type ButtonVariant } from "./button";
import { Logo } from "./logo";

/**
 * The shared 404 / 403 / 500 status surface.
 *
 * `StatusScreen` is the generic shell; `NotFound` / `Forbidden` / `ServerError`
 * are the ready-made pages with their copy baked in — a host renders those with
 * its own hrefs. The mark is `Logo`'s, i.e. the consumer's. Links default to a
 * plain `<a>` (a full document load, which is what you want off an error page);
 * pass `linkComponent` (e.g. `next/link`) for soft navigation from a client
 * boundary.
 */
export type { Accent };

/**
 * A status CTA is a Button at the page's accent: the canonical button string for
 * that variant and rung, then the mono/uppercase treatment the error pages wear.
 *
 * Exported because a host that renders its own action into `StatusScreen`'s
 * slot — a retry button wired to Next's `reset`, say — has to be able to match
 * the CTAs beside it.
 */
export function statusCtaClass(accent: Accent, variant: ButtonVariant) {
  return cn(
    buttonVariants({ variant, size: "lg", accent }),
    "font-mono text-xs uppercase tracking-widest",
  );
}

// lucide `arrow-left`, inlined so the kit keeps its zero-icon-dep footprint.
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

export interface StatusLinkData {
  label: string;
  href: string;
  variant?: ButtonVariant;
  leadingArrow?: boolean;
}

export interface StatusScreenProps {
  accent: Accent;
  eyebrow: string;
  code: string;
  headlineLead: string;
  headlineAccent: string;
  headlineTail?: string;
  subtext: string;
  links?: StatusLinkData[];
  /** Leading action slot, rendered before `links` (e.g. the 500 client retry). */
  children?: React.ReactNode;
  /** CTA element — `next/link` for soft nav; defaults to `<a>` (full load). */
  linkComponent?: React.ElementType;
}

/**
 * Shared skeleton for the 404 / 403 / 500 status pages: a centred hero with the
 * logo mark, a mono eyebrow, a giant Playfair code, a headline whose final clause
 * is an italic accent, supporting copy, and the CTAs. The accent threads through
 * all four marks. Actions render inline (from `links` data, plus an optional
 * `children` slot) — never passed as a JSX prop through a server boundary.
 */
export function StatusScreen({
  accent,
  eyebrow,
  code,
  headlineLead,
  headlineAccent,
  headlineTail = ".",
  subtext,
  links,
  children,
  linkComponent,
}: StatusScreenProps) {
  const L = linkComponent ?? "a";
  const accentText = accentTextClasses[accent];
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-32 text-center">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 opacity-[0.07] [background:radial-gradient(55%_45%_at_50%_30%,currentColor,transparent_70%)]",
          accentText,
        )}
      />
      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center">
        <Logo className={cn("mb-7 h-10 w-auto", accentText)} />
        <p className={cn("mb-6 font-mono text-[11px] uppercase tracking-[0.34em]", accentText)}>{eyebrow}</p>
        <p className={cn("font-serif text-[110px] font-medium leading-[0.9] sm:text-[180px]", accentText)}>{code}</p>
        <h1 className="mt-4 font-serif text-3xl font-light leading-tight text-ink sm:text-5xl">
          {headlineLead}
          <span className={cn("font-serif italic", accentText)}>{headlineAccent}</span>
          {headlineTail}
        </h1>
        <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-ink/60 sm:text-base">{subtext}</p>
        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          {children}
          {links?.map((link) => (
            <L key={link.label} href={link.href} className={statusCtaClass(accent, link.variant ?? "primary")}>
              {link.leadingArrow ? <ArrowLeftIcon className="mr-2 h-4 w-4" /> : null}
              {link.label}
            </L>
          ))}
        </div>
      </div>
    </section>
  );
}

export interface StatusPageProps {
  /** CTA element — `next/link` for soft nav; defaults to `<a>` (full load). */
  linkComponent?: React.ElementType;
  /** "Back to home" target — `/` for the landing, `/cabinet` for the cabinet. */
  homeHref?: string;
  /** Secondary CTA target (contact / request access). */
  contactHref?: string;
}

/** 404 — page not found. */
export function NotFound({ linkComponent = "a", homeHref = "/", contactHref = "/contact" }: StatusPageProps) {
  return (
    <StatusScreen
      accent="debug"
      eyebrow="Page not found"
      code="404"
      headlineLead="You've reached "
      headlineAccent="open water"
      subtext="The page you're looking for has drifted off our coastline — moved, renamed, or never charted. Let's get you back to shore."
      linkComponent={linkComponent}
      links={[
        { label: "Back to home", href: homeHref, leadingArrow: true },
        { label: "Contact the team", href: contactHref, variant: "outline" },
      ]}
    />
  );
}

/** 403 — access forbidden. */
export function Forbidden({ linkComponent = "a", homeHref = "/", contactHref = "/contact" }: StatusPageProps) {
  return (
    <StatusScreen
      accent="warn"
      eyebrow="Access forbidden"
      code="403"
      headlineLead="This harbour is "
      headlineAccent="private"
      subtext="You don't have the credentials to view this page. If you believe you should, our team can open the right doors."
      linkComponent={linkComponent}
      links={[
        { label: "Back to home", href: homeHref, leadingArrow: true },
        { label: "Request access", href: contactHref, variant: "outline" },
      ]}
    />
  );
}

export interface ServerErrorProps {
  /** CTA element — `next/link` for soft nav; defaults to `<a>` (full load). */
  linkComponent?: React.ElementType;
  /** "Back to home" target — `/` for the landing, `/cabinet` for the cabinet. */
  homeHref?: string;
  /** Retry handler (e.g. Next's error-boundary `reset`); falls back to a reload. */
  reset?: () => void;
}

/** 500 — server error. The "Try again" button runs `reset` or reloads the page. */
export function ServerError({ linkComponent = "a", homeHref = "/", reset }: ServerErrorProps) {
  return (
    <StatusScreen
      accent="error"
      eyebrow="Server error"
      code="500"
      headlineLead="Our systems are "
      headlineAccent="recalibrating"
      subtext="Something broke on our end — not yours. We've been alerted and are restoring service. Please try again in a moment."
      linkComponent={linkComponent}
      links={[{ label: "Back to home", href: homeHref, variant: "outline", leadingArrow: true }]}
    >
      <button
        type="button"
        className={statusCtaClass("error", "primary")}
        onClick={() => (reset ? reset() : window.location.reload())}
      >
        Try again
      </button>
    </StatusScreen>
  );
}
