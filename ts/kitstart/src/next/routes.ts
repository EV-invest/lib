import type { MetadataRoute } from "next";
import { headers } from "next/headers.js";
import { createRouting } from "../core/routing";
import { robotsFor, sitemapFor } from "../core/seo/sitemap";
import type { Site } from "../core/site";
import type { PlaceSource } from "../server/place-source";

/**
 * `app/sitemap.ts`, `app/robots.ts` and `app/health/route.ts` in three lines
 * each. The two metadata routes read the `Host` header — a sitemap may only
 * list URLs on its own host — so the brand's file says
 * `export const dynamic = "force-dynamic"` itself (Next reads it statically).
 * They are cheap; the pages are what is cached.
 */
async function host(): Promise<string> {
  return (await headers()).get("host") ?? "";
}

/**
 * Strict: with a live source configured, an unreachable one throws, and the
 * crawler keeps its last copy — an empty or truncated sitemap would tell it
 * the place is gone.
 */
export function sitemapRoute<L extends string, P extends string>(
  site: Site<L, P>,
  source: PlaceSource<L>,
): () => Promise<MetadataRoute.Sitemap> {
  const routing = createRouting(site);
  return async () => {
    const h = await host();
    // A host's sitemap lists at most its own place, so that is the one fetch;
    // the apex of a subdomains site lists only the brand page and asks nothing.
    const slug = routing.hostSlug(h);
    if (slug === null) return sitemapFor(site, h, []);
    const place = await source.getPlaceStrict(slug, site.i18n.defaultLocale);
    return sitemapFor(site, h, place ? [place] : []);
  };
}

export function robotsRoute<L extends string, P extends string>(site: Site<L, P>): () => Promise<MetadataRoute.Robots> {
  return async () => robotsFor(site, await host());
}

/**
 * The readiness probe: the process answers. `check` is for a brand that wants
 * more (the lead store's `health()`); a failing check answers 503.
 */
export function healthRoute(check?: () => Promise<void>): () => Promise<Response> {
  return async () => {
    try {
      await check?.();
    } catch (error) {
      console.error("health: check failed", error);
      return new Response("unavailable", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    return new Response("ok", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  };
}
