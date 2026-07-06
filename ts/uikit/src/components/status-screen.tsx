import * as React from "react";
import { cn } from "../lib/cn";

/**
 * The shared 404 / 403 / 500 status surface, ported from site_conductor so every
 * EV app (landing, cabinet) shows the same branded error pages.
 *
 * `StatusScreen` is the generic shell; `NotFound` / `Forbidden` / `ServerError`
 * are the ready-made pages with their copy baked in — a host renders those with
 * its own hrefs. Links default to a plain `<a>` (a full document load, which is
 * what you want off an error page); pass `linkComponent` (e.g. `next/link`) for
 * soft navigation from a client boundary.
 */
export type StatusAccent = "teal" | "gold" | "red" | "blue";

// Accent → token text colour. Bound to ev/color tokens; "blue" is the blueprint
// accent the design specifies as a raw value (no token equivalent).
const ACCENT_TEXT: Record<StatusAccent, string> = {
  teal: "text-main-accent-t1",
  gold: "text-main-accent-t3",
  red: "text-destructive",
  blue: "text-[#5e9be6]",
};

const BTN_BASE =
  "inline-flex items-center justify-center rounded-md px-6 py-3.5 font-mono-tech text-xs uppercase tracking-widest transition-colors";

const BTN_FILLED: Record<StatusAccent, string> = {
  teal: "bg-main-accent-t1 text-main-black hover:bg-main-accent-t1/90",
  gold: "bg-main-accent-t3 text-main-black hover:bg-main-accent-t3/90",
  red: "bg-destructive text-white hover:bg-destructive/90",
  blue: "bg-[#5e9be6] text-main-black hover:bg-[#5e9be6]/90",
};

const BTN_OUTLINE: Record<StatusAccent, string> = {
  teal: "border border-main-accent-t1/40 text-main-accent-t1 hover:bg-main-accent-t1/10",
  gold: "border border-main-accent-t3/40 text-main-accent-t3 hover:bg-main-accent-t3/10",
  red: "border border-destructive/40 text-destructive hover:bg-destructive/10",
  blue: "border border-[#5e9be6]/40 text-[#5e9be6] hover:bg-[#5e9be6]/10",
};

/** Class for a status CTA — shared by the nav links and the 500 retry button. */
export function statusButtonClass(accent: StatusAccent, variant: "filled" | "outline") {
  return cn(BTN_BASE, variant === "filled" ? BTN_FILLED[accent] : BTN_OUTLINE[accent]);
}

// The EV skyline crown — the rooftop silhouette of the brand logo (Figma uikit
// node 17:3, wordmark omitted), filled with `currentColor` so it takes the accent.
function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 48" className={className} aria-hidden>
      <g fill="currentColor">
        <path d="M0.0437012 47.3326L50.9499 40.5805V22.3378L56.4881 23.6408V37.9071L59.1984 37.5005V24.1147L64.6189 25.1808V37.0269L67.2113 36.553V22.1009L56.606 17.481L43.408 21.864V36.553L0.0437012 47.3326Z" />
        <path d="M77.2277 40.5804L85.9478 41.4099L85.8299 0.304321L73.1033 7.17499V26.3654L77.2277 28.2608V40.5804Z" />
        <path d="M87.126 0.304321L99.9705 7.29343V42.5943L94.3141 41.8835V9.54417L87.126 5.75347V0.304321Z" />
        <path d="M103.034 42.9496L139.682 46.0296L110.104 39.7513V26.8393L103.034 23.0486V42.9496Z" />
      </g>
    </svg>
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
  variant?: "filled" | "outline";
  leadingArrow?: boolean;
}

export interface StatusScreenProps {
  accent: StatusAccent;
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
  const accentText = ACCENT_TEXT[accent];
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-main-black px-6 py-32 text-center">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 opacity-[0.07] [background:radial-gradient(55%_45%_at_50%_30%,currentColor,transparent_70%)]",
          accentText,
        )}
      />
      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center">
        <LogoMark className={cn("mb-7 h-10 w-auto", accentText)} />
        <p className={cn("mb-6 font-mono-tech text-[11px] uppercase tracking-[0.34em]", accentText)}>{eyebrow}</p>
        <p className={cn("font-serif-display text-[110px] font-medium leading-[0.9] sm:text-[180px]", accentText)}>{code}</p>
        <h1 className="mt-4 font-serif-display text-3xl font-light leading-tight text-white sm:text-5xl">
          {headlineLead}
          <span className={cn("font-serif italic", accentText)}>{headlineAccent}</span>
          {headlineTail}
        </h1>
        <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-main-mist/60 sm:text-base">{subtext}</p>
        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          {children}
          {links?.map((link) => (
            <L key={link.label} href={link.href} className={statusButtonClass(accent, link.variant ?? "filled")}>
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
      accent="teal"
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
      accent="gold"
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
      accent="red"
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
        className={statusButtonClass("red", "filled")}
        onClick={() => (reset ? reset() : window.location.reload())}
      >
        Try again
      </button>
    </StatusScreen>
  );
}
