import { cn } from "@evinvest/uikit";

/**
 * `FR · EN`, each linking to the same page in that language. The `?lang=` is
 * what mints the cookie in the proxy, so the choice survives the next bare
 * visit and the negotiator stops fighting the visitor — with no JavaScript.
 */
export interface LangSwitchProps<L extends string> {
  current: L;
  /** Switcher order: the registry's `locales`. */
  locales: readonly L[];
  /** The page's URL in each language, before `?lang=` is added. */
  hrefs: Readonly<Record<L, string>>;
  className?: string;
}

export function LangSwitch<L extends string>({ current, locales, hrefs, className }: LangSwitchProps<L>) {
  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      {locales.map((locale, i) => (
        <span key={locale} className="flex items-center gap-1.5">
          {i > 0 && <span className="opacity-40">·</span>}
          <a
            href={`${hrefs[locale]}?lang=${locale}`}
            hrefLang={locale}
            lang={locale}
            aria-current={locale === current ? "true" : undefined}
            className={locale === current ? "font-semibold" : "opacity-60 hover:opacity-100"}
          >
            {locale.toUpperCase()}
          </a>
        </span>
      ))}
    </span>
  );
}
