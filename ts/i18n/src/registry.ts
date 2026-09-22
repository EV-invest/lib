/**
 * `createLocaleRegistry` — the locale set, the URL contract, negotiation and the
 * translator, bound to one list of locales.
 *
 * The core's free functions (`localePath`, `splitLocalePath`, …) are this
 * factory applied to the generated five-locale set, so a surface with its own
 * languages — a French storefront that is `fr` by default, say — gets the exact
 * same behaviour over its own list instead of a hand-rolled copy that drifts.
 *
 * Zero-dep and DOM-free, like the rest of the core.
 */
import { formatPattern, type MessageValues } from "./format";

/**
 * A loaded catalogue: flat `key → pattern`. Flat rather than nested because the
 * drift checker diffs, hashes, and reports per fully-qualified key, and a nested
 * shape would make every one of those operations a tree walk for no gain at the
 * call site (`t("hero.title")` reads the same either way).
 */
export type Messages = Readonly<Record<string, string>>;

/**
 * Renders one string: `en` is the source-language copy as authored at this call
 * site, `key` is what a translated catalogue files it under.
 *
 * ```ts
 * t("hero.title", "Invest in the China+1 narrative")
 * ```
 */
export type Translate = (key: string, en: string, values?: MessageValues) => string;

/**
 * The structural slice of `Element` `localeOfElement` reads. Spelled out rather
 * than imported from the DOM lib so the core keeps type-checking — and shipping
 * — without one.
 */
export interface LangScope {
  getAttribute(name: string): string | null;
  closest(selectors: string): LangScope | null;
}

/** A non-empty, ordered list of locale codes — `as const` keeps the literals. */
export type LocaleList = readonly [string, ...string[]];

/** What {@link createLocaleRegistry} is built from. */
export interface LocaleRegistryConfig<Locales extends LocaleList> {
  /**
   * Every locale, in the order a language switcher offers them. These are the
   * URL segments and catalogue directory names, so keep them to bare language
   * codes; a regional `hreflang` belongs in {@link hreflang}.
   */
  locales: Locales;
  /** Each locale's name in that locale — what a switcher must show. */
  labels: Readonly<Record<Locales[number], string>>;
  /** The fallback for any reader we cannot place, and the authored source. */
  default: Locales[number];
  /**
   * Whether the default locale's URLs carry a `/<locale>` prefix too.
   *
   * `false` (the default) keeps EV's contract: the default locale lives at bare
   * paths, so already-indexed URLs never move. `true` gives every locale a
   * prefix — the right shape for a site that launches in several languages at
   * once and has no legacy URLs to protect.
   */
  prefixDefaultLocale?: boolean;
  /**
   * The `hreflang` tag per locale, for a site that targets a region rather than
   * a language (`fr` → `fr-FR`, or `fr-BE` for a Belgian storefront). A locale
   * left out advertises its bare code.
   */
  hreflang?: Readonly<Partial<Record<Locales[number], string>>>;
}

/**
 * One locale set with everything that depends on it. Every member is a plain
 * closure, so destructuring (`const { localePath } = registry`) is safe.
 */
export interface LocaleRegistry<L extends string> {
  /** Every locale, in switcher order. */
  readonly locales: readonly L[];
  /** Each locale's endonym. */
  readonly labels: Readonly<Record<L, string>>;
  /** The fallback locale, and the language `t()` call sites are authored in. */
  readonly defaultLocale: L;
  /** Whether the default locale's URLs are prefixed as well. */
  readonly prefixDefaultLocale: boolean;
  /** Narrowing guard for untrusted input — a URL segment, a cookie, a query param. */
  readonly isLocale: (value: unknown) => value is L;
  /** The path `locale` serves `path` at. */
  readonly localePath: (locale: L, path: string) => string;
  /**
   * Split a request path into its locale and the locale-free path beneath it.
   * An absent or unrecognised prefix reads as the default locale; never throws.
   */
  readonly splitLocalePath: (pathname: string) => { locale: L; path: string };
  /** Every locale's root-relative URL for one page, keyed by locale code. */
  readonly localeAlternates: (path: string, locales?: readonly L[]) => Record<string, string>;
  /** The `hreflang` tag a locale is advertised under. */
  readonly hreflangOf: (locale: L) => string;
  /**
   * Absolute URLs for one page keyed by `hreflang` tag, plus `x-default` — the
   * `alternates.languages` value Next's `generateMetadata` wants.
   */
  readonly languageAlternates: (
    path: string,
    siteUrl: string,
    locales?: readonly L[],
  ) => Record<string, string>;
  /** Best locale for an `Accept-Language` header — for suggesting, not serving. */
  readonly negotiate: (header: string | null | undefined, locales?: readonly L[]) => L;
  /** A {@link Translate} bound to one catalogue and locale. */
  readonly translator: (
    messages: Messages,
    locale: L,
    onMissing?: (key: string, locale: L) => void,
  ) => Translate;
  /** Format one ICU-subset pattern in `locale`. */
  readonly formatMessage: (pattern: string, locale: L, values?: MessageValues) => string;
  /** The locale a DOM subtree is written in, per `lang` inheritance. */
  readonly localeOfElement: (node: LangScope) => L;
}

