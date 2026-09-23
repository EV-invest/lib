import { cardFact, defineSite, SERVICE_AREA_GATE } from "@evinvest/kitstart";
import { i18n } from "./i18n";
import { LEAD } from "./lead";
import { PLACES } from "./places";

/**
 * The brand as the machinery sees it — routing, the lead funnel, schema.org,
 * analytics and mail read their facts from this one object. Placeholders the
 * owner has not supplied are listed in `OWNER_TODO`, once, rather than found
 * on the page.
 */
export const site = defineSite({
  brand: {
    id: "brand",
    name: "Brand",
    legalName: "Brand SAS",
    email: cardFact("SITE_CARD_EMAIL", process.env.SITE_CARD_EMAIL),
    phone: cardFact("SITE_CARD_PHONE", process.env.SITE_CARD_PHONE),
    // `null` until the card has a `site`: noindex everywhere.
    domain: cardFact("SITE_CARD_SITE", process.env.SITE_CARD_SITE),
    businessType: "LocalBusiness",
  },
  i18n,
  ogLocale: { fr: "fr_FR", en: "en_GB" },
  // One place, served at the apex. A network of places is
  // `{ kind: "subdomains", apex: "directory" }` — `<slug>.<domain>` each.
  topology: { kind: "single", place: "paris" },
  pages: { home: "", prices: "/prices" },
  places: PLACES,
  publication: SERVICE_AREA_GATE,
  lead: LEAD,
});

export type PageKey = (typeof site.pageKeys)[number];

export interface OwnerTodo {
  field: string;
  why: string;
  /** Launch (a domain in card.toml) is refused while any of these is open. */
  blocksLaunch: boolean;
}

export const OWNER_TODO: readonly OwnerTodo[] = [
  { field: "site.brand.legalName", why: "raison sociale as registered", blocksLaunch: true },
  { field: "assets/card.toml phone", why: "the public number", blocksLaunch: false },
];
