import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createLocaleRegistry } from "@evinvest/i18n";
import {
  defineSite,
  SERVICE_AREA_GATE,
  STOREFRONT_GATE,
  type LegacyRedirect,
  type PageSuffix,
  type Place,
  type Site,
} from "../../src/index";

/**
 * The fixtures the TS and Rust ports share, at the lib root. A site there is
 * data only; this turns one into a `Site` the way a brand's `site.ts` would.
 */
const ROOT = join(import.meta.dirname, "../../../../tests/fixtures/kitstart");

export function fixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(join(ROOT, name), "utf8")) as T;
}

type Locale = "fr" | "en";

interface SiteFixture {
  brand: Site<Locale>["brand"];
  i18n: { locales: [Locale, ...Locale[]]; labels: Record<Locale, string>; default: Locale; prefixDefaultLocale: boolean; hreflang: Partial<Record<Locale, string>> };
  ogLocale: Record<Locale, string>;
  topology: Site<Locale>["topology"];
  pages: { key: string; suffix: PageSuffix }[];
  places: Place<Locale>[];
  publication: "storefront" | "service-area";
  legacyRedirects: { from: string; to: Partial<Record<"null" | Locale, string>> }[];
  publicFiles: string[];
}

const cache = new Map<string, Site<Locale>>();

export function fixtureSite(name: string): Site<Locale> {
  const hit = cache.get(name);
  if (hit) return hit;
  const all = fixture<Record<string, SiteFixture>>("sites.json");
  const f = all[name];
  if (!f) throw new Error(`fixture: no site ${name}`);
  const legacy: LegacyRedirect<Locale>[] = f.legacyRedirects.map(r => ({
    from: r.from,
    to: locale => r.to[locale ?? "null"] ?? null,
  }));
  const pages: Record<string, PageSuffix> = {};
  for (const p of f.pages) pages[p.key] = p.suffix;
  const site = defineSite({
    brand: f.brand,
    i18n: createLocaleRegistry({
      locales: f.i18n.locales,
      labels: f.i18n.labels,
      default: f.i18n.default,
      prefixDefaultLocale: f.i18n.prefixDefaultLocale,
      hreflang: f.i18n.hreflang,
    }),
    ogLocale: f.ogLocale,
    topology: f.topology,
    pages: { home: "", ...pages },
    places: f.places,
    publication: f.publication === "storefront" ? STOREFRONT_GATE : SERVICE_AREA_GATE,
    lead: { subjects: ["other"], wire: { subject: "job", locality: "zip", mobile: "mobile" } },
    legacyRedirects: legacy,
    publicFiles: f.publicFiles,
  });
  cache.set(name, site);
  return site;
}

/** Through JSON, as a crawler reads it: `undefined` keys vanish, order is the builders'. */
export const viaJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
