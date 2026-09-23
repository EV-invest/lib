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

/**
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
