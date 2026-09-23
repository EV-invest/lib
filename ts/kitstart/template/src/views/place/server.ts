import "server-only";
import { contactOf, type PlaceView } from "@evinvest/kitstart";
import { copyFor, type Copy } from "@/entities/content";
import { loadPlaceView } from "@/entities/place/server";
import type { Locale } from "@/shared/config/i18n";
import { site } from "@/shared/config/site";

/** A place page's view and its words: the entity and the copy, composed here. */
export async function loadPlace(params: Promise<{ locale: string; location: string }>): Promise<{ view: PlaceView<Locale>; copy: Copy; renderedAt: number }> {
  const view = await loadPlaceView(params);
  // The time trap's stamp: when this render (under ISR, this cache fill) happened.
  return { view, renderedAt: Date.now(), copy: copyFor(view.locale, { place: view.place.name[view.locale], phone: contactOf(site, view.place).phone }) };
}
