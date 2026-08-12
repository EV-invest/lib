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
