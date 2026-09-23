import { isPublished } from "../place/publication";
import type { Place } from "../place/types";
import { placeOrigin, siteOrigin } from "../place/view";
import { createRouting } from "../routing";
import type { Site } from "../site";

/**
 * One sitemap per host: a sitemap may only list URLs on its own host, and a
 * place's canonical host is its subdomain (the apex on a `single` site). The
 * apex of a `subdomains` site lists the brand page.
 *
 * Each language version is its own entry, annotated with the whole set
 * *including itself*. No `lastmod`: a deploy timestamp that moves without the
 * content moving is a lie. An unpublished place is left out entirely, and a
 * site with no domain lists nothing.
 *
 * Shapes match Next's `MetadataRoute.Sitemap` / `MetadataRoute.Robots`, so
 * `./next` returns them as they are.
 */
export interface SitemapEntry {
  url: string;
  priority: number;
  alternates: { languages: Record<string, string> };
}

export interface RobotsRule {
  userAgent: string | string[];
  allow?: string;
  disallow?: string;
}

export interface RobotsFile {
  rules: RobotsRule[];
  sitemap?: string;
}

function cluster<L extends string, P extends string>(site: Site<L, P>, origin: string, suffix: string, priority: number): SitemapEntry[] {
  const languages = site.i18n.languageAlternates(suffix || "/", origin);
  return site.i18n.locales.map(locale => ({
    url: `${origin}${site.i18n.localePath(locale, suffix || "/")}`,
    priority,
    alternates: { languages },
  }));
}

/**
 * The sitemap for a request's host. `places` is the list as the live source
 * sees it now — the caller fetches it strictly: an unreachable source must
 * fail the sitemap (a 5xx a crawler retries), never shrink it (a list of
 * places a crawler drops).
 */
export function sitemapFor<L extends string, P extends string>(site: Site<L, P>, host: string, places: readonly Place<L>[]): SitemapEntry[] {
  const apex = siteOrigin(site);
  if (apex === null) return [];
  const slug = createRouting(site).hostSlug(host);
  if (slug === null) return cluster(site, apex, "", 1);
  const place = places.find(p => p.slug === slug);
  const origin = placeOrigin(site, slug);
  if (!place || origin === null || !isPublished(place, site.publication, site.brand)) return [];
  return site.pageKeys.flatMap(page => cluster(site, origin, site.pages[page], page === "home" ? 1 : 0.8));
}

/** Crawlers named explicitly: several treat a bare wildcard as ambiguous. */
export const AI_CRAWLERS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"];

/**
 * Allow everything, and point at the host's own sitemap. Unpublished places
 * are held back by `noindex`, not here, so a crawler can still read the
 * `noindex`. A site with no domain is not ready to be crawled at all.
 */
export function robotsFor<L extends string, P extends string>(site: Site<L, P>, host: string): RobotsFile {
  const apex = siteOrigin(site);
  if (apex === null) return { rules: [{ userAgent: "*", disallow: "/" }] };
  const slug = createRouting(site).hostSlug(host);
  const origin = (slug === null ? null : placeOrigin(site, slug)) ?? apex;
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: [...AI_CRAWLERS], allow: "/" },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}

/** The OG card URL: on the apex, so it never needs a rewrite. */
export function ogImageUrl<L extends string, P extends string>(site: Site<L, P>, query: { slug?: string; locale: L; page?: string }): string {
  const params = new URLSearchParams({ lang: query.locale });
  if (query.slug) params.set("l", query.slug);
  if (query.page) params.set("p", query.page);
  return `${siteOrigin(site) ?? ""}/og?${params.toString()}`;
}
