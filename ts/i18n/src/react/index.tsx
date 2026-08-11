/**
 * @module @evinvest/i18n/react
 *
 * React bindings — a provider and two hooks, for **client islands only**.
 *
 * Server Components need nothing from this file: they call `translator()` from
 * the core directly, since the locale is already in their props (it comes off
 * the `[locale]` route segment) and there is no re-render to memoise against.
 * Both consuming apps mandate Server Components by default with `"use client"`
 * pushed to the smallest leaf, so reaching for this provider is the exception —
 * an island that genuinely needs to translate inside interactive state.
 *
 * The whole subpath carries the `"use client"` banner, which is exactly why the
 * core stays separate: importing the registry or `localePath` from a Server
 * Component must not drag a client boundary along with it.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";

import {
  translator,
  type Locale,
  type Messages,
  type Translate,
} from "../index";

type I18nContextValue = {
  locale: Locale;
  t: Translate;
};

const I18nContext = createContext<I18nContextValue | null>(null);

/** Props for {@link I18nProvider}. */
export interface I18nProviderProps {
  /** The active locale, from the `[locale]` route segment. */
  locale: Locale;
  /** The catalogue for `locale`, loaded on the server and serialised in. */
  messages: Messages;
  /** Fired on a missing key — wire to Sentry in production. */
  onMissing?: (key: string, locale: Locale) => void;
  children: ReactNode;
}

/**
 * Supplies locale and catalogue to client islands beneath it.
 *
 * Mount it as high as the *client* tree goes — typically wrapping the interactive
 * subtree inside a Server layout, not the whole document. Passing the catalogue
 * as a prop means it is serialised into the RSC payload once, so keep per-route
 * catalogues narrow rather than shipping every namespace to every page.
 *
 * @example
 * ```tsx
 * // app/[locale]/layout.tsx  (Server Component)
 * <I18nProvider locale={locale} messages={await load(locale, "wallet")}>
 *   <WalletIsland />
 * </I18nProvider>
 * ```
 */
export function I18nProvider({
  locale,
  messages,
  onMissing,
  children,
}: I18nProviderProps) {
  const value = useMemo<I18nContextValue>(
    () => ({ locale, t: translator(messages, locale, onMissing) }),
    [locale, messages, onMissing],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n(hook: string): I18nContextValue {
  const value = useContext(I18nContext);
  if (value === null) {
    // A wiring bug, not a content gap: without a provider the locale itself is
    // unknown, so there is nothing sensible to degrade to. Fail loudly and
    // immediately rather than silently rendering one locale inside another.
    throw new Error(
      `${hook}() requires an <I18nProvider> above it. Server Components should call translator() from @evinvest/i18n instead.`,
    );
  }
  return value;
}

/**
 * The active locale inside a client island.
 *
 * @returns The locale supplied by the nearest {@link I18nProvider}.
 * @throws If no provider is mounted above.
 */
export function useLocale(): Locale {
  return useI18n("useLocale").locale;
}

/**
 * The translate function for the active locale and catalogue.
 *
 * @returns A {@link Translate}.
 * @throws If no provider is mounted above.
 *
 * @example
 * ```tsx
 * const t = useT();
 * return <button>{t("wallet.deposit.cta")}</button>;
 * ```
 */
export function useT(): Translate {
  return useI18n("useT").t;
}
