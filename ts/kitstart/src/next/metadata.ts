import type { Metadata } from "next";
import { isPublished } from "../core/place/publication";
import { placeOrigin, siteOrigin, type PlaceView } from "../core/place/view";
import { ogImageUrl } from "../core/seo/sitemap";
import { ogLocaleOf, type Site } from "../core/site";

/**
 * `<head>` for the three kinds of page. Every string comes from the copy — the
 * description here is the same field the OG card and the JSON-LD read. Output
 * pinned in `tests/fixtures/kitstart/metadata.json` (aquafix's goldens, and
 * the service-area and pre-launch sites).
 *
 * Each language version is its own indexable URL, self-canonical, naming the
 * whole cluster in `hreflang` with `x-default` on the default locale. The
 * canonical host is always the place's own (its subdomain, or the apex on a
 * single site), so the apex fallback path never competes. An unpublished place
 * answers `noindex`.
 *
 * A site with no domain yet is not on the web: every page is `noindex,
 * nofollow`, and there is no canonical, no `hreflang` cluster and no
 * `og:url` — a relative one would name no page, and a guessed host would name
 * the wrong one.
 */
export interface PageMeta {
  title: string;
  description: string;
}

const OG_SIZE = { width: 1200, height: 630 } as const;
const PRE_LAUNCH = { index: false, follow: false } as const;

function others<L extends string, P extends string>(site: Site<L, P>, locale: L): string[] {
  return site.i18n.locales.filter(l => l !== locale).map(l => ogLocaleOf(site, l));
}

interface Page<L extends string> {
  title: string;
  description: string;
  locale: L;
  /** `null` before launch. */
  canonical: string | null;
  languages: Record<string, string> | null;
  robots: Metadata["robots"] | undefined;
  image: string;
}

/** One key order for every page kind — the fixtures pin it. */
function head<L extends string, P extends string>(site: Site<L, P>, page: Page<L>): Metadata {
  return {
    title: page.title,
    description: page.description,
    ...(page.robots ? { robots: page.robots } : {}),
    ...(page.canonical !== null && page.languages ? { alternates: { canonical: page.canonical, languages: page.languages } } : {}),
    openGraph: {
      type: "website",
      siteName: site.brand.name,
      title: page.title,
      description: page.description,
      ...(page.canonical !== null ? { url: page.canonical } : {}),
      locale: ogLocaleOf(site, page.locale),
      alternateLocale: others(site, page.locale),
      images: [{ url: page.image, ...OG_SIZE }],
    },
    twitter: { card: "summary_large_image" },
  };
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
  const origin = placeOrigin(site, view.place.slug);
  const published = isPublished(view.place, site.publication, site.brand);
  return head(site, {
    title,
    description: copy.description,
    locale: view.locale,
    canonical: origin === null ? null : view.url(suffix),
    languages: origin === null ? null : site.i18n.languageAlternates(suffix || "/", origin),
    robots: origin === null ? PRE_LAUNCH : published ? { index: true, follow: true } : { index: false, follow: true },
    image: ogImageUrl(site, { slug: view.place.slug, locale: view.locale, page }),
  });
}

/** The apex's own page — the directory of a `subdomains` site. */
export function brandMetadata<L extends string, P extends string>(site: Site<L, P>, locale: L, copy: PageMeta): Metadata {
  const origin = siteOrigin(site);
  return head(site, {
    title: copy.title,
    description: copy.description,
    locale,
    canonical: origin === null ? null : `${origin}${site.i18n.localePath(locale, "/")}`,
    languages: origin === null ? null : site.i18n.languageAlternates("/", origin),
    robots: origin === null ? PRE_LAUNCH : undefined,
    image: ogImageUrl(site, { locale }),
  });
}

/** Status pages are never indexed and never in the sitemap. */
export function statusMetadata<L extends string, P extends string>(site: Site<L, P>, title: string): Metadata {
  return { title: `${title} · ${site.brand.name}`, robots: { index: false, follow: false } };
}

/** `metadataBase` for the root layout: the apex, or loopback before launch. */
export function metadataBase<L extends string, P extends string>(site: Site<L, P>): URL {
  return new URL(siteOrigin(site) ?? "http://localhost");
}
