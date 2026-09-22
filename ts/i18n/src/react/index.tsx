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
 *
 * The named exports are bound to the generated registry; {@link createI18nReact}
 * binds the same trio to a registry of your own.
 */
import {
  createContext,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode,
} from "react";

import {
  defaultLocaleRegistry,
  type Locale,
  type LocaleRegistry,
  type Messages,
  type Translate,
} from "../index";

/** Props for {@link I18nProvider}. */
export interface I18nProviderProps<L extends string = Locale> {
  /** The active locale, from the `[locale]` route segment. */
  locale: L;
  /** The catalogue for `locale`, loaded on the server and serialised in. */
  messages: Messages;
  /** Fired for a key the catalogue has never heard of — wire to Sentry in production. */
  onMissing?: (key: string, locale: L) => void;
  children: ReactNode;
}

/** The provider and hooks for one registry. */
export interface I18nReact<L extends string> {
  readonly I18nProvider: (props: I18nProviderProps<L>) => ReactElement;
  readonly useLocale: () => L;
  readonly useT: () => Translate;
}

/**
 * Bind the provider and hooks to a registry built with `createLocaleRegistry`.
 * Call it once at module scope in a `"use client"` file and re-export the
 * result: each call owns its own context, so a provider from one call is
 * invisible to hooks from another.
 *
 * @example
 * ```tsx
 * "use client";
 * export const { I18nProvider, useLocale, useT } = createI18nReact(i18n);
 * ```
 */
export function createI18nReact<L extends string>(registry: LocaleRegistry<L>): I18nReact<L> {
  type Value = { locale: L; t: Translate };
  const I18nContext = createContext<Value | null>(null);

  function I18nProvider({ locale, messages, onMissing, children }: I18nProviderProps<L>) {
    const value = useMemo<Value>(
      () => ({ locale, t: registry.translator(messages, locale, onMissing) }),
      [locale, messages, onMissing],
    );
    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
  }

  function useI18n(hook: string): Value {
    const value = useContext(I18nContext);
    if (value === null) {
      // A wiring bug, not a content gap: without a provider the locale itself is
      // unknown, so there is nothing sensible to degrade to. Fail loudly and
      // immediately rather than silently rendering one locale inside another.
      // Names the registry because a provider from another createI18nReact()
      // call is invisible here, and that is the non-obvious way to hit this.
      throw new Error(
        `${hook}() requires an <I18nProvider> above it from the same registry ` +
          `(locales [${registry.locales.join(", ")}], default "${registry.defaultLocale}"). ` +
          `Server Components should call translator() from @evinvest/i18n instead — ` +
          `or registry.translator() for a registry built with createLocaleRegistry.`,
      );
    }
    return value;
  }

  const useLocale = (): L => useI18n("useLocale").locale;
  const useT = (): Translate => useI18n("useT").t;

  return { I18nProvider, useLocale, useT };
}

const bound: I18nReact<Locale> = createI18nReact(defaultLocaleRegistry);

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
export const I18nProvider: (props: I18nProviderProps) => ReactElement = bound.I18nProvider;

/**
 * The active locale inside a client island.
 *
 * @returns The locale supplied by the nearest {@link I18nProvider}.
 * @throws If no provider is mounted above.
 */
export const useLocale: () => Locale = bound.useLocale;

/**
 * The translate function for the active locale and catalogue.
 *
 * @returns A {@link Translate}.
 * @throws If no provider is mounted above.
 *
 * @example
 * ```tsx
 * const t = useT();
 * return <button>{t("wallet.deposit.cta", "Deposit")}</button>;
 * ```
 */
export const useT: () => Translate = bound.useT;
