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
 * binds the same set to a registry of your own.
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
  /**
   * What else to do about such a key, as plain data a Server Component layout
   * can pass (it cannot pass `onMissing`). Unset, the call site's English
   * renders and only `onMissing` hears of it.
   *
   * - `"warn"` — `console.warn` once per key, then render the English.
   * - `"throw"` — throw from the render, for a test or e2e run that must fail
   *   on a key a sliced catalogue dropped.
   *
   * Never fires for the default locale, which reads no catalogue. A key the
   * policy rejected or nobody translated is absent too, so `"throw"` also
   * fails on those: use it against a fully translated catalogue.
   */
  missing?: MissingMode;
  children: ReactNode;
}

/** See {@link I18nProviderProps.missing}. */
export type MissingMode = "warn" | "throw";

/** `onMissing` with {@link MissingMode} folded in; `undefined` when there is nothing to do. */
function reporter<L extends string>(
  mode: MissingMode | undefined,
  onMissing: ((key: string, locale: L) => void) | undefined,
): ((key: string, locale: L) => void) | undefined {
  if (mode === undefined) return onMissing;
  // Per provider rather than per module: a key warned about under one tree is
  // still news under another, and a re-render must not repeat it.
  const warned = new Set<string>();
  return (key, locale) => {
    onMissing?.(key, locale);
    const message = `@evinvest/i18n: "${key}" is not in the ${locale} catalogue this tree was given`;
    if (mode === "throw") {
      throw new Error(
        `${message}. If the catalogue is sliced, regenerate the slices (evinvest-i18n-slices) ` +
          `or check that the page wraps its tree in <I18nScope>.`,
      );
    }
    const id = `${locale}:${key}`;
    if (warned.has(id)) return;
    warned.add(id);
    console.warn(`${message}; rendering the English.`);
  };
}

/** Props for {@link I18nScope}. Plain data, so a Server Component can render it. */
export interface I18nScopeProps {
  /**
   * More keys for the subtree, laid over the enclosing catalogue — a route's
   * slice of a catalogue whose shell the provider already carries. A key in
   * both reads from this one.
   */
  messages: Messages;
  children: ReactNode;
}

/** The provider, the scope and the hooks for one registry. */
export interface I18nReact<L extends string> {
  readonly I18nProvider: (props: I18nProviderProps<L>) => ReactElement;
  readonly I18nScope: (props: I18nScopeProps) => ReactElement;
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
  type Report = (key: string, locale: L) => void;
  // `messages` and `report` ride along so a nested scope can rebuild `t` over a
  // wider catalogue without being handed either again.
  type Value = { locale: L; messages: Messages; report: Report | undefined; t: Translate };
  const I18nContext = createContext<Value | null>(null);

  function I18nProvider({ locale, messages, onMissing, missing, children }: I18nProviderProps<L>) {
    const report = useMemo(() => reporter(missing, onMissing), [missing, onMissing]);
    const value = useMemo<Value>(
      () => ({ locale, messages, report, t: registry.translator(messages, locale, report) }),
      [locale, messages, report],
    );
    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
  }

  function I18nScope({ messages, children }: I18nScopeProps) {
    const parent = useContext(I18nContext);
    const value = useMemo<Value | null>(() => {
      if (parent === null) return null;
      // The default locale never reads its catalogue, so a wider one changes nothing.
      if (parent.locale === registry.defaultLocale) return parent;
      const merged: Messages = { ...parent.messages, ...messages };
      return {
        locale: parent.locale,
        messages: merged,
        report: parent.report,
        t: registry.translator(merged, parent.locale, parent.report),
      };
    }, [parent, messages]);
    if (value === null) {
      // A scope only widens a catalogue; the locale is the provider's to decide,
      // and guessing it here would render one language inside another.
      throw new Error(
        `<I18nScope> requires an <I18nProvider> above it from the same registry ` +
          `(locales [${registry.locales.join(", ")}], default "${registry.defaultLocale}"). ` +
          `It adds keys to the provider's catalogue and takes the locale from it.`,
      );
    }
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

  return { I18nProvider, I18nScope, useLocale, useT };
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
 * Widens the enclosing provider's catalogue for the subtree beneath it: its
 * `messages` are laid over the provider's (`{ ...parent, ...own }`), and the
 * locale and the missing-key handling are inherited.
 *
 * This is what lets a layout ship only the keys its own chrome renders and each
 * page add its own: the provider carries the shell, the page's scope carries the
 * route (see `pickMessages` and `evinvest-i18n-slices`). Scopes nest; the
 * nearest one wins a key both carry.
 *
 * @throws If no {@link I18nProvider} is mounted above.
 *
 * @example
 * ```tsx
 * // app/[locale]/wallet/page.tsx  (Server Component)
 * <I18nScope messages={pickMessages(messagesFor(locale), slices.routes[ROUTE])}>
 *   <WalletIsland />
 * </I18nScope>
 * ```
 */
export const I18nScope: (props: I18nScopeProps) => ReactElement = bound.I18nScope;

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
