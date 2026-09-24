import { describe, expect, it } from "vitest";
import { isPublished, publicationGaps } from "../core/place/publication";
import { createRouting, NON_PAGE_ROUTES, pointSuffixes, THANKS } from "../core/routing";
import { openLaunchBlockers, type OwnerTodo, type Site } from "../core/site";
import { servedPaths } from "./served-files";

/**
 * What every brand's site config must hold for the machinery to work — run
 * from the brand's own tests:
 *
 * ```ts
 * describeLandingContract(site, {
 *   globalsCss: readFileSync("app/globals.css", "utf8"),
 *   proxySource: readFileSync("proxy.ts", "utf8"),
 *   root: process.cwd(),
 *   text: TEXT,
 * });
 * ```
 */
export interface LandingContractOptions<L extends string> {
  /** `app/globals.css`: Tailwind must be told to scan the package. */
  globalsCss?: string;
  /** `proxy.ts`: its literal matcher must be the package's. */
  proxySource?: string;
  /**
   * The brand's directory: every file `app/` and `public/` serve outside
   * `[locale]` must pass the proxy — be a `NON_PAGE_ROUTES` path or in
   * `site.publicFiles` — or it answers 404; and every listed file must exist.
   */
  root?: string;
  /** The brand's copy, one per locale — every locale must have one. */
  text?: Readonly<Partial<Record<L, unknown>>>;
  /** Places that must be published once the owner's fields are in. */
  mustPublish?: readonly string[];
  /** The brand's open owner facts: a domain (launch) is refused while one that blocks launch is open. */
  ownerTodo?: readonly OwnerTodo[];
}

const SOURCE_LINE = /@source\s+["'][^"']*node_modules\/@evinvest\/kitstart\/dist["']/;
const MATCHER = "/((?!_next/).*)";

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

    if (options.ownerTodo) {
      it("launches only with every blocking owner fact in", () => {
        if (site.brand.domain === null) return;
        expect(openLaunchBlockers(options.ownerTodo ?? []).map(t => t.field)).toEqual([]);
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

    if (options.root !== undefined) {
      const root = options.root;
      it("passes exactly the files it serves", () => {
        const served = servedPaths(root);
        const listed = site.publicFiles ?? [];
        const passed = [...NON_PAGE_ROUTES, ...listed];
        expect(served.filter(p => !passed.includes(p)), "served, but the proxy sends it to the 404: list it in site.publicFiles").toEqual([]);
        expect(listed.filter(p => !served.includes(p)), "in site.publicFiles, but neither app/ nor public/ serves it").toEqual([]);
      });
    }

    if (options.proxySource !== undefined) {
      it("spells the package's matcher in proxy.ts", () => {
        expect(options.proxySource).toContain(`"${MATCHER}"`);
      });
    }
  });
}
