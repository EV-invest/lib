/**
 * @module @evinvest/i18n/next
 *
 * Next.js App Router wiring for the URL contract in the core: the default
 * locale unprefixed, every other locale under `/<locale>`.
 *
 * The mechanism is deliberately **config-level, not middleware**. Every page
 * lives under `app/[locale]/`, and one `fallback` rewrite maps the unprefixed
 * paths onto the default locale. `fallback` runs last — after dynamic routes —
 * so `/ru/team` (which matches `app/[locale]/team`) and the zone mounts
 * (`/cabinet`, `/rea`, `/api/*`) never reach it. The public site therefore keeps
 * its property of shipping no `proxy.ts` at all, and every route stays
 * statically prerenderable for a deliberately weak VPS.
 *
 * Two details carry the whole scheme, both verified by spike rather than
 * assumed — see {@link localeRewrites} and {@link localeStaticParams}.
 *
 * The free functions are bound to the generated registry. A surface with its
 * own locales gets the same set from {@link createNextI18n}; a registry that
 * prefixes its default locale needs no rewrite at all, only a root redirect.
 *
 * This file is server-safe: it exports plain data for `next.config.ts` and for
 * `generateStaticParams`/`generateMetadata`. It imports nothing from `next`.
 */
import { defaultLocaleRegistry, type Locale, type LocaleRegistry } from "../index";

/** A Next.js rewrite/redirect rule, structurally typed to avoid importing `next`. */
export interface UrlRule {
  source: string;
  destination: string;
}

/** A Next.js redirect rule. */
export interface RedirectRule extends UrlRule {
  permanent: boolean;
}

/** The `alternates` block of a Next `Metadata` object. */
export interface AlternatesMetadata {
  canonical: string;
  languages: Record<string, string>;
}

/**
 * The Next wiring for one locale registry. This module's free functions are
 * {@link createNextI18n} over the generated registry; their docs carry the full
 * rationale.
 */
export interface NextI18n<L extends string> {
  /** `generateStaticParams` for a `[locale]` segment — every locale, default included. */
  readonly localeStaticParams: () => { locale: L }[];
  /**
   * The `fallback` rewrite serving the default locale at bare paths. Empty when
   * the registry prefixes its default locale: nothing is served unprefixed.
   */
  readonly localeRewrites: (defaultLocale?: L) => UrlRule[];
  /**
   * Canonicalising redirects: `/<default>/*` onto the bare form, or — when the
   * default locale is prefixed — the bare root onto `/<default>`.
   */
  readonly localeRedirects: (defaultLocale?: L) => RedirectRule[];
  /** Self-referential canonical plus the full `hreflang` cluster with `x-default`. */
  readonly localeAlternatesMetadata: (
    locale: L,
    path: string,
    siteUrl: string,
    locales?: readonly L[],
  ) => AlternatesMetadata;
}

/**
 * Bind the Next wiring to a registry built with `createLocaleRegistry`.
 *
 * With `prefixDefaultLocale: true` every locale is a real `[locale]` route, so
 * {@link NextI18n.localeRewrites} is empty and {@link NextI18n.localeRedirects}
 * only sends the bare root to `/<default>`. Other bare paths 404 under
 * `dynamicParams = false` rather than being redirected: a catch-all redirect
 * source would match the prefixed routes too and loop.
 *
 * @example
 * ```ts
 * // shared/config/i18n.ts
 * export const i18n = createLocaleRegistry({ locales: ["fr", "en"], … });
 * export const { localeStaticParams, localeRedirects, localeAlternatesMetadata } =
 *   createNextI18n(i18n);
 * ```
 */
export function createNextI18n<L extends string>(registry: LocaleRegistry<L>): NextI18n<L> {
  // Takes no arguments on purpose — Next passes a props object; see
  // `localeStaticParams` below.
  const localeStaticParams = (): { locale: L }[] => registry.locales.map(locale => ({ locale }));

  const localeRewrites = (defaultLocale: L = registry.defaultLocale): UrlRule[] =>
    registry.prefixDefaultLocale
      ? []
      : [{ source: "/:path*", destination: `/${defaultLocale}/:path*` }];

  const localeRedirects = (defaultLocale: L = registry.defaultLocale): RedirectRule[] =>
    registry.prefixDefaultLocale
      ? // Temporary: the target is whatever the default is configured to be, and
        // a cached 308 would keep returning browsers on the old one after a change.
        [{ source: "/", destination: `/${defaultLocale}`, permanent: false }]
      : [
          { source: `/${defaultLocale}/:path*`, destination: "/:path*", permanent: true },
          // `:path*` matches zero segments in a destination but not reliably as a
          // bare source, so the prefix root gets its own rule.
          { source: `/${defaultLocale}`, destination: "/", permanent: true },
        ];

  const localeAlternatesMetadata = (
    locale: L,
    path: string,
    siteUrl: string,
    locales: readonly L[] = registry.locales,
  ): AlternatesMetadata => ({
    canonical: `${siteUrl.replace(/\/+$/, "")}${registry.localePath(locale, path)}`,
    languages: registry.languageAlternates(path, siteUrl, locales),
  });

  return { localeStaticParams, localeRewrites, localeRedirects, localeAlternatesMetadata };
}

