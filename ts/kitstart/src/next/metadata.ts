import type { Metadata } from "next";
import { isPublished } from "../core/place/publication";
import { placeOrigin, siteOrigin, type PlaceView } from "../core/place/view";
import { ogImageUrl } from "../core/seo/sitemap";
import { ogLocaleOf, type Site } from "../core/site";

/**
 * `<head>` for the three kinds of page. Every string comes from the copy — the
 * description here is the same field the OG card and the JSON-LD read. Output
 * pinned against aquafix's goldens in `tests/fixtures/kitstart/metadata.json`.
 *
 * Each language version is its own indexable URL, self-canonical, naming the
 * whole cluster in `hreflang` with `x-default` on the default locale. The
 * canonical host is always the place's own (its subdomain, or the apex on a
 * single site), so the apex fallback path never competes. An unpublished place
 * answers `noindex`.
 */
export interface PageMeta {
  title: string;
  description: string;
}

const OG_SIZE = { width: 1200, height: 630 } as const;

function others<L extends string, P extends string>(site: Site<L, P>, locale: L): string[] {
  return site.i18n.locales.filter(l => l !== locale).map(l => ogLocaleOf(site, l));
}

export function placeMetadata<L extends string, P extends string>(
  site: Site<L, P>,
  view: PlaceView<L>,
  page: P | "home",
  copy: PageMeta,
): Metadata {
  const { name } = site.brand;
  const title = page === "home" ? `${name} — ${copy.title}` : `${copy.title} · ${name}`;
  const suffix = site.pages[page];
  const canonical = view.url(suffix);
  return {
    title,
    description: copy.description,
    robots: isPublished(view.place, site.publication, site.brand) ? { index: true, follow: true } : { index: false, follow: true },
    alternates: {
      canonical,
      languages: site.i18n.languageAlternates(suffix || "/", placeOrigin(site, view.place.slug) ?? ""),
    },
    openGraph: {
      type: "website",
      siteName: name,
      title,
      description: copy.description,
      url: canonical,
      locale: ogLocaleOf(site, view.locale),
      alternateLocale: others(site, view.locale),
      images: [{ url: ogImageUrl(site, { slug: view.place.slug, locale: view.locale, page }), ...OG_SIZE }],
    },
    twitter: { card: "summary_large_image" },
  };
}

/** The apex's own page — the directory of a `subdomains` site. */
export function brandMetadata<L extends string, P extends string>(site: Site<L, P>, locale: L, copy: PageMeta): Metadata {
  const origin = siteOrigin(site) ?? "";
  const canonical = `${origin}${site.i18n.localePath(locale, "/")}`;
  return {
    title: copy.title,
    description: copy.description,
    ...(siteOrigin(site) === null ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical, languages: site.i18n.languageAlternates("/", origin) },
    openGraph: {
      type: "website",
      siteName: site.brand.name,
      title: copy.title,
      description: copy.description,
      url: canonical,
      locale: ogLocaleOf(site, locale),
      alternateLocale: others(site, locale),
      images: [{ url: ogImageUrl(site, { locale }), ...OG_SIZE }],
    },
    twitter: { card: "summary_large_image" },
  };
}

/** Status pages are never indexed and never in the sitemap. */
export function statusMetadata<L extends string, P extends string>(site: Site<L, P>, title: string): Metadata {
  return { title: `${title} · ${site.brand.name}`, robots: { index: false, follow: false } };
}

/** `metadataBase` for the root layout: the apex, or loopback before launch. */
export function metadataBase<L extends string, P extends string>(site: Site<L, P>): URL {
  return new URL(siteOrigin(site) ?? "http://localhost");
}
