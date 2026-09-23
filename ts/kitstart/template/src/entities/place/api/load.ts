import "server-only";
import { contactOf } from "@evinvest/kitstart";
import { createPlaceLoader } from "@evinvest/kitstart/next";
import { copyFor, type Copy } from "@/entities/content";
import { places } from "@/shared/config/env";
import type { Locale } from "@/shared/config/i18n";
import { site } from "@/shared/config/site";
import type { PlaceView } from "@evinvest/kitstart";

const load = createPlaceLoader(site, places);

/**
 * The place and its words for one page, from the route params alone — the
 * link mode is in the `[location]` param, so the page is cached (ISR).
 */
export async function loadPlace(params: Promise<{ locale: string; location: string }>): Promise<{ view: PlaceView<Locale>; copy: Copy }> {
  const view = await load(params);
  return { view, copy: copyFor(view.locale, { place: view.place.name[view.locale], phone: contactOf(site, view.place).phone }) };
}
