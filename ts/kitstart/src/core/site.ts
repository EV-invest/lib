import type { LocaleRegistry } from "@evinvest/i18n";
import type { LeadSchema } from "./lead";
import type { PublicationPolicy } from "./place/publication";
import type { Place } from "./place/types";

/**
 * The composition root of a landing site: every brand fact the machinery reads
 * — routing, the lead funnel, schema.org, analytics, mail — arrives through one
 * object built by `defineSite`, instead of each slice importing the brand's
 * constants. Pure: no React, no Next, no `node:*`.
 */
export interface BrandFacts {
  /** `brand_id` in analytics, the `data-brand` palette scope. */
  id: string;
  name: string;
  legalName: string;
  email: string | null;
  /** As printed, international; `null` → no `tel:` channel. */
  phone: string | null;
  /** The apex; `null` → nothing is indexable and robots disallow everything. */
  domain: string | null;
  /** schema.org type of each place's business node: `"Plumber"`, `"LocalBusiness"`… */
  businessType: string;
  priceRange?: string;
}

/**
 * How places map onto hosts. `subdomains`: one place per `<slug>.<domain>`,
 * the apex a directory of them. `single`: the whole site is one place, and
 * its canonical origin is the apex.
 */
export type Topology = { kind: "subdomains"; apex: "directory" } | { kind: "single"; place: string };

/** A locale- and place-free page suffix: `""` is home, `"/prices"` a subpage. */
export type PageSuffix = `/${string}` | "";

/**
 * A path an earlier site served. `to` gets the path's locale prefix (`null`
 * when unprefixed) and answers where it moved, or `null` when that twin is
 * still a live page.
 */
export interface LegacyRedirect<L extends string> {
  from: string;
  to: (locale: L | null) => string | null;
}

export interface SiteConfig<L extends string, P extends string> {
  brand: BrandFacts;
  i18n: LocaleRegistry<L>;
  /**
   * `og:locale` per language — a region is required there, unlike `hreflang`.
   * A locale left out is derived from its `hreflang` (`fr-FR` → `fr_FR`).
   */
  ogLocale?: Readonly<Partial<Record<L, string>>>;
  topology: Topology;
  /** Every indexable page of a place; `home` is required. */
  pages: Readonly<Record<P | "home", PageSuffix>>;
  /** Every place the site has, baked; a live source may overlay them. */
  places: readonly Place<L>[];
  /** Which fields a place must fill before it may be indexed. */
  publication: PublicationPolicy;
  /** What the quote form asks and what a lead must have. */
  lead: LeadSchema<string>;
  legacyRedirects?: readonly LegacyRedirect<L>[];
}

export interface Site<L extends string, P extends string = string> extends SiteConfig<L, P> {
  /** Page keys in declaration order, `home` first as declared. */
  readonly pageKeys: readonly (P | "home")[];
  readonly placeSlugs: readonly string[];
}

export function defineSite<const L extends string, const P extends string>(config: SiteConfig<L, P>): Site<L, P> {
  const pageKeys = Object.keys(config.pages).filter((k): k is P | "home" => Object.hasOwn(config.pages, k));
  if (!pageKeys.includes("home")) throw new Error("defineSite: pages.home is required");
  for (const key of pageKeys) {
    // One spelling per page: `/prices/` would be a second URL for `/prices`.
    const suffix = config.pages[key];
    if (suffix.endsWith("/") || suffix.includes("//")) throw new Error(`defineSite: page "${key}" suffix "${suffix}" must not end in "/"`);
  }
  const placeSlugs = config.places.map(p => p.slug);
  const dup = placeSlugs.find((s, i) => placeSlugs.indexOf(s) !== i);
  if (dup !== undefined) throw new Error(`defineSite: place slug "${dup}" is listed twice`);
  for (const slug of placeSlugs) {
    // The host-mode route param is `_<slug>`; a slug starting with the mark
    // would read back as a different place.
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error(`defineSite: place slug "${slug}" must be [a-z0-9-], not starting with "-"`);
    // `/<locale>/404/404` is the proxy's route to the 404 (see `GONE`).
    if (slug === "404") throw new Error(`defineSite: place slug "404" is reserved for the 404 route`);
  }
  if (config.topology.kind === "single" && !placeSlugs.includes(config.topology.place)) {
    throw new Error(`defineSite: topology.place "${config.topology.place}" is not one of the places`);
  }
  return { ...config, pageKeys, placeSlugs };
}

/** One value per locale of the site, in its order. */
export function perLocale<L extends string, T>(site: { i18n: LocaleRegistry<L> }, fn: (locale: L) => T): Record<L, T> {
  const out: Partial<Record<L, T>> = {};
  for (const locale of site.i18n.locales) out[locale] = fn(locale);
  if (!isComplete(out, site.i18n.locales)) throw new Error("perLocale: a locale produced no value");
  return out;
}

function isComplete<L extends string, T>(record: Partial<Record<L, T>>, locales: readonly L[]): record is Record<L, T> {
  return locales.every(locale => Object.hasOwn(record, locale));
}

/** `og:locale` for a language: the configured one, else its `hreflang` with `_`. */
export function ogLocaleOf<L extends string>(site: Pick<SiteConfig<L, string>, "i18n" | "ogLocale">, locale: L): string {
  return site.ogLocale?.[locale] ?? site.i18n.hreflangOf(locale).replace("-", "_");
}

/** The baked place for a slug, if the site has it. */
export function bakedPlace<L extends string, P extends string>(site: Site<L, P>, slug: string): Place<L> | undefined {
  return site.places.find(p => p.slug === slug);
}

/** The numbers a place answers on: its own, or the brand's until it has one. */
export function contactOf(site: Pick<SiteConfig<string, string>, "brand">, place: Place<string>): { phone: string | null; whatsapp: string | null } {
  return {
    phone: place.channels.phone ?? site.brand.phone,
    whatsapp: place.channels.whatsapp ?? site.brand.phone,
  };
}