const next: NextI18n<Locale> = createNextI18n(defaultLocaleRegistry);

/**
 * The `generateStaticParams` return value for a `[locale]` segment.
 *
 * Includes the default locale: unprefixed URLs are *rewritten* to it, so
 * `/en/team` must be a real prerendered route even though no reader ever sees
 * that URL.
 *
 * **`export const dynamicParams = false` is required, and is load-bearing rather
 * than hygiene.** In the real end state `app/[locale]/page.tsx` is the homepage,
 * so `[locale]` matches any single segment — which makes a one-segment English
 * URL like `/team` ambiguous with it. With `dynamicParams = false` and these
 * params, `[locale]` *declines* the unknown segment and the request falls
 * through to the `fallback` rewrite that resolves it as English. Without it,
 * `/team` renders the homepage with `locale === "team"`.
 *
 * Takes no arguments, deliberately. Next types `generateStaticParams` as
 * receiving a props object, so a function with a leading `locales` parameter is
 * not assignable to it — the obvious `export const generateStaticParams =
 * localeStaticParams` failed to typecheck, and at runtime Next would have passed
 * `{ params }` straight into the `locales` slot. Prerendering a subset is rare
 * enough to be a one-line `.map` at the call site.
 *
 * @returns One `{ locale }` param object per locale.
 *
 * @example
 * ```ts
 * // app/[locale]/layout.tsx
 * export const dynamicParams = false;
 * export const generateStaticParams = localeStaticParams;
 * ```
 */
export function localeStaticParams(): { locale: Locale }[] {
  return next.localeStaticParams();
}

/**
 * The **`fallback`** rewrite that serves the default locale at unprefixed paths.
 *
 * It must go in `fallback`, and this is the one thing about the scheme that is
 * easy to get wrong — an `afterFiles` rule looks like it works, because the
 * English half does. Next's routing order is:
 *
 * ```
 * headers → redirects → beforeFiles → filesystem → afterFiles → DYNAMIC ROUTES → fallback
 * ```
 *
 * `afterFiles` runs after the *filesystem* (static files, non-dynamic pages) but
 * **before dynamic routes** — and the whole `app/[locale]/` tree is a dynamic
 * route. So an `afterFiles` rule fires before `[locale]` is ever tried:
 * `/ru/team` is rewritten to `/en/ru/team` and 404s, while `/team` happens to
 * resolve correctly and hides the bug. Verified on Next 16.2.9; see
 * `site_conductor/docs/i18n-routing-spike.md`.
 *
 * `fallback` runs last, after dynamic routes have had their chance, which is the
 * semantics actually wanted: "no real route matched, so this must be an
 * unprefixed default-locale page".
 *
 * @param defaultLocale - The unprefixed locale. Defaults to `DEFAULT_LOCALE`.
 * @returns One rewrite rule, ready to spread into `fallback`.
 *
 * @example
 * ```ts
 * // next.config.ts
 * async rewrites() {
 *   return { beforeFiles: [...zoneRewrites], afterFiles: [], fallback: localeRewrites() };
 * }
 * ```
 */
export function localeRewrites(defaultLocale?: Locale): UrlRule[] {
  return next.localeRewrites(defaultLocale);
}

/**
 * The redirect that collapses the explicit `/en/*` form onto the unprefixed one,
 * so each page has exactly one canonical URL.
 *
 * Without it, `/en/team` and `/team` both render — duplicate content that splits
 * ranking signals between two URLs. This cannot loop with
 * {@link localeRewrites}: the redirect is external and evaluated against the
 * incoming request, while the rewrite is internal and never re-enters the
 * redirect pipeline.
 *
 * @param defaultLocale - The unprefixed locale. Defaults to `DEFAULT_LOCALE`.
 * @returns One permanent redirect rule.
 *
 * @example
 * ```ts
 * // next.config.ts
 * async redirects() {
 *   return localeRedirects();
 * }
 * ```
 */
export function localeRedirects(defaultLocale?: Locale): RedirectRule[] {
  return next.localeRedirects(defaultLocale);
}

/**
 * Build the `alternates` block for one page: a self-referential canonical plus
 * the full `hreflang` cluster with `x-default`.
 *
 * `x-default` points at the default locale — it is what a crawler serves a
 * reader whose language matches none of ours, which is the same answer the site
 * itself gives.
 *
 * Every URL is absolute. `hreflang` values are ignored by Google when relative.
 * Keys are `hreflang` tags — the bare locale code unless the registry maps it to
 * a regional tag.
 *
 * @param locale  - The locale of the page being rendered (drives `canonical`).
 * @param path    - The locale-free root-relative path, e.g. `/team`.
 * @param siteUrl - Absolute origin, no trailing slash.
 * @param locales - Locales to advertise. Defaults to all of `LOCALES`.
 * @returns The `alternates` metadata block.
 *
 * @example
 * ```ts
 * export async function generateMetadata({ params }) {
 *   const { locale } = await params;
 *   return { alternates: localeAlternatesMetadata(locale, "/team", SITE.url) };
 * }
 * ```
 */
export function localeAlternatesMetadata(
  locale: Locale,
  path: string,
  siteUrl: string,
  locales?: readonly Locale[],
): AlternatesMetadata {
  return next.localeAlternatesMetadata(locale, path, siteUrl, locales);
}
