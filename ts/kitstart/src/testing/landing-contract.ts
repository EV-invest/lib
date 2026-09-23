import { describe, expect, it } from "vitest";
import { isPublished, publicationGaps } from "../core/place/publication";
import { createRouting, pointSuffixes, THANKS } from "../core/routing";
import type { Site } from "../core/site";

/**
 * What every brand's site config must hold for the machinery to work — run
 * from the brand's own tests:
 *
 * ```ts
 * describeLandingContract(site, {
 *   globalsCss: readFileSync("app/globals.css", "utf8"),
 *   proxySource: readFileSync("proxy.ts", "utf8"),
 *   text: TEXT,
 * });
 * ```
 */
export interface LandingContractOptions<L extends string> {
  /** `app/globals.css`: Tailwind must be told to scan the package. */
  globalsCss?: string;
  /** `proxy.ts`: its literal matcher must be the package's. */
  proxySource?: string;
  /** The brand's copy, one per locale — every locale must have one. */
  text?: Readonly<Partial<Record<L, unknown>>>;
  /** Places that must be published once the owner's fields are in. */
  mustPublish?: readonly string[];
}

const SOURCE_LINE = /@source\s+["'][^"']*node_modules\/@evinvest\/kitstart\/dist["']/;
const MATCHER = "/((?!_next/|.*\\\\.[a-z0-9]+$).*)";

export function describeLandingContract<L extends string, P extends string>(site: Site<L, P>, options: LandingContractOptions<L> = {}): void {
  describe(`landing contract: ${site.brand.id}`, () => {
    it("has a home page and no page at the thank-you path", () => {
      expect(site.pages.home).toBe("");
      expect(pointSuffixes(site).filter(s => s === THANKS)).toHaveLength(1);
      for (const key of site.pageKeys) expect(site.pages[key], key).toMatch(/^(\/[a-z0-9-]+)*$/);
    });

    it("routes every page of every place to itself, in every locale", () => {
      const routing = createRouting(site);
      const host = (slug: string) => (site.topology.kind === "single" ? (site.brand.domain ?? "localhost") : `${slug}.${site.brand.domain ?? "localhost"}`);
      for (const slug of site.placeSlugs) {
        for (const locale of site.i18n.locales) {
          for (const key of site.pageKeys) {
            const decision = routing.decide({
              host: host(slug),
              pathname: site.i18n.localePath(locale, site.pages[key] || "/"),
              query: new URLSearchParams(),
              acceptLanguage: null,
              cookieLang: null,
            });
            expect(decision, `${slug} ${locale} ${key}`).toEqual({ kind: "serve", pathname: `/${locale}/_${slug}${site.pages[key]}` });
          }
        }
      }
    });

    // On a single site the apex *is* the place, so a legacy path that is also
    // a page suffix would move a live page away.
    it("lets no legacy redirect shadow a live page", () => {
      if (site.topology.kind !== "single") return;
      const suffixes = pointSuffixes(site);
      for (const redirect of site.legacyRedirects ?? []) {
        const moves = site.i18n.locales.some(locale => redirect.to(locale) !== null);
        expect(moves && suffixes.includes(redirect.from), redirect.from).toBe(false);
      }
    });

    it("publishes nothing without a domain", () => {
      if (site.brand.domain !== null) return;
      for (const place of site.places) expect(isPublished(place, site.publication, site.brand), place.slug).toBe(false);
    });

    if (options.mustPublish) {
      it("publishes the places the owner has completed", () => {
        for (const slug of options.mustPublish ?? []) {
          const place = site.places.find(p => p.slug === slug);
          expect(place, slug).toBeDefined();
          if (place) expect(publicationGaps(place, site.publication), slug).toEqual([]);
        }
      });
    }

    if (options.text) {
      it("has copy for every locale", () => {
        for (const locale of site.i18n.locales) expect(options.text?.[locale], locale).toBeDefined();
      });
    }

    if (options.globalsCss !== undefined) {
      it("lets Tailwind scan the package", () => {
        expect(options.globalsCss).toMatch(SOURCE_LINE);
      });
    }

    if (options.proxySource !== undefined) {
      it("spells the package's matcher in proxy.ts", () => {
        expect(options.proxySource).toContain(`"${MATCHER}"`);
      });
    }
  });
}