/**
 * Build a {@link LocaleRegistry} over one list of locales.
 *
 * The locale type is the literal union of `locales`, so a registry for
 * `["fr", "en"]` rejects `localePath("de", …)` at compile time.
 *
 * @throws If `default` is not one of `locales`, or a locale is listed twice —
 *   both would make the URL contract ambiguous, so they fail at startup rather
 *   than on the first request that hits them.
 *
 * @example
 * ```ts
 * const i18n = createLocaleRegistry({
 *   locales: ["fr", "en"],
 *   labels: { fr: "Français", en: "English" },
 *   default: "fr",
 *   prefixDefaultLocale: true,
 *   hreflang: { fr: "fr-FR" },
 * });
 * i18n.localePath("fr", "/contact");   // "/fr/contact"
 * ```
 */
export function createLocaleRegistry<const Locales extends LocaleList>(
  config: LocaleRegistryConfig<Locales>,
): LocaleRegistry<Locales[number]> {
  type L = Locales[number];
  const locales: readonly L[] = config.locales;
  const defaultLocale: L = config.default;
  const prefixDefaultLocale = config.prefixDefaultLocale ?? false;
  const hreflangTags = config.hreflang;

  if (!locales.includes(defaultLocale)) {
    throw new Error(`default locale "${defaultLocale}" is not in [${locales.join(", ")}]`);
  }
  if (new Set(locales).size !== locales.length) {
    throw new Error(`locales listed more than once: [${locales.join(", ")}]`);
  }

  const isLocale = (value: unknown): value is L =>
    typeof value === "string" && (locales as readonly string[]).includes(value);

  const isPrefixed = (locale: L) => prefixDefaultLocale || locale !== defaultLocale;

  const localePath = (locale: L, path: string): string => {
    const clean = path.startsWith("/") ? path : `/${path}`;
    if (!isPrefixed(locale)) return clean;
    // "/" would otherwise yield "/ru/", and a trailing slash is a distinct URL to
    // a crawler — one canonical shape per page, so strip it.
    return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
  };

  const splitLocalePath = (pathname: string): { locale: L; path: string } => {
    const clean = pathname.startsWith("/") ? pathname : `/${pathname}`;
    const slash = clean.indexOf("/", 1);
    const head = slash === -1 ? clean.slice(1) : clean.slice(1, slash);
    // An explicit `/<default>` segment is not a prefix when the default is
    // unprefixed: it stays part of the path, exactly as a stray segment would.
    if (!isLocale(head) || !isPrefixed(head)) return { locale: defaultLocale, path: clean };
    const rest = slash === -1 ? "/" : clean.slice(slash);
    return { locale: head, path: rest === "" ? "/" : rest };
  };

  const localeAlternates = (path: string, only: readonly L[] = locales): Record<string, string> =>
    Object.fromEntries(only.map(l => [l, localePath(l, path)]));

  const hreflangOf = (locale: L): string => hreflangTags?.[locale] ?? locale;

  const languageAlternates = (
    path: string,
    siteUrl: string,
    only: readonly L[] = locales,
  ): Record<string, string> => {
    const origin = siteUrl.replace(/\/+$/, "");
    const abs = (l: L) => `${origin}${localePath(l, path)}`;
    return {
      ...Object.fromEntries(only.map(l => [hreflangOf(l), abs(l)])),
      // What a crawler serves a reader whose language matches none of ours —
      // the same answer the site itself gives.
      "x-default": abs(defaultLocale),
    };
  };

  const negotiate = (header: string | null | undefined, only: readonly L[] = locales): L => {
    if (!header) return defaultLocale;

    const ranked = header
      .split(",")
      .map(part => {
        const [tag, ...params] = part.trim().split(";");
        const q = params
          .map(p => p.trim())
          .find(p => p.startsWith("q="))
          ?.slice(2);
        const quality = q === undefined ? 1 : Number.parseFloat(q);
        return {
          tag: (tag ?? "").trim().toLowerCase(),
          // A malformed q= sorts last rather than poisoning the comparison with NaN.
          quality: Number.isFinite(quality) ? quality : 0,
        };
      })
      // q=0 is an explicit refusal of that language, not a weak preference.
      .filter(entry => entry.tag !== "" && entry.quality > 0)
      .sort((a, b) => b.quality - a.quality);

    for (const { tag } of ranked) {
      // "ru-RU" and "ru" both match the "ru" catalogue; "*" means "anything", for
      // which the default is as good an answer as any.
      const base = tag.split("-")[0] ?? "";
      const hit = only.find(l => {
        const code = l.toLowerCase();
        return code === tag || code === base;
      });
      if (hit) return hit;
      if (tag === "*") return defaultLocale;
    }
    return defaultLocale;
  };

  const formatMessage = (pattern: string, locale: L, values?: MessageValues): string =>
    formatPattern(pattern, locale, values);

  const translator = (
    messages: Messages,
    locale: L,
    onMissing?: (key: string, locale: L) => void,
  ): Translate => {
    // The default locale is the authored source: its copy is the call site's.
    const source = locale === defaultLocale ? null : messages;
    return (key, en, values) => {
      if (source === null) return formatPattern(en, locale, values);
      const pattern = source[key];
      if (pattern === undefined) onMissing?.(key, locale);
      return formatPattern(pattern ?? en, locale, values);
    };
  };

  const localeOfElement = (node: LangScope): L =>
    negotiate(node.closest("[lang]")?.getAttribute("lang"));

  return {
    locales,
    labels: config.labels,
    defaultLocale,
    prefixDefaultLocale,
    isLocale,
    localePath,
    splitLocalePath,
    localeAlternates,
    hreflangOf,
    languageAlternates,
    negotiate,
    translator,
    formatMessage,
    localeOfElement,
  };
}
