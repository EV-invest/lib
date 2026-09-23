import type { Place } from "./types";

/**
 * How links are written on a place's pages. On its own host a page is
 * `/fr/prices` (`host`); reached through the apex fallback it is
 * `/fr/<slug>/prices` (`path`). The proxy says which one a request is by the
 * route it rewrites to — see `placeParam`.
 */
export type LinkMode = "host" | "path";

/** The part of a site that decides where a place's canonical URLs live. */
export interface OriginFacts {
  brand: { domain: string | null };
  topology: { kind: "subdomains" } | { kind: "single" };
}

/**
 * A place as one request sees it: the merged record, the language, and how its
 * links are written on this host. Sections take this instead of eight props.
 */
export interface PlaceView<L extends string> {
  place: Place<L>;
  locale: L;
  mode: LinkMode;
  /** Root-relative link to one of this place's pages in `locale`. */
  href: (suffix: string, locale?: L) => string;
  /** Canonical URL — absolute once the site has a domain. */
  url: (suffix: string, locale?: L) => string;
}

/** `https://<domain>`, or `null` for a site with no domain yet. */
export function siteOrigin(site: OriginFacts): string | null {
  return site.brand.domain === null ? null : `https://${site.brand.domain}`;
}

/**
 * Where a place's pages canonically live: its subdomain in a `subdomains`
 * site, the apex in a `single` one, whichever URL served the request.
 */
export function placeOrigin(site: OriginFacts, slug: string): string | null {
  const { domain } = site.brand;
  if (domain === null) return null;
  return site.topology.kind === "single" ? `https://${domain}` : `https://${slug}.${domain}`;
}

/** Where a place's pages link to, given how this request reached it. */
export interface LinkBase {
  mode: LinkMode;
  slug: string;
}

/**
 * A root-relative href to one of the place's pages. `suffix` is a page suffix
 * and may carry a fragment: `"#quote"`, `"/prices#faq"`.
 */
export function placeHref(base: LinkBase, locale: string, suffix: string): string {
  const prefix = base.mode === "host" ? `/${locale}` : `/${locale}/${base.slug}`;
  return `${prefix}${suffix}`;
}

/**
 * The canonical URL of a place's page. A site with no domain has no absolute
 * URL to give; the root-relative path it serves is the honest answer, and
 * every page of such a site is `noindex` anyway.
 */
export function placeUrl(site: OriginFacts, slug: string, locale: string, suffix: string): string {
  const origin = placeOrigin(site, slug);
  if (origin !== null) return `${origin}/${locale}${suffix}`;
  return placeHref({ mode: site.topology.kind === "single" ? "host" : "path", slug }, locale, suffix);
}

export function createPlaceView<L extends string>(site: OriginFacts, place: Place<L>, locale: NoInfer<L>, mode: LinkMode): PlaceView<L> {
  const base = { mode, slug: place.slug };
  return {
    place,
    locale,
    mode,
    href: (suffix, other = locale) => placeHref(base, other, suffix),
    url: (suffix, other = locale) => placeUrl(site, place.slug, other, suffix),
  };
}
