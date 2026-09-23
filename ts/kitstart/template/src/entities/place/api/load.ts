import "server-only";
import { createPlaceLoader } from "@evinvest/kitstart/next";
import { places } from "@/shared/config/env";
import { site } from "@/shared/config/site";

/**
 * The place and how its links are written, from the route params alone — the
 * link mode is in the `[location]` param, so the page is cached (ISR).
 * The words for it are composed a layer up (`views`), not here: an entity
 * does not reach into a sibling slice.
 */
export const loadPlaceView = createPlaceLoader(site, places);
