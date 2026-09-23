import { telHref } from "@evinvest/marketing";
import { Button, Check, cn } from "@evinvest/uikit";
import type { ReactNode } from "react";
import type { CopySlice, StatusAction, StatusCopy, StatusScreenText } from "../core/content";
import type { StatusTarget } from "../core/status";
import { LangSwitch } from "./LangSwitch";

/**
 * The 404, the 500 and the post-submit confirmation: one screen over a
 * `StatusCopy`, differing only in eyebrow, numeral, headline and buttons. A
 * visitor who hit a 404 still gets the offer — the strip is the hero's terms,
 * compressed — and the phone is always one tap away.
 *
 * Renders on either side: the error boundary is a client component, so this
 * takes the brand's name and marks as props, never the site config.
 */
export interface StatusScreenProps<L extends string, F> {
  copy: CopySlice<L, StatusScreenText<F>, F>;
  status: StatusCopy<F>;
  target: Pick<StatusTarget<L>, "phone" | "home" | "retry" | "langHrefs">;
  locales: readonly L[];
  /** The accessible name of the home link around `logo`. */
  brandName: string;
  /** The brand's lock-up, in the header. */
  logo?: ReactNode;
  /** The brand's mark, above the eyebrow. */
  mark?: ReactNode;
  className?: string;
  buttonClassName?: string;
}

export function StatusScreen<L extends string, F>(props: StatusScreenProps<L, F>) {
  const { copy, status, target, locales, brandName, logo, mark, className, buttonClassName } = props;
  const { t, f } = copy;
  const action = (a: StatusAction): { href: string; label: string } | null =>
    a === "call"
      ? target.phone
        ? { href: telHref(target.phone), label: t.callLabel(f) }
        : null
      : a === "home"
        ? { href: target.home, label: t.backHome }
        : { href: target.retry, label: t.tryAgain };
  // A brand with no phone falls back to "home" rather than a dead button.
  const primary = action(status.primary) ?? action("home");
  const secondary = action(status.secondary);
  return (
    <div className={cn("relative flex min-h-screen flex-col bg-background", className)}>
      <header className="relative flex items-center gap-5 border-b border-border px-5 py-4 md:px-12 md:py-5">
        <a href={target.home} aria-label={brandName} className="text-ink">
          {logo ?? <span className="font-display text-xl font-bold">{brandName}</span>}
        </a>
        <div className="flex-1" />
        <LangSwitch current={copy.locale} locales={locales} hrefs={target.langHrefs} className="text-sm font-medium text-ink-soft" />
        {target.phone && (
          <a href={telHref(target.phone)} className="font-display text-base font-bold text-primary-ink md:text-xl">
            {target.phone}
          </a>
        )}
      </header>
      <main className="relative flex flex-1 flex-col items-center gap-5 px-5 py-12 text-center md:gap-6 md:py-24">
        {mark}
        <p className="text-xs font-medium tracking-widest text-primary-ink">{status.eyebrow}</p>
        <p className="font-display text-8xl font-bold leading-none tracking-tight text-ink md:text-9xl">{status.code}</p>
        <h1 className="font-display text-2xl font-bold leading-snug text-ink md:text-4xl">
          {status.headline[0]}
          <span className="text-primary-ink">{status.headline[1]}</span>
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-ink-soft md:text-lg">{status.body(f)}</p>
        <div className="flex flex-col gap-3.5 sm:flex-row">
          {primary && (
            <Button href={primary.href} size="xl" className={buttonClassName}>
              {primary.label}
            </Button>
          )}
          {secondary && secondary.href !== primary?.href && (
            <Button href={secondary.href} size="xl" variant="outline" className={buttonClassName}>
              {secondary.label}
            </Button>
          )}
        </div>
        <ul className="flex flex-col items-center gap-3 text-sm sm:flex-row sm:gap-6">
          {t.statusStrip.map(term => (
            <li key={term} className="flex items-center gap-2">
              <Check />
              <span className="font-medium text-ink-soft">{term}</span>
            </li>
          ))}
        </ul>
      </main>
      <footer className="relative border-t border-border px-5 py-6 text-xs tracking-wider text-ink-soft md:px-12 md:py-7">
        <p>{t.facts(f).join(" · ").toUpperCase()}</p>
      </footer>
    </div>
  );
}
