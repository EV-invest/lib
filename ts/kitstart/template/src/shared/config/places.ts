import type { Place } from "@evinvest/kitstart";
import type { Locale } from "./i18n";

/**
 * The baked half of every place: what the site says when the live source is
 * absent or unreachable. A service-area business has no address in its type;
 * a storefront would be `{ kind: "storefront", address, geo, … }`.
 */
export const PLACES: readonly Place<Locale>[] = [
  {
    slug: "paris",
    gbpName: "Brand — Paris",
    name: { fr: "Paris", en: "Paris" },
    presence: { kind: "service-area" },
    serviceArea: [{ kind: "localities", names: ["Paris"] }],
    channels: { phone: null, whatsapp: null },
    hours: [{ days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:00", closes: "19:00" }],
    rating: null,
  },
];
