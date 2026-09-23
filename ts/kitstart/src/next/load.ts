import { notFound } from "next/navigation.js";
import { cache } from "react";
import { createPlaceView, type PlaceView } from "../core/place/view";
import { parsePlaceParam } from "../core/routing";
import type { Site } from "../core/site";
import type { PlaceSource } from "../server/place-source";

export interface PlaceParams {
  locale: string;
  location: string;
}

/**
 * The place and the view for one page, from the route params alone: the link
 * mode is in the `location` param (`_royat` on a place's own host), so the
 * page reads nothing from the request and is cached (ISR) on the live data's
 * TTL. `notFound()` for an unknown language or place — a real 404 with
 * `noindex`. A failing live source never throws here (`createPlaceSource`).
 *
 * Memoised per render on (locale, param): `generateMetadata`, the layout and
 * the page ask for the same place once.
 */
export function createPlaceLoader<L extends string, P extends string>(
  site: Site<L, P>,
  source: PlaceSource<L>,
): (params: Promise<PlaceParams> | PlaceParams) => Promise<PlaceView<L>> {
  const load = cache(async (locale: string, param: string): Promise<PlaceView<L>> => {
    if (!site.i18n.isLocale(locale)) notFound();
    const { slug, mode } = parsePlaceParam(param);
    const place = await source.getPlace(slug, locale);
    if (!place) notFound();
    return createPlaceView(site, place, locale, mode);
  });
  return async params => {
    const { locale, location } = await params;
    return load(locale, location);
  };
}

/** `[locale]` alone: the language, or the 404. */
export async function loadLocale<L extends string, P extends string>(
  site: Site<L, P>,
  params: Promise<{ locale: string }> | { locale: string },
): Promise<L> {
  const { locale } = await params;
  if (!site.i18n.isLocale(locale)) notFound();
  return locale;
}
