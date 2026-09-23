import { createPlaceView } from "./place/view";
import type { Place } from "./place/types";
import { parsePlaceParam, THANKS } from "./routing";
import { bakedPlace, contactOf, perLocale, type Site } from "./site";

/**
 * Where a status screen's buttons go and which phone it prints. Every
 * status page — the 404, the 500, the thank-you page — answers in the page's
 * language with the right place's phone, and its language switch goes home
 * (a dead URL has no twin in the other language).
 */
export interface StatusTarget<L extends string> {
  locale: L;
  /** The place the URL named, baked, or `null` for the brand's own pages. */
  place: Place<L> | null;
  phone: string | null;
  home: string;
  /** Where "try again" goes. */
  retry: string;
  langHrefs: Record<L, string>;
}

function complete<L extends string>(r: Partial<Record<L, string>>, locales: readonly L[]): r is Record<L, string> {
  return locales.every(l => typeof r[l] === "string");
}

/**
 * The brand's own status target from two facts — for a client boundary
 * (`error.tsx`, the `notFound()` boundary), which must not import the site
 * config: it would carry every place into every page's bundle.
 */
export function brandStatusTarget<L extends string>(
  facts: { locales: readonly L[]; phone: string | null },
  locale: L,
  options: { retry?: string; thanks?: boolean } = {},
): StatusTarget<L> {
  const suffix = options.thanks ? THANKS : "";
  const langHrefs: Partial<Record<L, string>> = {};
  for (const l of facts.locales) langHrefs[l] = `/${l}${suffix}`;
  if (!complete(langHrefs, facts.locales)) throw new Error("brandStatusTarget: a locale was skipped");
  return {
    locale,
    place: null,
    phone: facts.phone,
    home: `/${locale}`,
    retry: options.retry ?? `/${locale}`,
    langHrefs,
  };
}

/**
 * Server side — the global not-found page, a thank-you page: the target for
 * the place the params name. Not for a client module (see
 * {@link brandStatusTarget}).
 *
 * Read from the route params alone — `useParams()` in a client boundary, or a
 * page's `params` — never from the request: a not-found boundary is rendered
 * into every cached page, and a `headers()` there would make each one
 * per-request again. The link mode rides in the `location` param (`_royat`).
 */
export function statusTarget<L extends string, P extends string>(
  site: Site<L, P>,
  params: { locale?: string | string[] | undefined; location?: string | string[] | undefined },
  options: { retry?: string; thanks?: boolean } = {},
): StatusTarget<L> {
  const locale = typeof params.locale === "string" && site.i18n.isLocale(params.locale) ? params.locale : site.i18n.defaultLocale;
  const suffix = options.thanks ? THANKS : "";
  const param = typeof params.location === "string" ? parsePlaceParam(params.location) : null;
  const place = param ? (bakedPlace(site, param.slug) ?? null) : null;
  if (place && param) {
    const view = createPlaceView(site, place, locale, param.mode);
    return {
      locale,
      place,
      phone: contactOf(site, place).phone,
      home: view.href(""),
      retry: options.retry ?? view.href(""),
      langHrefs: perLocale(site, l => view.href(suffix, l)),
    };
  }
  return {
    locale,
    place: null,
    phone: site.brand.phone,
    home: `/${locale}`,
    retry: options.retry ?? `/${locale}`,
    langHrefs: perLocale(site, l => `/${l}${suffix}`),
  };
}
