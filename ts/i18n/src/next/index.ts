/**
 * @module @evinvest/i18n/next
 *
 * Next.js App Router wiring for the URL contract in the core: the default
 * locale unprefixed, every other locale under `/<locale>`.
 *
 * The mechanism is deliberately **config-level, not middleware**. Every page
 * lives under `app/[locale]/`, and one `afterFiles` rewrite maps the unprefixed
 * paths onto the default locale. `afterFiles` runs only when no filesystem route
 * matched, so `/ru/team` (which matches `app/[locale]/team`) and the zone mounts
 * (`/cabinet`, `/rea`, `/api/*`) never reach it. The public site therefore keeps
 * its property of shipping no `proxy.ts` at all, and every route stays
 * statically prerenderable for a deliberately weak VPS.
 *
 * This file is server-safe: it exports plain data for `next.config.ts` and for
 * `generateStaticParams`/`generateMetadata`. It imports nothing from `next`.
 */
import {
  DEFAULT_LOCALE,
  LOCALES,
  localePath,
  type Locale,
} from "../index";

/**
 * The `generateStaticParams` return value for a `[locale]` segment.
 *
 * Includes the default locale: unprefixed URLs are *rewritten* to it, so
 * `/en/team` must be a real prerendered route even though no reader ever sees
 * that URL. Pair with `export const dynamicParams = false` so an unknown first
 * segment 404s instead of being swallowed by `[locale]`.
 *
 * @param locales - Locales to prerender. Defaults to all of `LOCALES`.
 * @returns One `{ locale }` param object per locale.
 *
 * @example
 * ```ts
 * // app/[locale]/layout.tsx
 * export const dynamicParams = false;
 * export function generateStaticParams() {
 *   return localeStaticParams();
 * }
 * ```
 */
export function localeStaticParams(
  locales: readonly Locale[] = LOCALES,
): { locale: Locale }[] {
  return locales.map(locale => ({ locale }));
}

/** A Next.js rewrite/redirect rule, structurally typed to avoid importing `next`. */
export interface UrlRule {
  source: string;
  destination: string;
}

/** A Next.js redirect rule. */
export interface RedirectRule extends UrlRule {
  permanent: boolean;
}

/**
 * The `afterFiles` rewrite that serves the default locale at unprefixed paths.
 *
 * Must go in `afterFiles` — **not** `beforeFiles`. In `beforeFiles` it would run
 * ahead of the filesystem and swallow the zone mounts and every prefixed locale
 * route. In `afterFiles` it is the last resort, which is precisely the semantics
 * wanted: "no real route matched, so this must be an unprefixed default-locale
 * page".
 *
 * @param defaultLocale - The unprefixed locale. Defaults to `DEFAULT_LOCALE`.
 * @returns One rewrite rule, ready to spread into `afterFiles`.
 *
 * @example
 * ```ts
 * // next.config.ts
 * async rewrites() {
 *   return { beforeFiles: [...zoneRewrites], afterFiles: localeRewrites(), fallback: [] };
 * }
 * ```
 */
export function localeRewrites(defaultLocale: Locale = DEFAULT_LOCALE): UrlRule[] {
  return [{ source: "/:path*", destination: `/${defaultLocale}/:path*` }];
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
export function localeRedirects(
  defaultLocale: Locale = DEFAULT_LOCALE,
): RedirectRule[] {
  return [
    { source: `/${defaultLocale}/:path*`, destination: "/:path*", permanent: true },
    // `:path*` matches zero segments in a destination but not reliably as a bare
    // source, so the prefix root gets its own rule.
    { source: `/${defaultLocale}`, destination: "/", permanent: true },
  ];
}

/** The `alternates` block of a Next `Metadata` object. */
export interface AlternatesMetadata {
  canonical: string;
  languages: Record<string, string>;
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
  locales: readonly Locale[] = LOCALES,
): AlternatesMetadata {
  const origin = siteUrl.replace(/\/+$/, "");
  const abs = (l: Locale) => `${origin}${localePath(l, path)}`;
  return {
    canonical: abs(locale),
    languages: {
      ...Object.fromEntries(locales.map(l => [l, abs(l)])),
      "x-default": abs(DEFAULT_LOCALE),
    },
  };
}
