import { cn } from "@evinvest/uikit";

/**
 * `FR · EN`, each linking to the same page in that language. The `?lang=` is
 * what mints the cookie in the proxy, so the choice survives the next bare
 * visit and the negotiator stops fighting the visitor — with no JavaScript.
 * A screen reader hears each language's own name, not its code.
 */
export interface LangSwitchProps<L extends string> {
  current: L;
  /** Switcher order: the registry's `locales`. */
  locales: readonly L[];
  /** The page's URL in each language, before `?lang=` is added; may carry a query or `#`. */
  hrefs: Readonly<Record<L, string>>;
  /** Each language's name in itself — the registry's `labels`. Codes when absent. */
  labels?: Readonly<Record<L, string>>;
  /** The navigation's accessible name. */
  label?: string;
  className?: string;
}

/**
 * `href` with `lang=<locale>` set, keeping its query and fragment — and its
 * origin when it has one: a place's page in path mode links to another host.
 */
export function withLang(href: string, locale: string): string {
  const url = new URL(href, "https://x.invalid");
  url.searchParams.set("lang", locale);
  const rest = `${url.pathname}${url.search}${url.hash}`;
  if (href.startsWith("//")) return `//${url.host}${rest}`;
  return /^[a-z][a-z0-9+.-]*:/i.test(href) ? `${url.origin}${rest}` : rest;
}

// A hit area around each code, centred on it by a pseudo-element so the visual
// size and the focus ring stay the link's own: 44 px tall (Apple's HIG), and
// 6 px wider on each side — about half the gap-dot-gap between codes, so
// neighbours never overlap and a tap always lands on the code it is nearest to.
// That still clears WCAG 2.5.8's 24 px; a full 44 px width would need wider
// spacing between the codes.
const HIT_AREA = "relative after:absolute after:top-1/2 after:left-1/2 after:h-full after:min-h-11 after:w-[calc(100%+0.75rem)] after:-translate-x-1/2 after:-translate-y-1/2";

export function LangSwitch<L extends string>({ current, locales, hrefs, labels, label = "Language", className }: LangSwitchProps<L>) {
  return (
    <nav aria-label={label} className={cn("flex items-center gap-1.5", className)}>
      {locales.map((locale, i) => (
        <span key={locale} className="flex items-center gap-1.5">
          {i > 0 && (
            <span aria-hidden="true" className="opacity-40">
              ·
            </span>
          )}
          <a
            href={withLang(hrefs[locale], locale)}
            hrefLang={locale}
            lang={locale}
            aria-label={labels?.[locale]}
            aria-current={locale === current ? "true" : undefined}
            className={cn(HIT_AREA, locale === current ? "font-semibold" : "opacity-60 hover:opacity-100")}
          >
            {locale.toUpperCase()}
          </a>
        </span>
      ))}
    </nav>
  );
}
